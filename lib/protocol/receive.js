'use strict';
/**
 * @module lib/protocol/receive
 * @summary Whiteflag message receive module
 * @description Module defining the message transmit and receive events chain
 * @tutorial modules
 * @tutorial protocol
 * @tutorial events
 */
module.exports = {
    init: initRx
};

// Type defintitions //
/**
 * @callback wfMessageCb
 * @param {error} err any error
 * @param {wfMessage} message the resulting Whiteflag message
 */

// Common internal functions and classes //
const log = require('../_common/logger');
const arr = require('../_common/arrays');
const { type } = require('./_common/messages');
const { noHexPrefix } = require('../_common/format');
const { ProtocolError } = require('../_common/errors');

// Whiteflag modules //
const wfState = require('./state');
const wfCodec = require('./codec');
const wfReference = require('./references');
const wfAuthenticate = require('./authenticate');
const wfRxEvent = require('./events').rxEvent;

// Whiteflag configuration data //
const wfConfigData = require('./config').getConfig();

// Module constants //
const MODULELOG = 'receive';
const MSGENCODING = 'hex';
const AUTHMESSAGECODE = 'A';
const CRYPTOMESSAGECODE = 'K';

/**
 * Initialises message receive event chain by binding events to listeners/handlers
 * This ensures the following RX events are executed in the right order:
 *  1.  'messageReceived'
 *  2.  'metadataVerified'
 *  3.  'messageEncrypted'
 *  4.  'messageDecoded'
 *  5.  'originatorVerified' / 'originatorSkipped'
 *  6.  'referenceVerified' / 'referenceSkipped'
 *  7.  'messageProcessed'
 * When an error occurs, the 'error' event is emitted.
 * @function init
 * @alias module:lib/protocol/receive.init
 * @param {errorCb} callback function called on completion
 * @emits module:lib/protocol/events.rxEvent:initialised
 */
function initRx(callback) {
    /**
     * Listener for incoming data from blockchain to call rx metadata verifier
     * @listens module:lib/protocol/events.rxEvent:messageReceived
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function passed to next event to call on completion
     */
    wfRxEvent.on('messageReceived', rxVerifyMetadata);
    /**
     * Listener for verified rx blockchain metadata to call rx message decoder
     * @listens module:lib/protocol/events.rxEvent:metadataVerified
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function passed to next event to call on completion
     */
    wfRxEvent.on('metadataVerified', rxDecodeMessage);
    /**
     * Listener for encrypted messages without initialisation vectors
     * @listens module:lib/protocol/events.rxEvent:messageEncrypted
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function passed to next event to call on completion
     */
    wfRxEvent.on('messageEncrypted', rxGetInitVector);
    /**
     * Listener for decoded messages to call originator verifier
     * @listens module:lib/protocol/events.rxEvent:messageDecoded
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function passed to next event to call on completion
     */
    wfRxEvent.on('messageDecoded', rxVerifyOriginator);
    /**
     * Listener for verified rx message originator to call reference verifier
     * @listens module:lib/protocol/events.rxEvent:originatorVerified
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function passed to next event to call on completion
     */
    wfRxEvent.on('originatorVerified', rxVerifyReference);
    /**
     * Listener for skipped rx message originator verification to call reference verifier
     * @listens module:lib/protocol/events.rxEvent:originatorSkipped
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function passed to next event to call on completion
     */
    wfRxEvent.on('originatorSkipped', rxVerifyReference);
    /**
     * Listener for verified rx message reference to call api response handler
     * @listens module:lib/protocol/events.rxEvent:referenceVerified
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function passed to next event to call on completion
     */
    wfRxEvent.on('referenceVerified', rxCompleted);
    /**
     * Listener for skipped rx message reference verificationto call api response handler
     * @listens module:lib/protocol/events.rxEvent:referenceSkipped
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function passed to next event to call on completion
     */
    wfRxEvent.on('referenceSkipped', rxCompleted);
    /**
     * Listener for rx completion to send message to socket clients
     * @listens module:lib/protocol/events.rxEvent:referenceVerified
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function passed to next event to call on completion
     */
    wfRxEvent.on('messageProcessed', rxSocketSendMessage);
    /**
     * Listener for rx completion to call callback
     * @listens module:lib/protocol/events.rxEvent:messageProcessed
     * @param {Error} err any error
     * @param {wfMessage} wfMessage a Whiteflag message
     * @param {wfMessageCb} callback function called on error
     */
    wfRxEvent.on('error', rxError);

    // Invoke callback after binding all events to listeners/handlers
    wfRxEvent.emit('initialised');
    if (callback) return callback(null);
}

