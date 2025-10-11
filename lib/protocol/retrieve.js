'use strict';
/**
 * @module lib/protocol/retrieve
 * @summary Whiteflag message retrieval module
 * @description Module for Whiteflag message retrieval from datastores and blockchains
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    // Message retrieval functions
    getMessage,
    getQuery,
    getReferences,
    getAuthMessages,
    getSequence,
    // Private retrieval functions for testing
    test: {
        refRef: removeSupersededMessages,
        semRef: removeSemanticReferences
    }
};

// Common internal functions and classes //
const log = require('../_common/logger');
const array = require('../_common/arrays');
const { ProcessingError } = require('../_common/errors');

// Whiteflag modules //
const wfApiBlockchains = require('../blockchains');
const wfApiDatastores = require('../datastores');
const wfCodec = require('./codec');

 // Whiteflag event emitters //
const wfRxEvent = require('./events').rxEvent;

// Module constants //
const MODULELOG = 'retrieve';
const AUTHMESSAGECODE = 'A';

// MAIN MODULE FUNCTIONS //
/**
 * Retrieves a message from database or blockchain
 * @function getMessage
 * @alias lib/protocol/retrieve.getMessage
 * @param {string} transactionHash the hash of the transaction to look up
 * @param {string} blockchain the blockchain on which the transaction is stored
 * @param {function(Error, wfMessages)} callback function passed to retrieve function to be called upon completion
 */
function getMessage(transactionHash = '0', blockchain = null, callback) {
    let wfQuery = {};
    wfQuery['MetaHeader.transactionHash'] = transactionHash;
    if (blockchain) wfQuery['MetaHeader.blockchain'] = blockchain;
    return retrieveMessages(wfQuery, blockchain, callback);
}

/**
 * Retrieves a message from database or blockchain
 * @function getQuery
 * @alias module:lib/protocol/retrieve.getQuery
 * @param {Object} wfQuery the query to be performed
 * @param {function(Error, wfMessages)} callback function passed to retrieve function to be called upon completion
 */
function getQuery(wfQuery = {}, callback) {
    let blockchain = null;
    if (wfQuery['MetaHeader.blockchain']) blockchain = wfQuery['MetaHeader.blockchain'];
    return retrieveMessages(wfQuery, blockchain, callback);
}

/**
 * Retrieves referencing messages from database or blockchain
 * @function getReferences
 * @alias module:lib/protocol/retrieve.getReferences
 * @param {string} transactionHash the transaction hash of the referenced message
 * @param {string} blockchain the blockchain on which the transaction is stored
 * @param {function(Error, wfMessages)} callback function passed to retrieve function to be called upon completion
 */
function getReferences(transactionHash = '0', blockchain = null, callback) {
    let wfQuery = {};
    wfQuery['MessageHeader.ReferencedMessage'] = transactionHash;
    if (blockchain) wfQuery['MetaHeader.blockchain'] = blockchain;
    return retrieveMessages(wfQuery, blockchain, callback);
}

/**
 * Retrieves authentication messages for a specific blockchain address from database or blockchain
 * @todo Remove semantic refs and superseded messages from sequence
 * @function getAuthMessages
 * @alias module:lib/protocol/retrieve.getAuthMessages
 * @param {string} originatorAddress the originator address of the authentication message
 * @param {string} blockchain the blockchain on which the transaction is stored
 * @param {function(Error, wfMessages)} callback function called upon completion
 */
function getAuthMessages(originatorAddress = '0', blockchain = null, callback) {
    let wfQuery = {};

    // Construct query to get all authentication messages
    wfQuery['MetaHeader.originatorAddress'] = originatorAddress;
    wfQuery['MessageHeader.MessageCode'] = AUTHMESSAGECODE;
    if (blockchain) wfQuery['MetaHeader.blockchain'] = blockchain;

    // Retrieve and process messages
    retrieveMessages(wfQuery, blockchain, function retrieveAuthMessagesCb(err, authMessageSequence) {
        // Check for errors and if any authentication message was found
        if (err) return callback(err);
        if (authMessageSequence.length === 0) {
            return callback(new ProcessingError('Could not find transaction hash of first message in sequence', null, 'WF_API_NO_DATA'));
        }
        // WIP: Return result, removing semantic refs and superseded messages from sequence
        // WIP: authMessageSequence = removeSemanticReferences(authMessageSequence);
        // WIP: return callback(null, removeSupersededMessages(authMessageSequence));
        return callback(null, authMessageSequence);
    });
}

