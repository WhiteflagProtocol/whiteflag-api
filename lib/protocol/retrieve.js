'use strict';
/**
 * @module lib/protocol/retrieve
 * @summary Whiteflag message retrieval module
 * @description Module for Whiteflag message retrieval from datastores and blockchains
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    getMessage,
    getQuery,
    getReferences,
    getAuthMessages,
    getSequence,
    test: {
        refRef: removeSupersededMessages,
        semRef: removeSemanticReferences
    }
};

/* Type defintitions */
/**
 * @callback wfMessagesCb
 * @param {error} err any error
 * @param {wfMessage[]} message an array with the Whiteflag messages
 */

/* Common internal functions and classes */
const log = require('../_common/logger');
const arr = require('../_common/arrays');
const { ProcessingError } = require('../_common/errors');

/* Whiteflag modules */
const wfBlockchains = require('../blockchains');
const wfDatastores = require('../datastores');
const wfCodec = require('./codec');
const wfRxEvent = require('./events').rxEvent;

/* Module constants */
const MODULELOG = 'retrieve';
const AUTHMESSAGECODE = 'A';

/* MAIN MODULE FUNCTIONS */
/**
 * Retrieves a message from database or blockchain
 * @function getMessage
 * @alias lib/protocol/retrieve.getMessage
 * @param {string} transactionHash the hash of the transaction to look up
 * @param {string} [blockchain] the blockchain on which the transaction is stored
 * @param {wfMessagesCb} callback function called on completion
 */
function getMessage(transactionHash, blockchain = null, callback) {
    if (!transactionHash) return callback(new ProcessingError('No transaction hash specified', null, 'WF_API_BAD_REQUEST'));
    let wfQuery = {};
    wfQuery['MetaHeader.transactionHash'] = transactionHash;
    if (blockchain) wfQuery['MetaHeader.blockchain'] = blockchain;
    return retrieveMessages(wfQuery, callback);
}

/**
 * Retrieves a message from database or blockchain
 * @function getQuery
 * @alias module:lib/protocol/retrieve.getQuery
 * @param {Object} wfQuery the query to be performed
 * @param {wfMessagesCb} callback function called on completion
 */
function getQuery(wfQuery = {}, callback) {
    return retrieveMessages(wfQuery, callback);
}

/**
 * Retrieves referencing messages from database or blockchain
 * @function getReferences
 * @alias module:lib/protocol/retrieve.getReferences
 * @param {string} transactionHash the transaction hash of the referenced message
 * @param {string} [blockchain] the blockchain on which the transaction is stored
 * @param {wfMessagesCb} callback function called on completion
 */
function getReferences(transactionHash, blockchain = null, callback) {
    if (!transactionHash) return callback(new ProcessingError('No transaction hash specified', null, 'WF_API_BAD_REQUEST'));
    let wfQuery = {};
    wfQuery['MessageHeader.ReferencedMessage'] = transactionHash;
    if (blockchain) wfQuery['MetaHeader.blockchain'] = blockchain;
    return retrieveMessages(wfQuery, callback);
}

/**
 * Retrieves authentication messages for a specific blockchain address from database or blockchain
 * @todo Remove semantic refs and superseded messages from sequence
 * @function getAuthMessages
 * @alias module:lib/protocol/retrieve.getAuthMessages
 * @param {string} originatorAddress the originator address of the authentication message
 * @param {string} [blockchain] the blockchain on which the transaction is stored
 * @param {wfMessagesCb} callback function called on completion
 */
function getAuthMessages(originatorAddress, blockchain = null, callback) {
    if (!originatorAddress) return callback(new ProcessingError('No originator address specified', null, 'WF_API_BAD_REQUEST'));
    let wfQuery = {};
    wfQuery['MetaHeader.originatorAddress'] = originatorAddress;
    wfQuery['MessageHeader.MessageCode'] = AUTHMESSAGECODE;
    if (blockchain) wfQuery['MetaHeader.blockchain'] = blockchain;

    // Retrieve and process messages
    retrieveMessages(wfQuery, function retrieveAuthMessagesCb(err, authMessages) {
        // Check for errors and if any authentication message was found
        if (err) return callback(err);
        if (authMessages.length === 0) {
            return callback(new ProcessingError(`Could not find authentication messages for address ${originatorAddress}`, null, 'WF_API_NO_DATA'));
        }
        // WIP: Return result, removing semantic refs and superseded messages from sequence
        // WIP: authSequence = removeSemanticReferences(authSequence);
        // WIP: return callback(null, removeSupersededMessages(authSequence));
        return callback(null, authMessages);
    });
}