// PRIVATE RX EVENT HANDLERS //
/**
 * Logs success and calls the callback passed through the rx event chain
 * @private
 * @param {Error} err any error
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function called on completion
 * @emits module:lib/protocol/events.rxEvent:messageProcessed
 */
function rxCompleted(wfMessage, callback) {
    log.debug(MODULELOG, `Successfully processed incoming ${type(wfMessage)} message: ` + JSON.stringify(wfMessage));
    wfRxEvent.emit('messageProcessed', wfMessage);
    if (callback) return callback(null, wfMessage);
}

/**
 * Logs errors and calls the callback passed through the rx event chain
 * @private
 * @param {Error} err any error
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function called on completion
 */
function rxError(err, wfMessage, callback) {
    if (!err) err = new Error('Unspecified error in rx event chain');
    const { MetaHeader: meta } = wfMessage;

    // Log the error based on the available information
    let msgStr = '';
    let msgType = '';
    if (wfMessage?.MetaHeader) {
        if (wfMessage?.MessageHeader) msgType = type(wfMessage) + ' ';
        if (meta.transactionHash) {
            msgStr = ' ' + meta.transactionHash + ':';
        } else {
            msgStr = ' ' + JSON.stringify(meta) + ':';
        }
    }
    if (err instanceof ProtocolError) {
        if (err.causes) {
            log.debug(MODULELOG, `Could not process ${msgType}message:` + `${msgStr} ${err.message}: ` + JSON.stringify(err.causes));
        } else {
            log.debug(MODULELOG, `Could not process ${msgType}message:` + `${msgStr} ${err.message}`);
        }
    } else {
        log.error(MODULELOG, `Error processing ${msgType}message:` + `${msgStr} ${err.message}`);
    }
    // Finally, call the callback function passing the error
    if (callback) return callback(err, wfMessage);
}

/**
 * Checks incoming rx data and emits positive result
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.rxEvent:metadataVerified
 */
function rxVerifyMetadata(wfMessage, callback) {
    // Check incoming message for critical metadata errors
    let msgErrors = checkRxMetaHeaderErrors(wfMessage);
    if (msgErrors.length > 0) {
        return wfRxEvent.emit('error', new ProtocolError('Invalid message metaheader', msgErrors, 'WF_METAHEADER_ERROR'), wfMessage, callback);
    }
    let { MetaHeader: meta } = wfMessage;

    // Set transceive direction and transaction time
    meta.transceiveDirection = 'RX';

    /*
    *  Messages are given a transactionTime, which is the time of earliest known existence;
    *  if the blockchain does not provide a time (e.g. blocktime or transaction time),
    *  the receive function gives it a timestamp if the message is on a blockchain.
    */
    if (!meta.transactionTime) {
        meta.transactionTime = new Date().toISOString();
    }
    // Emit event upon completion and pass data
    return wfRxEvent.emit('metadataVerified', wfMessage, callback);
}

/**
 * Calls message decoder and emits positive result
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.rxEvent:messageEncrypted
 * @emits module:lib/protocol/events.rxEvent:messageDecoded
 */