/**
 * Retrieves and evaluates message sequence starting with the message identified by the transaction hash
 * @todo Clean up retrieved sequence
 * @function getSequence
 * @alias module:lib/protocol/retrieve.getSequence
 * @param {string} transactionHash the hash of the transaction to look up
 * @param {string} blockchain the blockchain on which the transaction is stored
 * @param {function(Error, wfMessages)} callback function called upon completion
 */
function getSequence(transactionHash = '0', blockchain = null, callback) {
    let wfQuery = {};

    // Construct query to get sequence
    wfQuery['MetaHeader.transactionHash'] = transactionHash;
    if (blockchain) wfQuery['MetaHeader.blockchain'] = blockchain;

    // Call function to retrieve first message of sequence
    retrieveMessages(wfQuery, blockchain, function retrieveSequenceCb(err, wfMessageInitSequence) {
        // Check if transaction hash of message was found
        if (err) return callback(err);
        if (wfMessageInitSequence.length === 0) {
            return callback(new ProcessingError('Could not find transaction hash of first message in sequence', null, 'WF_API_NO_DATA'));
        }
        // Variables needed to process sequence
        let sequenceBeginLength;
        let sequenceRefLookups = [];
        let sequenceProcessedRefLookups = [];

        // Iterate until full sequence has been retrieved
        function iterateSeqence(wfMessageSequence) {
            // Get current length of sequence and transaction hashed that have not been looked up yet
            sequenceBeginLength = wfMessageSequence.length;
            sequenceRefLookups = array.plucksub(wfMessageSequence, 'MetaHeader', 'transactionHash').filter(function retrieveSequenceFilterCb(transactionHash) {
                return (sequenceProcessedRefLookups.indexOf(transactionHash) < 0);
            });
            // Loop through sequence to add referencing messages
            function iterateMessages(i) {
                // Decrease iteration counter
                i -= 1;

                // Construct new query
                wfQuery = {};
                wfQuery['MessageHeader.ReferencedMessage'] = sequenceRefLookups[i];
                if (blockchain) wfQuery['MetaHeader.blockchain'] = blockchain;

                // Retrieve referencing messages
                retrieveMessages(wfQuery, blockchain, function retrieveSequenceRefMessagesCb(err, refMessages) {
                    if (err) log.error(MODULELOG, `Error retrieving mesages in sequence: ${err.message}`);
                    wfMessageSequence = array.addArray(wfMessageSequence, refMessages);

                    // Remember messages for which references just have been retrieved
                    sequenceProcessedRefLookups.push(sequenceRefLookups[i]);

                    // Check if more references need to be looked up
                    if (i > 0) return iterateMessages(i);

                    // If sequence has grown, remove semantic reference not processed by API, and look for more messages
                    if (wfMessageSequence.length > sequenceBeginLength) {
                        // WIP: return iterateSeqence(removeSemanticReferences(wfMessageSequence));
                        return iterateSeqence(wfMessageSequence);
                    }
                    // WIP: No more referencing messages; clean up sequence and return result
                    // WIP: log.trace(MODULELOG, `Found sequence of ${wfMessageSequence.length} messages: removing superseded messages`);
                    // WIP: return callback(null, removeSupersededMessages(wfMessageSequence));
                    return callback(null, wfMessageSequence);
                });
            }
            iterateMessages(sequenceRefLookups.length);
        }
        iterateSeqence(wfMessageInitSequence);
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Retrieves an array of messages from datastore or blockchain
 * @private
 * @param {Object} wfQuery the query to be performed
 * @param {string} blockchain the blockchain on which the transaction is stored
 * @param {function(Error, wfMessage[])} callback function called upon completion
 */
function retrieveMessages(wfQuery = {}, blockchain = null, callback) {
    // Lookup message in database first - returns an array
    wfApiDatastores.getMessages(wfQuery, function retrieveMessagesDbCb(err, wfMessages, count) {
        if (err) return callback(err, wfMessages);
        if (count === 1) return callback(null, wfMessages);
        if (count > 1) return callback(null, wfMessages);

        // Cannot look on blockchain if no blockchain and transaction hash specified
        if (!blockchain && !wfQuery['MetaHeader.blockchain']) return callback(null, wfMessages);
        if (!wfQuery['MetaHeader.transactionHash']) return callback(null, wfMessages);

        // Lookup message on blockchain and decode - returns single message
        if (blockchain) wfQuery['MetaHeader.blockchain'] = blockchain;
        /**
         * @callback bcGetMessageCb
         * @param {Error} err any error
         * @param {Object} wfMessage a Whiteflag message
         */
        wfApiBlockchains.getMessage(wfQuery, function retrieveMessagesBcCb(err, wfMessage) {
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
 * @param {Array} wfMessageSequence array containing a message sequence
 * @returns {Array} array with superseded messages removed
 */
function removeSupersededMessages(wfMessageSequence) {
    // 1. Ignore all messages that are recalled
    wfMessageSequence = wfMessageSequence.filter(function removeSuperseded1Filter(wfMessage) {
        return (wfMessageSequence.filter(function removeSuperseded1RefFilter(wfRefMessage) {
            return (
                wfRefMessage.MessageHeader.ReferencedMessage === wfMessage.MetaHeader.transactionHash
                && wfRefMessage.MessageHeader.ReferenceIndicator === '1'
            );
        }).length === 0);
    });
    // 2. Ignore all messages that are updated or expired
    wfMessageSequence = wfMessageSequence.filter(function removeSuperseded24Filter(wfMessage) {
        return (wfMessageSequence.filter(function removeSuperseded24RefFilter(wfRefMessage) {
            return (
                wfRefMessage.MessageHeader.ReferencedMessage === wfMessage.MetaHeader.transactionHash
                && ['2', '4'].indexOf(wfRefMessage.MessageHeader.ReferenceIndicator) > -1
            );
        }).length === 0);
    });
    // 3. Ignore all referencing messages of which the referenced message is ignored, except for updates
    wfMessageSequence = wfMessageSequence.filter(function removeSupersededOldRefsRefFilter(wfRefMessage) {
        return (
            wfRefMessage.MessageHeader.ReferenceIndicator === '0'
            || wfRefMessage.MessageHeader.ReferenceIndicator === '2'
            || wfMessageSequence.filter(function removeSupersededOldRefsFilter(wfMessage) {
                return (wfRefMessage.MessageHeader.ReferencedMessage === wfMessage.MetaHeader.transactionHash);
            }).length > 0
        );
    });
    // Return resulting cleaned up message sequence array
    return wfMessageSequence;
}

/**
 * Removes semantic reference messages (reference code >= 5) from a message sequence array
 * @todo This function needs to be evaluated
 * @private
 * @param {Array} wfMessageSequence array containing a message sequence
 * @returns {Array} array with superseded messages removed
 */
function removeSemanticReferences(wfMessageSequence) {
    // 1. Reference codes 5-9 are ignored
    wfMessageSequence = wfMessageSequence.filter(function removeSemantic56789Filter(wfMessage) {
        return (['5', '6', '7', '8', '9'].indexOf(wfMessage.MessageHeader.ReferenceIndicator) < 0);
    });
    // 2. Ignore all referencing messages of which the referenced message is ignored
    wfMessageSequence = wfMessageSequence.filter(function removeSemanticOldRefsRefFilter(wfRefMessage) {
        return (wfMessageSequence.filter(function removeSemanticOldRefsFilter(wfMessage) {
            return (
                wfRefMessage.MessageHeader.ReferenceIndicator === '0'
                || wfRefMessage.MessageHeader.ReferencedMessage === wfMessage.MetaHeader.transactionHash
            );
        }).length > 0);
    });
    // Return resulting cleaned up message sequence array
    return wfMessageSequence;
}
