'use strict';
/**
 * @module  lib/protocol/management
 * @summary Whiteflag protocol management module
 * @description Module for the processing of Whiteflag management messages
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    init: initManagement
};

// Common internal functions and classes //
const log = require('../_common/logger');
const { hash } = require('../_common/crypto');
const { type } = require('./_common/messages');
const { ProcessingError, ProtocolError } = require('../_common/errors');

// Whiteflag modules //
const wfState = require('./state');
const wfCrypto = require('./crypto');
const wfRetrieve = require('./retrieve');
const wfAuthenticate = require('./authenticate');
const wfRxEvent = require('./events').rxEvent;
const wfTxEvent = require('./events').txEvent;

// Module constants //
const MODULELOG = 'protocol';
const KEYIDLENGTH = 12;
const AUTHMESSAGECODE = 'A';
const CRYPTOMESSAGECODE = 'K';
const IV1DATATYPE = '11';
const IV2DATATYPE = '21';
const ECDHPUBKEYDATATYPE = '0A';

/**
 * Initialises processing of management messages
 * @function init
 * @alias module:lib/protocol/management.init
 * @param {errorCb} callback function called on completion
 */
function initManagement(callback) {
    /**
     * Listener for received management messages
     * @listens module:lib/protocol/receive.rxEvent:messageProcessed
     * @param {wfMessage} wfMessage a Whiteflag message
     */
    wfRxEvent.on('messageProcessed', receivedMessage);
    /**
     * Listener for encrypted messages without initialisation vectors
     * @listens module:lib/protocol/events.rxEvent:messageSent
     * @param {wfMessage} wfMessage a Whiteflag message
     */
    wfTxEvent.on('messageProcessed', sentMessage);

    // Invoke callback after binding all events to listeners/handlers
    return callback(null);
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Passes received management messages to correct handlers
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 */
function receivedMessage(wfMessage) {
    const { MessageHeader: header,
            MessageBody: body } = wfMessage;

    // Check required actions for received message types
    switch (header.MessageCode) {
        case AUTHMESSAGECODE: {
            receiveAuthenticationData(wfMessage);
            return;
        }
        case CRYPTOMESSAGECODE: {
            switch (body.CryptoDataType) {
                case IV1DATATYPE:
                case IV2DATATYPE: {
                    // Initialisation Vector for Encryption Types 1 and 2
                    receiveInitVector(wfMessage);
                    return;
                }
                case ECDHPUBKEYDATATYPE: {
                    // ECDH Public Key
                    receiveECDHpublicKey(wfMessage);
                    return;
                }
                default: break;
            }
            return;
        }
        default: return;
    }
}

/**
 * Triggers correct management message handlers after a message has been sent
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 */
function sentMessage(wfMessage) {
    switch (wfMessage.MessageHeader.MessageCode) {
        case AUTHMESSAGECODE: {
            // Send ECDH public key after an authentication message
            sendECDHpublicKey(wfMessage);
        }
        default: {
            // All messages require init vector if encrypted
            sendInitVector(wfMessage);
        }
    }
}

// MANAGEMENT MESSAGE HANDLER FUNCTIONS //
/**
 * Processes received authentication message for verification method 1
 * @private
 * @param {wfMessage} wfAuthMessage Whiteflag authentication message
 * @emits module:lib/protocol/events.rxEvent:messageUpdated
 */
function receiveAuthenticationData(wfAuthMessage) {
    const { MetaHeader: meta,
            MessageHeader: header } = wfAuthMessage;

    // Determine reference indicator of authentication message
    switch (header.ReferenceIndicator) {
        case '0':
        case '2': {
            // Original and update message
            log.trace(MODULELOG, `Received ${type(wfAuthMessage)} message: Verifying originator authentication data`);
            wfAuthenticate.verify(wfAuthMessage, function mgmtVerifyAuthCb(err, wfAuthMessage) {
                if (err) {
                    if (err instanceof ProtocolError) {
                        if (err.causes) {
                            log.debug(MODULELOG, `Could not verify received ${type(wfAuthMessage)} message ${meta.transactionHash}: ${err.message}: ` + JSON.stringify(err.causes));
                        } else {
                            log.debug(MODULELOG, `Could not verify received ${type(wfAuthMessage)} message ${meta.transactionHash}: ${err.message}`);
                        }
                    } else {
                        log.warn(MODULELOG, `Could not verify received ${type(wfAuthMessage)} message ${meta.transactionHash}: ${err.message}`);
                    }
                }
                wfRxEvent.emit('messageUpdated', wfAuthMessage);
            });
            return;
        }
        case '1':
        case '4': {
            // Recall and discontinue message
            log.trace(MODULELOG, `Received ${type(wfAuthMessage)} message: Removing originator authentication data`);
            wfAuthenticate.remove(wfAuthMessage, function mgmtRemoveAuthCb(err, wfAuthMessage) {
                if (err) {
                    if (err instanceof ProtocolError) {
                        if (err.causes) {
                            log.debug(MODULELOG, `Could not verify received ${type(wfAuthMessage)} message ${meta.transactionHash}: ${err.message}: ` + JSON.stringify(err.causes));
                        } else {
                            log.debug(MODULELOG, `Could not verify received ${type(wfAuthMessage)} message ${meta.transactionHash}: ${err.message}`);
                        }
                    } else {
                        log.warn(MODULELOG, `Could not update originator state after receiving ${type(wfAuthMessage)} message ${meta.transactionHash}: ${err.message}`);
                    }
                }
                wfRxEvent.emit('messageUpdated', wfAuthMessage);
            });
            return;
        }
        case '3': {
            // Additional information is currently not implemented
            return;
        }
        default: return;
    }
}

/**
 * Processes received initialisation vector
 * @private
 * @param {wfMessage} wfCryptoMessage Whiteflag crypto message with initialisation vector
 */
function receiveInitVector(wfCryptoMessage) {
    const { 
        MetaHeader: {
            blockchain: blockchain,
            transactionHash: cryptoMessageHash },
        MessageHeader: {
            ReferenceIndicator: refIndicator,
            ReferencedMessage: refMessageHash },
        MessageBody: {
            CryptoData: initVector }} =  wfCryptoMessage;

    // Determine reference indicator of crypto message
    switch (refIndicator) {
        case '0': {
            // Original: stand-alone iv does nothing
            break;
        }
        case '1':
        case '4': {
            // Recall or Discontinue: remove iv from queue
            log.trace(MODULELOG, `Received ${type(wfCryptoMessage)} message ${cryptoMessageHash}: Removing initialisation vector from queue`);
            wfState.removeQueueData('initVectors', 'transactionHash', refMessageHash);
            break;
        }
        case '2': {
            // Update iv if on queue
            log.trace(MODULELOG, `Received ${type(wfCryptoMessage)} message ${cryptoMessageHash}: Updating initialisation vector on queue`);
            wfState.getQueueData('initVectors', 'transactionHash', refMessageHash, function mgmtUpdateInitVectorCb(err, ivObject) {
                if (err) log.warn(MODULELOG, `Error getting initialisation vector from queue: ${err.message}`);
                if (ivObject) {
                    ivObject.initVector = initVector;
                    wfState.upsertQueueData('initVectors', 'transactionHash', ivObject);
                }
            });
            break;
        }
        case '3': {
            // Add: iv is part of the encrypted message it references
            log.trace(MODULELOG, `Received ${type(wfCryptoMessage)} message ${cryptoMessageHash} with initialisation vector`);
            wfRetrieve.getMessage(refMessageHash, blockchain, function mgmtGetMessageInitVectorCb(err, wfMessages) {
                if (err && !(err instanceof ProcessingError)) {
                    log.warn(MODULELOG, `${err.message}`);
                }

                // No message found; put iv on queue
                if (!wfMessages || !Array.isArray(wfMessages) || wfMessages.length === 0) {
                    const ivObject = {
                        cryptoMessageHash,
                        refMessageHash,
                        initVector
                    };
                    wfState.upsertQueueData('initVectors', 'refMessage', ivObject);
                    log.trace(MODULELOG, `Initialisation vector for message ${refMessageHash} put on queue: ` + JSON.stringify(ivObject));
                    return;
                }
                // Found message in database or on blockchain
                if (wfMessages.length > 0) {
                    const wfMessage = wfMessages[0];
                    let { MetaHeader: meta } = wfMessage;

                    // No need to decrypt if messages is sent and already has an init vector
                    if (
                        meta.transceiveDirection === 'TX'
                        && meta.encryptionInitVector
                    ) {
                        return;
                    }
                    // Add initialistion vector to message and trigger further processing
                    log.trace(MODULELOG, `Found encrypted message matching incoming initialisation vector: ${meta.transactionHash}`);
                    meta.encryptionInitVector = initVector;
                    return wfRxEvent.emit('messageReceived', wfMessage);
                }
            });
            break;
        }
        default: return;
    }
}

/**
 * Sends an initialisation vector after an encrypted message
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @emits _txEvent:messageCommitted
 */
function sendInitVector(wfMessage) {
    const { MetaHeader: meta,
            MessageHeader: header } = wfMessage;

    // Check encryption indicator
    let cryptoDataType;
    switch (header.EncryptionIndicator) {
        case '1': {
            cryptoDataType = IV1DATATYPE;
            break;
        }
        case '2': {
            cryptoDataType = IV2DATATYPE;
            break;
        }
        default: return;
    }
    // Check initialisation vector and build K message
    if (meta.encryptionInitVector) {
        const wfCryptoMessage = {
            'MetaHeader': {
                'autoGenerated': true,
                'blockchain': meta.blockchain,
                'originatorAddress': meta.originatorAddress
            },
            'MessageHeader': {
                'Prefix': 'WF',
                'Version': header.Version,
                'EncryptionIndicator': '0',
                'DuressIndicator': '0',
                'MessageCode': CRYPTOMESSAGECODE,
                'ReferenceIndicator': '3',
                'ReferencedMessage': meta.transactionHash
            },
            'MessageBody': {
                'CryptoDataType': cryptoDataType,
                'CryptoData': meta.encryptionInitVector
            }
        };
        // Commit the crypto message to the tx event chain
        log.debug(MODULELOG, `Sending ${type(wfCryptoMessage)} message with initialisation vector for ${type(wfMessage)} message: ${meta.transactionHash}`);
        return wfTxEvent.emit('messageCommitted', wfCryptoMessage);
    }
}

/**
 * Processes received ECDH public key
 * @private
 * @param {wfMessage} wfCryptoMessage Whiteflag crypto message with ECDH public key
 */
function receiveECDHpublicKey(wfCryptoMessage) {
    const { 
        MetaHeader: {
            blockchain: blockchain,
            transactionHash: cryptoMessageHash,
            originatorAddress: orgAddress },
        MessageHeader: {
            ReferenceIndicator: refIndicator },
        MessageBody: {
            CryptoData: orgECDHpubKey }} =  wfCryptoMessage;

    wfState.getOriginatorData(orgAddress, function mgmtGetOriginatorCb(err, originator) {
        if (err) return log.error(MODULELOG, `Received ${type(wfCryptoMessage)} message ${cryptoMessageHash} but could not get originator state to compute shared secret: ${err.message}`);

        // Check reference indicator
        switch (refIndicator) {
            case '0':
            case '2': {
                // Store the ECDH public key
                log.trace(MODULELOG, `Received ${type(wfCryptoMessage)} message ${cryptoMessageHash} with ECDH public key from address ${orgAddress}`);
                if (originator) {
                    // Known origintaor
                    originator.ecdhPublicKey = orgECDHpubKey;
                    wfState.upsertOriginatorData(originator);
                } else {
                    // Unknown originator
                    const newOriginator = {
                        name: '',
                        blockchain: blockchain,
                        address: orgAddress,
                        publicKey: null,
                        ecdhPublicKey: orgECDHpubKey,
                        url: null,
                        authTokenId: '',
                        authValid: false,
                        authMessages: []
                    };
                    wfState.upsertOriginatorData(newOriginator);
                }
                break;
            }
            case '1':
            case '4': {
                // Remove the ECDH public key if originator is known
                log.trace(MODULELOG, `Received ${type(wfCryptoMessage)} message ${cryptoMessageHash} to remove ECDH public key from address ${orgAddress}`);
                if (originator) {
                    originator.ecdhPublicKey = null;
                    wfState.upsertOriginatorData(originator);
                }
                return;
            }
            default: return;
        }
        // Get accounts for this blockchain and generate a shared secret for each
        wfState.getBlockchainData(blockchain, function mgmtGetBlockchainDataCb(err, bcState) {
            if (!err && !bcState) err = new Error(`Blockchain ${blockchain} does not exist in state`);
            if (err) return log.error(MODULELOG, `Could not retrieve ${blockchain} state to compute shared secrets: ${err.message}`);

            bcState.accounts.forEach(account => {
                generateECDHsecret(blockchain, account.address, orgAddress, orgECDHpubKey);
            });
        });
    });
}

/**
 * Sends an ECDH public key after an authentication message
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @emits _txEvent:messageCommitted
 */
function sendECDHpublicKey(wfAuthMessage) {
    let newKeyPair = false;

    // Do not send ECDH public key after encyrpted or duress A message
    if (wfAuthMessage.MessageHeader.EncryptionIndicator !== '0') {
        return log.debug(MODULELOG, `Not sending ECDH public key after encrypted ${type(wfAuthMessage)} message: ${wfAuthMessage.MetaHeader.transactionHash}`);
    }
    if (wfAuthMessage.MessageHeader.DuressIndicator !== '0') {
        return log.debug(MODULELOG, `Not sending ECDH public key after ${type(wfAuthMessage)} message under duress: ${wfAuthMessage.MetaHeader.transactionHash}`);
    }
    // Check reference indicator
    switch (wfAuthMessage.MessageHeader.ReferenceIndicator) {
        case '0': {
            // An original authentication message resends the ECDH public key if already existing
            newKeyPair = false;
            break;
        }
        case '2': {
            // A message with updated authentication information triggers to renew the ECDH key pair
            newKeyPair = true;
            break;
        }
        default: return;
    }
    // Get own ECDH public key for this blockchain account
    const blockchain = wfAuthMessage.MetaHeader.blockchain;
    const address = wfAuthMessage.MetaHeader.originatorAddress;
    const ecdhId = hash(blockchain + address, KEYIDLENGTH);
    wfCrypto.getECDHpublicKey(ecdhId, newKeyPair, function mgmtGetMessageInitVectorCb(err, ecdhPublicKey, newKey) {
        if (err) return log.error(MODULELOG, `Could not get and send ECDH public key for account ${address}: ${err.message}`);

        // Build K message
        const wfCryptoMessage = {
            'MetaHeader': {
                'autoGenerated': true,
                'blockchain': wfAuthMessage.MetaHeader.blockchain,
                'originatorAddress': wfAuthMessage.MetaHeader.originatorAddress
            },
            'MessageHeader': {
                'Prefix': 'WF',
                'Version': wfAuthMessage.MessageHeader.Version,
                'EncryptionIndicator': wfAuthMessage.MessageHeader.EncryptionIndicator,
                'DuressIndicator': wfAuthMessage.MessageHeader.DuressIndicator,
                'MessageCode': CRYPTOMESSAGECODE,
                'ReferenceIndicator': '0',
                'ReferencedMessage': wfAuthMessage.MetaHeader.transactionHash
            },
            'MessageBody': {
                'CryptoDataType': ECDHPUBKEYDATATYPE,
                'CryptoData': ecdhPublicKey
            }
        };
        // Commit the crypto message to the tx event chain
        log.debug(MODULELOG, `Sending ${type(wfCryptoMessage)} message with ECDH public key after ${type(wfAuthMessage)} message: ${wfAuthMessage.MetaHeader.transactionHash}`);
        wfTxEvent.emit('messageCommitted', wfCryptoMessage, mgmtSendECDHpubKeyCb);
    });
    /**
     * Computes new secrets after sending new ECDH public key
     * @callback
     * @param {Error} err any error
     * @returns 
     */
    function mgmtSendECDHpubKeyCb(err) {
        // Only compute new secrets when newly generated key pair
        if (!newKey && !err) return;
        if (err) {
            if (newKey) return log.error(MODULELOG, `Not computing new shared secrets: ${type(wfCryptoMessage)} message not sent after renewed ECDH key pair: ${err.message}`);
            return log.warn(MODULELOG, `Could not send ${type(wfCryptoMessage)} message: ${err.message}`);
        }
        // Check ECDH public keys from known originators and calculate shared secrets
        wfState.getOriginators(function mgmtGetECDHoriginatorsCb(err, originators) {
            if (err) return log.error(MODULELOG, `Could not get originator state to compute shared secrets: ${err.message}`);
            originators.forEach(originator => {
                if (originator.ecdhPublicKey && originator.blockchain === blockchain) {
                    generateECDHsecret(blockchain, address, originator.address, originator.ecdhPublicKey);
                }
            });
        });
    }
}

/**
 * Generates an ECDH shared secret
 * @private
 * @param {string} blockchain the blockchain name
 * @param {string} address the blockchain account to generate the secret for
 * @param {string} orgAddress the address of the other originator
 * @param {string} orgECDHpubKey the ECDH public key of the other originator
 */
function generateECDHsecret(blockchain, address, orgAddress, orgECDHpubKey) {
    const ecdhId = hash(blockchain + address, KEYIDLENGTH);
    wfCrypto.generateECDHsecret(ecdhId, orgECDHpubKey, function mgmtGenECDHsecretCb(err, secret) {
        if (err) {
            if (err instanceof ProcessingError) {
                return log.debug(MODULELOG, `Could not compute ECDH negotiated secret for account ${address} with originator address ${orgAddress}: ${err.message}`);
            }
            return log.error(MODULELOG, `Could not compute ECDH negotiated secret for account ${address} with originator address ${orgAddress}: ${err.message}`);
        }
        const secretId = hash(blockchain + address + orgAddress, KEYIDLENGTH);
        wfState.upsertKey('negotiatedKeys', secretId, secret);
        log.debug(MODULELOG, `Computed ECDH negotiated secret for account ${address} with originator address ${orgAddress}`);
    });
}
