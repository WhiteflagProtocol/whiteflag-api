'use strict';
/**
 * @module lib/protocol/transmit
 * @summary Whiteflag transmit module
 * @description Module defining the message transmit and receive events chain
 * @tutorial modules
 * @tutorial protocol
 * @tutorial events
 */
module.exports = {
    // Transmit functions
    init: initTx
};

// Whiteflag common functions and classes //
const log = require('../common/logger');
const { type } = require('../common/protocol');
const { ProcessingError, ProtocolError } = require('../common/errors');

// Whiteflag modules //
const wfApiBlockchain = require('../blockchains');
const wfCodec = require('./codec');
const wfReference = require('./references');

// Whiteflag event emitters //
const wfTxEvent = require('./events').txEvent;

// Whiteflag configuration data //
const wfConfigData = require('./config').getConfig();

// Module constants //
const MODULELOG = 'transmit';
const TESTMESSAGECODE = 'T';
const RETRYTIME = 20000;

// MAIN MODULE FUNCTIONS //
/**
 * Initialises message transmit event chain by binding events to listeners/handlers.
 * This ensures the following TX events are executed in the right order:
 *  1.  'messageCommitted'
 *  2.  'metadataVerified'
 *  3.  'referenceVerified' / 'referenceSkipped'
 *  4.  'messageEncoded'
 *  5.  'messageSent'
 *  6.  'messageProcessed'
 * When an error occurs, the 'error' event is emitted.
 * @function init
 * @alias module:lib/protocol/transmit.init
 * @param {function(Error)} callback function to be called upon completion
 * @emits module:lib/protocol/events.txEvent:initialised
 */
function initTx(callback) {
    /**
     * Listener for incoming data from originator to call tx metadata verifier
     * @listens module:lib/protocol/events.txEvent:messageCommitted
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
     */
    wfTxEvent.on('messageCommitted', txVerifyMetadata);
    /**
     * Listener for checked tx originator data to call tx message reference verifier
     * @listens module:lib/protocol/events.txEvent:metadataVerified
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
     */
    wfTxEvent.on('metadataVerified', txVerifyReference);
    /**
     * Listener for verified tx message references to call message encoder
     * @listens module:lib/protocol/events.txEvent:referenceVerified
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
     */
    wfTxEvent.on('referenceVerified', txEncodeMessage);
    /**
     * Listener for skipped tx message reference verification to call message encoder
     * @listens module:lib/protocol/events.txEvent:referenceSkipped
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
     */
    wfTxEvent.on('referenceSkipped', txEncodeMessage);
    /**
     * Listener for encoded tx messages to call message sender
     * @listens module:lib/protocol/events.txEvent:messageEncoded
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
     */
     wfTxEvent.on('messageEncoded', txSendMessage);
    /**
     * Listener for sent tx messages to call api response handler
     * @listens module:lib/protocol/events.txEvent:messageSent
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
     */
    wfTxEvent.on('messageSent', txCompleted);
    /**
     * Listener for tx errors
     * @listens module:lib/protocol/events.txEvent:error
     * @param {Error} err error
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
     */
    wfTxEvent.on('error', txError);

    // Invoke callback after binding all events to listeners/handlers
    wfTxEvent.emit('initialised');
    if (callback) return callback(null);
}

// PRIVATE TX EVENT HANDLERS //
/**
 * Logs success and calls the callback passed through the tx event chain
 * @private
 * @param {Error} err error
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {function(Error, wfMessage)} callback function called with error
 */
function txCompleted(wfMessage, callback) {
    log.debug(MODULELOG, `Successfully processed outgoing ${type(wfMessage)} message: ` + JSON.stringify(wfMessage));
    wfTxEvent.emit('messageProcessed', wfMessage);
    if (callback) return callback(null, wfMessage);
}

/**
 * Logs errors and calls the callback passed through the tx event chain
 * @private
 * @param {Error} err the error that occured in the event chain
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {function(Error, wfMessage)} callback function called with error
 */
function txError(err, wfMessage, callback) {
    if (!err) err = new Error('Unspecified error in tx event chain');

    // Log the error based on the available information
    let messageStr = '';
    let messageType = '';
    if (wfMessage && wfMessage.MetaHeader) {
        if (wfMessage.MessageHeader) {
            messageType = type(wfMessage) + ' ';
        }
        messageStr = ' ' + JSON.stringify(wfMessage) + ':';
    }
    if (err instanceof ProtocolError || err instanceof ProcessingError) {
        if (err.causes) {
            log.debug(MODULELOG, `Could not process ${messageType}message:` + `${messageStr} ${err.message}: ` + JSON.stringify(err.causes));
        } else {
            log.debug(MODULELOG, `Could not process ${messageType}message:` + `${messageStr} ${err.message}`);
        }
    } else {
        log.error(MODULELOG, `Error processing ${messageType}message:` + `${messageStr} ${err.message}`);
    }
    // Finally, call the callback function passing the error
    if (callback) return callback(err, wfMessage);
}

