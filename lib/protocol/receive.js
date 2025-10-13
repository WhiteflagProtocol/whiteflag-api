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
const { type } = require('../_common/messages');
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

    // Log the error based on the available information
    let messageStr = '';
    let messageType = '';
    if (wfMessage?.MetaHeader) {
        if (wfMessage.MessageHeader) messageType = type(wfMessage) + ' ';
        if (wfMessage.MetaHeader.transactionHash) {
            messageStr = ' ' + wfMessage.MetaHeader.transactionHash + ':';
        } else {
            messageStr = ' ' + JSON.stringify(wfMessage.MetaHeader) + ':';
        }
    }
    if (err instanceof ProtocolError) {
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
 * Checks incoming rx data and emits positive result
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function passed to next event to call on completion
 * @emits module:lib/protocol/events.rxEvent:metadataVerified
 */
function rxVerifyMetadata(wfMessage, callback) {
    // Check incoming message for critical metadata errors
    let messageErrors = checkRxMetaHeaderErrors(wfMessage);
    if (messageErrors.length > 0) {
        return wfRxEvent.emit('error', new ProtocolError('Invalid message metaheader', messageErrors, 'WF_METAHEADER_ERROR'), wfMessage, callback);
    }
    // Set transceive direction and transaction time
    wfMessage.MetaHeader.transceiveDirection = 'RX';

    /*
    *  Messages are given a transactionTime, which is the time of earliest known existence;
    *  if the blockchain does not provide a time (e.g. blocktime or transaction time),
    *  the receive function gives it a timestamp if the message is on a blockchain.
    */
    if (!wfMessage.MetaHeader.transactionTime) {
        wfMessage.MetaHeader.transactionTime = new Date().toISOString();
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
    // Calls message decoder and emits positive result
    wfState.getBlockchainData(wfMessage.MetaHeader.blockchain, function rxGetBlockchainAddressesCb(err, bcState) {
        if (err) return wfRxEvent.emit('error', err, wfMessage, callback);

        // Get accounts for this blockchain
        let accounts;
        if (!bcState?.accounts) {
            accounts = [];
        } else {
            accounts = bcState.accounts;
        }
        // Kick-off first decryption/decoding iteration
        wfMessage.MetaHeader.recipientAddress = null;
        log.trace(MODULELOG, `Trying to decode/decrypt message ${wfMessage.MetaHeader.transactionHash}`);
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
                wfMessage.MetaHeader.recipientAddress = null;
                if (err instanceof ProtocolError && err.code === 'WF_ENCRYPTION_ERROR') {
                    if (wfMessage.MetaHeader.encryptionKeyInput || a < 0) {
                        wfMessage.MetaHeader.encryptionKeyInput = null;
                        return wfRxEvent.emit('error', err, wfMessage, callback);
                    }
                    if (a >= accounts.length) {
                        // None of the keys from the different accounts were valid
                        // Try with test key from config file
                        log.trace(MODULELOG, `Trying key from config file to decrypt message ${wfMessage.MetaHeader.transactionHash}`);
                        wfMessage.MetaHeader.encryptionKeyInput = wfConfigData.encryption.psk;
                        return rxDecodeIterate(accounts, -1);
                    }
                    // Try next recipient address to look up possible key
                    log.trace(MODULELOG, `Trying key ${(a + 1)}/${accounts.length} for receiving account ${accounts[a].address} to decrypt message ${wfMessage.MetaHeader.transactionHash}`);
                    wfMessage.MetaHeader.recipientAddress = accounts[a].address;
                    return rxDecodeIterate(accounts, (a + 1));
                }
                return wfRxEvent.emit('error', err, wfMessage, callback);
            }
            // Clean up meta header
            if (wfMessage.MetaHeader.recipientAddress === null) {
                delete wfMessage.MetaHeader.recipientAddress;
            }
            if (wfMessage.MetaHeader.encryptionKeyInput) {
                wfMessage.MetaHeader.encryptionKeyInput = null;
                delete wfMessage.MetaHeader.encryptionKeyInput;
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
    wfState.getQueueData('initVectors', 'referencedMessage', wfMessage.MetaHeader.transactionHash, function rxGetInitVectorQueueCb(err, ivObject) {
        if (err) log.error(MODULELOG, `Error getting initialisation vector from queue: ${err.message}`);
        if (ivObject) {
            // Initialisation vector found
            log.trace(MODULELOG, 'Found initialisation vector on queue for incoming encrypted message: ' + JSON.stringify(wfMessage.MetaHeader.transactionHash));
            wfMessage.MetaHeader.encryptionInitVector = ivObject.initVector;
            wfState.removeQueueData('initVectors', 'referencedMessage', wfMessage.MetaHeader.transactionHash);
            return wfRxEvent.emit('metadataVerified', wfMessage, callback);
        }
        // No iv available yet, so done processing encrypted message for now
        log.debug(MODULELOG, `Received encrypted message (method ${wfMessage.MessageHeader.EncryptionIndicator}) without initialisation vector: ` + JSON.stringify(wfMessage.MetaHeader));
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
                log.trace(MODULELOG, `Could not verify originator of ${type(wfMessage)} message ${wfMessage.MetaHeader.transactionHash}: ${err.message}: ` + JSON.stringify(err.causes));
                wfMessage.MetaHeader.validationErrors = arr.addArray(wfMessage.MetaHeader.validationErrors, err.causes);
            } else {
                log.trace(MODULELOG, `Could not verify originator of ${type(wfMessage)} message ${wfMessage.MetaHeader.transactionHash}: ${err.message}`);
            }
        }
        // Log general originator verification error
        if (err && !(err instanceof ProtocolError)) log.trace(MODULELOG, `Could not verify originator of ${type(wfMessage)} message ${wfMessage.MetaHeader.transactionHash}: ${err.message}`);

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
        // Check for reference errors
        if (err && err instanceof ProtocolError) {
            // Log and preserve reference errors in metaheader
            if (err.causes) {
                log.trace(MODULELOG, `Invalid reference in ${type(wfMessage)} message ${wfMessage.MetaHeader.transactionHash}: ${err.message}: ` + JSON.stringify(err.causes));
                wfMessage.MetaHeader.validationErrors = arr.addArray(wfMessage.MetaHeader.validationErrors, err.causes);
            } else {
                log.trace(MODULELOG, `Invalid reference in ${type(wfMessage)} message ${wfMessage.MetaHeader.transactionHash}: ${err.message}`);
            }
        }
        // Log general reference verification error
        if (err && !(err instanceof ProtocolError)) log.trace(MODULELOG, `Could not verify reference of ${type(wfMessage)} message ${wfMessage.MetaHeader.transactionHash}: ${err.message}`);

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
    let messageErrors = [];
    if (!wfMessage.MetaHeader) {
        messageErrors.push('Missing metaheader');
        return messageErrors;
    }
    // Check blockchain
    if (!wfMessage.MetaHeader.blockchain) messageErrors.push('Originating blockchain not specified');

    // Check transaction hash
    if (!wfMessage.MetaHeader.transactionHash) {
        messageErrors.push('Transaction hash is missing');
    } else {
        wfMessage.MetaHeader.transactionHash = noHexPrefix(wfMessage.MetaHeader.transactionHash).toLowerCase();
    }
    // Check encoded message
    if (!wfMessage.MetaHeader.encodedMessage) {
        messageErrors.push('Encoded message is missing');
    } else {
        wfMessage.MetaHeader.encodedMessage = noHexPrefix(wfMessage.MetaHeader.encodedMessage).toLowerCase();
        if (MSGENCODING === 'hex' && (wfMessage.MetaHeader.encodedMessage.length % 2) !== 0) {
            messageErrors.push(`Encoded message does not have a valid ${MSGENCODING} encoding`);
        }
    }
    // Check originator address
    if (!wfMessage.MetaHeader.originatorAddress) {
        messageErrors.push('Originator address is missing');
    }
    // Check public key, unless own message is received
    if (!wfMessage.MetaHeader.originatorPubKey) {
        if (wfMessage.MetaHeader.transceiveDirection !== 'TX') {
            log.warn(MODULELOG, `Public key of originator is missing for message: ${wfMessage.MetaHeader.transactionHash}`);
        }
    } else {
        wfMessage.MetaHeader.originatorPubKey = noHexPrefix(wfMessage.MetaHeader.originatorPubKey).toLowerCase();
    }
    // Return error array
    return messageErrors;
}