/**
 * Retrieves and evaluates message sequence starting with the message identified by the transaction hash
 * @todo Clean up retrieved sequence
 * @function getSequence
 * @alias module:lib/protocol/retrieve.getSequence
 * @param {string} transactionHash the hash of the transaction to look up
 * @param {string} blockchain the blockchain on which the transaction is stored
 * @param {wfMessagesCb} callback function called on completion
 */
function getSequence(transactionHash, blockchain, callback) {
    if (!blockchain) return callback(new ProcessingError('No blockchain specified', null, 'WF_API_BAD_REQUEST'));
    if (!transactionHash) return callback(new ProcessingError('No transaction hash specified to find first message in sequence', null, 'WF_API_BAD_REQUEST'));
    let wfQuery = {};
    wfQuery['MetaHeader.blockchain'] = blockchain;
    wfQuery['MetaHeader.transactionHash'] = transactionHash;

    // Call function to retrieve first message of sequence
    retrieveMessages(wfQuery, function retrieveSequenceCb(err, initMsgSequence) {
        // Check if transaction hash of message was found
        if (err) return callback(err);
        if (initMsgSequence.length === 0) {
            return callback(new ProcessingError('Could not find transaction hash of first message in sequence', null, 'WF_API_NO_DATA'));
        }
        // Variables needed to process sequence
        let seqBeginLength;
        let seqRefLookups = [];
        let seqProcessedLookups = [];

        // Iterate until full sequence has been retrieved
        iterateSeqence(initMsgSequence);

        /**
         * Iterates through message sequence to retrieve referenced messages
         * @private
         * @param {*} msgSequence 
         */
        function iterateSeqence(msgSequence) {
            // Get current length of sequence and transaction hashes that have not been looked up yet
            seqBeginLength = msgSequence.length;
            seqRefLookups = arr.plucksub(msgSequence, 'MetaHeader', 'transactionHash')
                            .filter(function retrieveSequenceFilterCb(transactionHash) {
                                return (seqProcessedLookups.indexOf(transactionHash) < 0);
                            });
            // Loop through sequence to add referencing messages
            iterateMessages(seqRefLookups.length);

            /**
             * Iterates through message to retrieve
             * @private
             * @param {*} i index
             */
            function iterateMessages(i) {
                // Decrease iteration counter
                i -= 1;

                // Construct new query
                wfQuery = {};
                wfQuery['MessageHeader.ReferencedMessage'] = seqRefLookups[i];
                wfQuery['MetaHeader.blockchain'] = blockchain;

                // Retrieve referencing messages
                retrieveMessages(wfQuery, function retrieveSequenceRefMessagesCb(err, refMessages) {
                    if (err) log.error(MODULELOG, `Error retrieving mesages in sequence: ${err.message}`);
                    msgSequence = arr.addArray(msgSequence, refMessages);

                    // Remember messages for which references just have been retrieved
                    seqProcessedLookups.push(seqRefLookups[i]);

                    // Check if more references need to be looked up
                    if (i > 0) return iterateMessages(i);

                    // If sequence has grown, remove semantic reference not processed by API, and look for more messages
                    if (msgSequence.length > seqBeginLength) {
                        // WIP: return iterateSeqence(removeSemanticReferences(msgSequence));
                        return iterateSeqence(msgSequence);
                    }
                    // WIP: No more referencing messages; clean up sequence and return result
                    // WIP: log.trace(MODULELOG, `Found sequence of ${msgSequence.length} messages: removing superseded messages`);
                    // WIP: return callback(null, removeSupersededMessages(msgSequence));
                    return callback(null, msgSequence);
                });
            }
        }
    });
}

/* PRIVATE MODULE FUNCTIONS */
/**
 * Retrieves an array of messages from datastore or blockchain
 * @private
 * @param {Object} wfQuery the query to be performed
 * @param {string} blockchain the blockchain on which the transaction is stored
 * @param {wfMessagesCb} callback function called on completion
 */