/**
 * Checks incoming tx data for critical metadata errors and emits positive result
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.txEvent:metadataVerified
 */
function txVerifyMetadata(wfMessage, callback) {
    let messageErrors = checkTxMetaHeaderErrors(wfMessage);
    if (messageErrors.length > 0) {
        let err = new ProtocolError('Invalid message metaheader', messageErrors, 'WF_METAHEADER_ERROR');
        return wfTxEvent.emit('error', err, wfMessage, callback);
    }
    // Set transceive direction and emit event upon completion
    wfMessage.MetaHeader.transceiveDirection = 'TX';
    return wfTxEvent.emit('metadataVerified', wfMessage, callback);
}

/**
 * Calls reference validator and emits positive result
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.txEvent:referenceVerified
 * @emits module:lib/protocol/events.txEvent:referenceSkipped
 */
function txVerifyReference(wfMessage, callback) {
    // Skip reference check for outgoing message if configured
    if (!wfConfigData.tx.verifyReference || wfMessage.MetaHeader.autoGenerated) {
        return wfTxEvent.emit('referenceSkipped', wfMessage, callback);
    }
    // Check message reference
    wfReference.verify(wfMessage, function txValidateReferenceCb(err, wfMessage) {
        // Check for reference errors
        if (err && err instanceof ProtocolError) {
            return wfTxEvent.emit('error', err, wfMessage, callback);
        }
        if (err) log.warn(MODULELOG, `Reference of outgoing ${type(wfMessage)} message could not be verified: ${err.message}`);

        // Emit event upon completion and pass data
        return wfTxEvent.emit('referenceVerified', wfMessage, callback);
    });
}

/**
 * Calls message encoder and emits positive result
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.txEvent:messageEncoded
 */
function txEncodeMessage(wfMessage, callback) {
    // Validate and encode the message; on error return unencoded message
    wfCodec.encode(wfMessage, function txEncodeCb(err, wfMessage) {
        if (err) return wfTxEvent.emit('error', err, wfMessage, callback);
        return wfTxEvent.emit('messageEncoded', wfMessage, callback);
    });
}

/**
 * Calls blockchain connector and emits positive result
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {function(Error, wfMessage)} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.txEvent: messageSent
 */
function txSendMessage(wfMessage, callback) {
    // Check if only test message may be sent
    if (
        wfMessage.MessageHeader.MessageCode !== TESTMESSAGECODE
        && wfConfigData.tx.testMessagesOnly
    ) {
        return wfTxEvent.emit('error', new ProcessingError('Configuration only allows test messages to be sent', null, 'WF_API_NOT_ALLOWED'), wfMessage, callback);
    }
    // Send message to blockchain
    wfApiBlockchain.sendMessage(wfMessage, function txBlockchainSendCb(err, wfMessage) {
        if (err) {
            // Retry again for auto generated messages
            if (
                wfMessage.MetaHeader.autoGenerated
                && !Object.prototype.hasOwnProperty.call(wfMessage.MetaHeader, 'transmissionSuccess')
            ) {
                wfMessage.MetaHeader.transmissionSuccess = false;
                setTimeout(txSendMessage, RETRYTIME, wfMessage, callback);
            }
            return wfTxEvent.emit('error', err, wfMessage, callback);
        }
        if (wfMessage.MetaHeader.transmissionSuccess === true) {
            return wfTxEvent.emit('messageSent', wfMessage, callback);
        }
        return wfTxEvent.emit('error', new Error('Message has not been sent for unknown reason'), wfMessage, callback);
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Checks message to transmit for critical metadata errors
 * @private
 * @param {wfMessage} wfMessage
 * @returns {array} message metaheader errors
 */
function checkTxMetaHeaderErrors(wfMessage) {
    let messageErrors = [];

    // Check metaheader
    if (!wfMessage.MetaHeader) {
        messageErrors.push('Missing metaheader');
        return messageErrors;
    }
    // Check blockchain and originator address
    if (!wfMessage.MetaHeader.blockchain) messageErrors.push('Blockchain not specified in metaheader');
    if (!wfMessage.MetaHeader.originatorAddress) messageErrors.push('Originator address not specified in metaheader');

    // Return error array
    return messageErrors;
}