function rxDecodeMessage(wfMessage, callback) {
    let { MetaHeader: meta } = wfMessage;

    // Calls message decoder and emits positive result
    wfState.getBlockchainData(meta.blockchain, function rxGetBlockchainAddressesCb(err, bcState) {
        if (err) return wfRxEvent.emit('error', err, wfMessage, callback);

        // Get accounts for this blockchain
        let accounts;
        if (!bcState?.accounts) {
            accounts = [];
        } else {
            accounts = bcState.accounts;
        }
        // Kick-off first decryption/decoding iteration
        meta.recipientAddress = null;
        log.trace(MODULELOG, `Trying to decode/decrypt message ${meta.transactionHash}`);
        rxDecodeIterate(accounts, 0);
    });

    /**
     * Tries to decrypt and decode message, and retries with different key if cannot decrypt
     * @private
     * @param {Array} accounts All accounts on a blockchain
     * @param {number} a Account counter
     */
    function rxDecodeIterate(accounts = [], a = 0) {
        // Call message decoder and check result
        wfCodec.decode(wfMessage, function rxDecodeCb(err, wfMessage, ivMissing) {
            if (ivMissing) return wfRxEvent.emit('messageEncrypted', wfMessage, callback);
            if (err) {
                meta.recipientAddress = null;
                if (err instanceof ProtocolError && err.code === 'WF_ENCRYPTION_ERROR') {
                    if (meta.encryptionKeyInput || a < 0) {
                        meta.encryptionKeyInput = null;
                        return wfRxEvent.emit('error', err, wfMessage, callback);
                    }
                    if (a >= accounts.length) {
                        // None of the keys from the different accounts were valid
                        // Try with test key from config file
                        log.trace(MODULELOG, `Trying key from config file to decrypt message ${meta.transactionHash}`);
                        meta.encryptionKeyInput = wfConfigData.encryption.psk;
                        return rxDecodeIterate(accounts, -1);
                    }
                    // Try next recipient address to look up possible key
                    log.trace(MODULELOG, `Trying key ${(a + 1)}/${accounts.length} for receiving account ${accounts[a].address} to decrypt message ${meta.transactionHash}`);
                    meta.recipientAddress = accounts[a].address;
                    return rxDecodeIterate(accounts, (a + 1));
                }
                return wfRxEvent.emit('error', err, wfMessage, callback);
            }
            // Clean up meta header
            if (meta.recipientAddress === null) {
                delete meta.recipientAddress;
            }
            if (meta.encryptionKeyInput) {
                meta.encryptionKeyInput = null;
                delete meta.encryptionKeyInput;
            }
            return wfRxEvent.emit('messageDecoded', wfMessage, callback);
        });
    }
}

/**
 * Checks if initialisation vector is known, otherwise puts encrypted message in datastore
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.rxEvent:metadataVerified
 */
function rxGetInitVector(wfMessage, callback) {
    const { MetaHeader: meta } = wfMessage;
    wfState.getQueueData('initVectors', 'referencedMessage', meta.transactionHash, function rxGetInitVectorQueueCb(err, ivObject) {
        if (err) log.error(MODULELOG, `Error getting initialisation vector from queue: ${err.message}`);
        if (ivObject) {
            // Initialisation vector found
            log.trace(MODULELOG, 'Found initialisation vector on queue for incoming encrypted message: ' + JSON.stringify(meta.transactionHash));
            meta.encryptionInitVector = ivObject.initVector;
            wfState.removeQueueData('initVectors', 'referencedMessage', meta.transactionHash);
            return wfRxEvent.emit('metadataVerified', wfMessage, callback);
        }
        // No iv available yet, so done processing encrypted message for now
        log.debug(MODULELOG, `Received encrypted message (method ${wfMessage.MessageHeader.EncryptionIndicator}) without initialisation vector: ` + JSON.stringify(meta));
        wfRxEvent.emit('messageProcessed', wfMessage);
        if (callback) return callback(null, wfMessage);
    });
}

/**
 * Calls originator verifier
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.rxEvent:originatorVerified
 */
function rxVerifyOriginator(wfMessage, callback) {
    let { MetaHeader: meta } = wfMessage;

    // Skip reference check for incoming message if configured
    if (!wfConfigData.rx.verifyOriginator) {
        return wfRxEvent.emit('originatorSkipped', wfMessage, callback);
    }
    // Check for messages for which originator cannot be verified
    switch (wfMessage.MessageHeader.MessageCode) {
        case AUTHMESSAGECODE: {
            // Authentication messages are self-authenticating
            return wfRxEvent.emit('originatorSkipped', wfMessage, callback);
        }
        default: break;
    }
    // Verify orginiator
    wfAuthenticate.message(wfMessage, function rxVerifyOriginatorCb(err, wfMessage) {
        // Check for orginiator authentication errors
        if (err && err instanceof ProtocolError) {
            // Drop message if strict authentication and originator not valid
            if (err.code === 'WF_AUTH_ERROR' && wfConfigData.authentication.strict) {
                return wfRxEvent.emit('error', err, wfMessage, callback);
            }
            // Log and preserve orginiator verification errors in metaheader
            if (err.causes) {
                log.trace(MODULELOG, `Could not verify originator of ${type(wfMessage)} message ${meta.transactionHash}: ${err.message}: ` + JSON.stringify(err.causes));
                meta.validationErrors = arr.addArray(meta.validationErrors, err.causes);
            } else {
                log.trace(MODULELOG, `Could not verify originator of ${type(wfMessage)} message ${meta.transactionHash}: ${err.message}`);
            }
        }
        // Log general originator verification error
        if (err && !(err instanceof ProtocolError)) log.trace(MODULELOG, `Could not verify originator of ${type(wfMessage)} message ${meta.transactionHash}: ${err.message}`);

        // Completed authentication check
        return wfRxEvent.emit('originatorVerified', wfMessage, callback);
    });
}