function retrieveMessages(wfQuery = {}, callback) {
    // Lookup message in database first - returns an array
    wfDatastores.getMessages(wfQuery, function retrieveMessagesDbCb(err, wfMessages, count) {
        if (err) return callback(err);
        if (count === 1) return callback(null, wfMessages);
        if (count > 1) return callback(null, wfMessages);

        // Cannot look on blockchain if no blockchain and transaction hash specified
        if (!wfQuery['MetaHeader.blockchain']) return callback(null, wfMessages);
        if (!wfQuery['MetaHeader.transactionHash']) return callback(null, wfMessages);

        /**
         * @callback bcGetMessageCb
         * @param {Error} err any error
         * @param {Object} wfMessage a Whiteflag message
         */
        wfBlockchains.getMessage(wfQuery, function retrieveMessagesBcCb(err, wfMessage) {
            if (err) return callback(err, null);
            wfCodec.decode(wfMessage, function retrieveDecodeCb(err, wfMessage, ivMissing) {
                let wfMessages = [ wfMessage ];
                if (err) return callback(err, wfMessages);
                if (ivMissing) return callback(new ProcessingError('Cannot decrypt message without initialisation vector', null, ''), wfMessages);

                // Valid message: process further and return result
                if (wfMessage.MetaHeader.formatValid) wfRxEvent.emit('messageDecoded', wfMessage);
                return callback(null, wfMessages);
            });
        });
    });
}

/**
 * Removes superseded or unneeded messages from a message sequence array
 * @todo This function needs to be evaluated
 * @private
 * @param {Array} msgSequence array containing a message sequence
 * @returns {Array} array with superseded messages removed
 */
function removeSupersededMessages(msgSequence) {
    // 1. Ignore all messages that are recalled
    msgSequence = msgSequence.filter(function removeSuperseded1Filter(wfMessage) {
        return (msgSequence.filter(function removeSuperseded1RefFilter(wfRefMessage) {
            return (
                wfRefMessage.MessageHeader.ReferencedMessage === wfMessage.MetaHeader.transactionHash
                && wfRefMessage.MessageHeader.ReferenceIndicator === '1'
            );
        }).length === 0);
    });
    // 2. Ignore all messages that are updated or expired
    msgSequence = msgSequence.filter(function removeSuperseded24Filter(wfMessage) {
        return (msgSequence.filter(function removeSuperseded24RefFilter(wfRefMessage) {
            return (
                wfRefMessage.MessageHeader.ReferencedMessage === wfMessage.MetaHeader.transactionHash
                && ['2', '4'].indexOf(wfRefMessage.MessageHeader.ReferenceIndicator) > -1
            );
        }).length === 0);
    });
    // 3. Ignore all referencing messages of which the referenced message is ignored, except for updates
    msgSequence = msgSequence.filter(function removeSupersededOldRefsRefFilter(wfRefMessage) {
        return (
            wfRefMessage.MessageHeader.ReferenceIndicator === '0'
            || wfRefMessage.MessageHeader.ReferenceIndicator === '2'
            || msgSequence.filter(function removeSupersededOldRefsFilter(wfMessage) {
                return (wfRefMessage.MessageHeader.ReferencedMessage === wfMessage.MetaHeader.transactionHash);
            }).length > 0
        );
    });
    // Return resulting cleaned up message sequence array
    return msgSequence;
}

/**
 * Removes semantic reference messages (reference code >= 5) from a message sequence array
 * @todo This function needs to be evaluated
 * @private
 * @param {Array} msgSequence array containing a message sequence
 * @returns {Array} array with superseded messages removed
 */
function removeSemanticReferences(msgSequence) {
    // 1. Reference codes 5-9 are ignored
    msgSequence = msgSequence.filter(function removeSemantic56789Filter(wfMessage) {
        return (['5', '6', '7', '8', '9'].indexOf(wfMessage.MessageHeader.ReferenceIndicator) < 0);
    });
    // 2. Ignore all referencing messages of which the referenced message is ignored
    msgSequence = msgSequence.filter(function removeSemanticOldRefsRefFilter(wfRefMessage) {
        return (msgSequence.filter(function removeSemanticOldRefsFilter(wfMessage) {
            return (
                wfRefMessage.MessageHeader.ReferenceIndicator === '0'
                || wfRefMessage.MessageHeader.ReferencedMessage === wfMessage.MetaHeader.transactionHash
            );
        }).length > 0);
    });
    // Return resulting cleaned up message sequence array
    return msgSequence;
}