/**
 * Calls reference verifier
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.rxEvent:referenceVerified
 */
function rxVerifyReference(wfMessage, callback) {
    // Skip reference check for incoming message if configured
    if (!wfConfigData.rx.verifyReference) {
        return wfRxEvent.emit('referenceSkipped', wfMessage, callback);
    }
    // Check for messages of which references cannot be verified
    switch (wfMessage.MessageHeader.MessageCode) {
        case CRYPTOMESSAGECODE: {
            switch (wfMessage.MessageBody.CryptoDataType) {
                case '11':
                case '21': {
                    // Initialisation vectors that point to encrypted messages,
                    // which are not yet decrypted, cannot be reference checked
                    if (wfMessage.MessageHeader.ReferenceIndicator === '3') {
                        return wfRxEvent.emit('referenceSkipped', wfMessage, callback);
                    }
                    break;
                }
                default: break;
            }
            break;
        }
        default: break;
    }
    // Verify references
    wfReference.verify(wfMessage, function rxVerifyReferenceCb(err, wfMessage) {
        let { MetaHeader: meta } = wfMessage;
        if (err && err instanceof ProtocolError) {
            // Log and preserve reference errors in metaheader
            if (err.causes) {
                log.trace(MODULELOG, `Invalid reference in ${type(wfMessage)} message ${meta.transactionHash}: ${err.message}: ` + JSON.stringify(err.causes));
                meta.validationErrors = arr.addArray(meta.validationErrors, err.causes);
            } else {
                log.trace(MODULELOG, `Invalid reference in ${type(wfMessage)} message ${meta.transactionHash}: ${err.message}`);
            }
        }
        // Log general reference verification error
        if (err && !(err instanceof ProtocolError)) log.trace(MODULELOG, `Could not verify reference of ${type(wfMessage)} message ${meta.transactionHash}: ${err.message}`);

        // Completed reference check
        return wfRxEvent.emit('referenceVerified', wfMessage, callback);
    });
}

/**
 * Calls function to send message to all listening socket clients asynchronously
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 */
function rxSocketSendMessage(wfMessage) {
    const wfServer = require('../server');
    return wfServer.sendSocket(wfMessage);
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Checks received message for critical metadata errors
 * @private
 * @param {wfMessage} wfMessage
 * @returns {Array} message metaheader errors
 */
function checkRxMetaHeaderErrors(wfMessage) {
    let msgErrors = [];
    if (!wfMessage?.MetaHeader) {
        msgErrors.push('Missing metaheader');
        return msgErrors;
    }
    const { MetaHeader: meta } = wfMessage;

    // Check blockchain
    if (!meta.blockchain) msgErrors.push('Originating blockchain not specified');

    // Check transaction hash
    if (!meta.transactionHash) {
        msgErrors.push('Transaction hash is missing');
    } else {
        meta.transactionHash = noHexPrefix(meta.transactionHash).toLowerCase();
    }
    // Check encoded message
    if (!meta.encodedMessage) {
        msgErrors.push('Encoded message is missing');
    } else {
        meta.encodedMessage = noHexPrefix(meta.encodedMessage).toLowerCase();
        if (MSGENCODING === 'hex' && (meta.encodedMessage.length % 2) !== 0) {
            msgErrors.push(`Encoded message does not have a valid ${MSGENCODING} encoding`);
        }
    }
    // Check originator address
    if (!meta.originatorAddress) {
        msgErrors.push('Originator address is missing');
    }
    // Check public key, unless own message is received
    if (!meta.originatorPubKey) {
        if (meta.transceiveDirection !== 'TX') {
            log.warn(MODULELOG, `Public key of originator is missing for message: ${meta.transactionHash}`);
        }
    } else {
        meta.originatorPubKey = noHexPrefix(meta.originatorPubKey).toLowerCase();
    }
    // Return error array
    return msgErrors;
}
