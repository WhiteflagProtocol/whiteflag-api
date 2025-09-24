'use strict';
/**
 * @module lib/protocol/crypto
 * @summary Whiteflag cryptography module
 * @description Module for Whiteflag cryptographic functions
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    // Crypographic functions
    encrypt: encryptMessage,
    decrypt: decryptMessage,
    getTokenVerificationData,
    getECDHpublicKey,
    generateECDHsecret,
    // Private crypographic functions for testing
    test: {
        genInitVector,
        generateKey,
        encrypt,
        decrypt
    }
};

// Node.js core and external modules //
const crypto = require('crypto');

// Common internal functions and classes //
const { ignore } = require('../_common/processing');
const { hkdf, hash, zeroise } = require('../_common/crypto');
const { ProcessingError, ProtocolError } = require('../_common/errors');
const { hexToBuffer, bufferToHex } = require('../_common/encoding');

// Whiteflag modules //
const wfApiBlockchains = require('../blockchains');
const wfState = require('./state');

// Whiteflag configuration data //
const wfConfigData = require('./config').getConfig();

// Module constants //
const KEYIDLENGTH = 12;
const KEYENCODING = 'hex';
const ECDHCURVE = 'brainpoolP256r1';
/**
 * @constant {Object} encryptionParameters
 * @description Defines the Whiteflag encryption parameters as per par 5.2.3 of the WF specification
 */
const encryptionParameters = {
    '1': {
        algorithm: 'aes-256-ctr',
        keylength: 32,
        ivlength: 16,
        salt: '8ddb03085a2c15e69c35c224bce2952dca7878770724741cbce5a135328be0c0'
    },
    '2': {
        algorithm: 'aes-256-ctr',
        keylength: 32,
        ivlength: 16,
        salt: 'c4d028bd45c876135e80ef7889835822a6f19a31835557d5854d1334e8497b56'
    }
};
/**
 * @constant {Object} authenticationParameters
 * @description Defines the Whiteflag secret authentication token parameters as per par 5.2.3 of the WF specification
 */
const authenticationParameters = {
    '2': {
        tokenlength: 32,
        salt: '420abc48f5d69328c457d61725d3fd7af2883cad8460976167e375b9f2c14081'
    }
};

// MAIN MODULE FUNCTIONS //
/**
 * Encrypts a binary encoded Whiteflag message
 * @function encryptMessage
 * @alias module:lib/protocol/crypto.encrypt
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {buffer} encodedMessage an unencrypted binary encoded Whiteflag message
 * @param {function(Error, wfMessage)} callback function to be called upon completion
 */
function encryptMessage(wfMessage, encodedMessage, callback) {
    // Cryptograhic parameters
    let blockchain = wfMessage.MetaHeader.blockchain;
    let originator = wfMessage.MetaHeader.originatorAddress;
    let recipient = wfMessage.MetaHeader.recipientAddress;
    let messageKey = wfMessage.MetaHeader.encryptionKeyInput;
    let keyCateory;
    let secretId;

    // Check indicator for encryption type
    let method = wfMessage.MessageHeader.EncryptionIndicator;
    switch (method) {
        case '0': {
            recipient = undefined;
            wfMessage.MetaHeader.encodedMessage = bufferToHex(encodedMessage);
            return callback(null, wfMessage);
        }
        case '1': {
            // Use negotiated secret as IKM
            keyCateory = 'negotiatedKeys';

            // If key provided, use that one
            if (messageKey) {
                secretId = '0';
                break;
            }
            // Check encryption paramters; we are the originator
            let metaheaderErrors = [];
            if (!blockchain) metaheaderErrors.push('Blockchain not specified in metaheader');
            if (!originator) metaheaderErrors.push('Originator address not specified in metaheader');
            if (!recipient) metaheaderErrors.push('Recipient address not specified in metaheader');
            if (metaheaderErrors.length > 0) {
                return callback(new ProcessingError('Missing required parameters for encryption', metaheaderErrors, 'WF_API_BAD_REQUEST'));
            }
            secretId = hash(blockchain + originator + recipient, KEYIDLENGTH);
            break;
        }
        case '2': {
            // Use pre-shared secret as IKM
            keyCateory = 'presharedKeys';

            // If key provided, use that one
            if (messageKey) {
                secretId = '0';
                break;
            }
            // Check encryption parameters; we are the originator
            let metaheaderErrors = [];
            if (!blockchain) metaheaderErrors.push('Blockchain not specified in metaheader');
            if (!originator) metaheaderErrors.push('Originator address not specified in metaheader');
            if (!recipient) metaheaderErrors.push('Recipient address not specified in metaheader');
            if (metaheaderErrors.length > 0) {
                return callback(new ProcessingError('Missing required parameters for encryption', metaheaderErrors, 'WF_API_BAD_REQUEST'));
            }
            secretId = hash(blockchain + recipient + originator, KEYIDLENGTH);
            break;
        }
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
            // Encryption/Decryption is reserved
            return callback(new ProtocolError(`Illegal (reserved) encryption method: ${method}`, null, 'WF_ENCRYPTION_ERROR'));
        }
        default: {
            // Encryption/Decryption is not implemented
            return callback(new ProcessingError(`Encryption method not implemented: ${method}`, null, 'WF_API_NOT_IMPLEMENTED'));
        }
    }
    // Get cryptograhic parameters
    const iv = genInitVector(method);

    // Get decryption key
    wfState.getKey(keyCateory, secretId, function cryptoDecryptKeyCb(err, stateKey) {
        if (err) return callback(err);

        wfApiBlockchains.getBinaryAddress(originator, blockchain, function cryptoDecryptAddressCb(err, address) {
            if (err) return callback(err);

            // Derrive key and encrypt
            let encryptedMessage = Buffer.alloc(encodedMessage.length);
            try {
                // Get correct ikm
                let ikm = determineEncryptionKey(messageKey, stateKey, method);
                messageKey = undefined;
                stateKey = undefined;

                // Generate key
                let key = generateKey(ikm, address, method);
                zeroise(ikm);

                // Encrypt message
                encrypt(encodedMessage, method, key, iv).copy(encryptedMessage, 0);
                zeroise(key);
                zeroise(encodedMessage);
            } catch(err) {
                if (err instanceof ProcessingError || err instanceof ProtocolError) {
                    return callback(err);
                }
                return callback(new Error(`Encryption error: ${err.message}`));
            }
            // Update message and return result
            wfMessage.MetaHeader.encodedMessage = bufferToHex(encryptedMessage);
            wfMessage.MetaHeader.encryptionInitVector = bufferToHex(iv);
            return callback(null, wfMessage);
        });
    });
}

/**
 * Decrypts a binary encoded encrypted Whiteflag message
 * @function decryptMessage
 * @alias module:lib/protocol/crypto.decrypt
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {buffer} encodedMessage a binary encoded and encrypted Whiteflag message
 * @param {function(Error, wfMessage)} callback function to be called upon completion
 */
function decryptMessage(wfMessage, encodedMessage, callback) {
    // Cryptograhic parameters
    let blockchain = wfMessage.MetaHeader.blockchain;
    let originator = wfMessage.MetaHeader.originatorAddress;
    let recipient = wfMessage.MetaHeader.recipientAddress;
    let messageKey = wfMessage.MetaHeader.encryptionKeyInput;
    let keyCateory;
    let secretId;

    // Check indicator for encryption type
    let method = wfMessage.MessageHeader.EncryptionIndicator;
    switch (method) {
        case '0': {
            wfMessage.MetaHeader.recipientAddress = undefined;
            return callback(null, encodedMessage);
        }
        case '1': {
            // Use negotiated secret as IKM
            keyCateory = 'negotiatedKeys';

            // If key provided, use that one
            if (messageKey) {
                wfMessage.MetaHeader.recipientAddress = undefined;
                secretId = '0';
                break;
            }
            // Check encryption parameters; we are the recipient
            let metaheaderErrors = [];
            if (!recipient || recipient === 'unknown') recipient = '';
            if (!blockchain) metaheaderErrors.push('Blockchain not specified in metaheader');
            if (!originator) metaheaderErrors.push('Originator address not specified in metaheader');
            if (metaheaderErrors.length > 0) {
                return callback(new ProcessingError('Missing required parameters for encryption', metaheaderErrors, 'WF_API_BAD_REQUEST'));
            }
            secretId = hash(blockchain + recipient + originator, KEYIDLENGTH);
            break;
        }
        case '2': {
            // Use pre-shared secret as IKM
            keyCateory = 'presharedKeys';

            // If key provided, use that one
            if (messageKey) {
                wfMessage.MetaHeader.recipientAddress = undefined;
                secretId = '0';
                break;
            }
            // Check encryption parameters; we are the recipient
            let metaheaderErrors = [];
            if (!recipient || recipient === 'unknown') recipient = '';
            if (!blockchain) metaheaderErrors.push('Blockchain not specified in metaheader');
            if (!originator) metaheaderErrors.push('Originator address not specified in metaheader');
            if (metaheaderErrors.length > 0) {
                return callback(new ProcessingError('Missing required parameters for encryption', metaheaderErrors, 'WF_API_BAD_REQUEST'));
            }
            secretId = hash(blockchain + originator + recipient, KEYIDLENGTH);
            break;
        }
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
            // Encryption / Decryption method is reserved
            return callback(new ProtocolError(`Invalid encryption method (reserved): ${method}`, null, 'WF_FORMAT_ERROR'));
        }
        default: {
            // Encryption / Decryption method is not implemented
            return callback(new ProcessingError(`Encryption method not implemented: ${method}`, null, 'WF_API_NOT_IMPLEMENTED'));
        }
    }
    // Check initialisation vector
    if (!wfMessage.MetaHeader.encryptionInitVector) {
        return callback(new ProcessingError('Cannot decrypt message without initialisation vector', null, 'WF_API_BAD_REQUEST'));
    }
    const iv = hexToBuffer(wfMessage.MetaHeader.encryptionInitVector);
    if (iv.length !== encryptionParameters[method].ivlength) {
        return callback(new ProcessingError(`Invalid initialisation vector length: ${(iv.length * 8)} bits`, null, 'WF_API_BAD_REQUEST'));
    }
    // Get decryption key
    wfState.getKey(keyCateory, secretId, function cryptoDecryptKeyCb(err, stateKey) {
        if (err) return callback(err);

        wfApiBlockchains.getBinaryAddress(originator, blockchain, function cryptoDecryptAddressCb(err, address) {
            if (err) return callback(err);

            // Derrive key and decrypt
            let decryptedMessage = Buffer.alloc(encodedMessage.length);
            try {
                // Get correct ikm
                let ikm = determineDecryptionKey(messageKey, stateKey, method);
                messageKey = undefined;
                stateKey = undefined;

                // Generate key
                let key = generateKey(ikm, address, method);
                zeroise(ikm);

                // Encrypt message
                decrypt(encodedMessage, method, key, iv).copy(decryptedMessage, 0);
                zeroise(key);
            } catch(err) {
                if (err instanceof ProcessingError || err instanceof ProtocolError) {
                    return callback(err);
                }
                return callback(new Error(`Decryption error: ${err.message}`));
            }
            // Return result
            return callback(null, decryptedMessage);
        });
    });
}

/**
 * Generates verification data from shared secret authentication token
 * @function getTokenVerificationData
 * @alias module:lib/protocol/crypto.getTokenVerificationData
 * @param {buffer} authToken binary encoded secret authentication token as input key material
 * @param {buffer} address binary encoded blockchain address by which the token is used
 * @param {function(Error, verificationData)} callback function to be called upon completion
 * @typedef {Buffer} verificationData authentication token verification data
 */
function getTokenVerificationData(authToken, address, callback) {
    // Check input buffers
    if (authToken.length === 0) {
        return callback(new ProcessingError('Zero-length input buffer for authentication token generation', null, 'WF_API_BAD_REQUEST'), null);
    }
    if (address.length === 0) {
        return callback(new ProcessingError('Zero-length info buffer for authentication token generation', null, 'WF_API_BAD_REQUEST'), null);
    }
    // Get authentication method dependent parameters and generate token using HKDF
    const AUTHMETHOD = '2';
    const tokenlength = authenticationParameters[AUTHMETHOD].tokenlength;
    const salt = hexToBuffer(authenticationParameters[AUTHMETHOD].salt);
    const verificationData = hkdf(authToken, salt, address, tokenlength);
    zeroise(authToken);

    // Return token
    return callback(null, verificationData);
}

/**
 * Generates ECDH key pair and provides the public key
 * @function getECDHpubKey
 * @alias module:lib/protocol/crypto.getECDHpubKey
 * @param {string} id ECDH key pair identifier
 * @param {boolean} newKeyPair replace existing ECDH key pair if true
 * @param {function(Error, publicKey, newKey)} callback function to be called upon completion
 * @typedef {string} publicKey hexadecimal representation of the ECDH public key
 * @typedef {boolean} newKey indicates whether a new ECDH key pair has been generated
 */
function getECDHpublicKey(id, newKeyPair, callback) {
    const ecdh = crypto.createECDH(ECDHCURVE);
    let publicKey;

    wfState.getKey('ecdhPrivateKeys', id, function cryptoGetKeyCb(err, privateKey) {
        if (err) return callback(err);
        let newKey;
        try {
            if (!privateKey || newKeyPair) {
                newKey = true;
                publicKey = ecdh.generateKeys(KEYENCODING, 'compressed');
                wfState.upsertKey('ecdhPrivateKeys', id, ecdh.getPrivateKey(KEYENCODING));
            } else {
                newKey = false;
                ecdh.setPrivateKey(privateKey, KEYENCODING);
                publicKey = ecdh.getPublicKey(KEYENCODING, 'compressed');
                privateKey = undefined;
            }
        } catch(err) {
            return callback(err);
        }
        return callback(null, publicKey, newKey);
    });
}

/**
 * Generates a shared secret based on incoming public ECDH key pair and provides the public key
 * @function generateECDHsecret
 * @alias module:lib/protocol/crypto.generateECDHsecret
 * @param {string} id ECDH key pair identifier
 * @param {string} otherPublicKey hexadecimal representation of a received public ECDH key
 * @param {function(Error, secret)} callback function to be called upon completion
 * @typedef {string} secret hexadecimal representation of computed shared secret
 */
function generateECDHsecret(id, otherPublicKey, callback) {
    const ecdh = crypto.createECDH(ECDHCURVE);
    let secret;

    wfState.getKey('ecdhPrivateKeys', id, function cryptoGetKeyCb(err, privateKey) {
        if (err) return callback(err);
        if (!privateKey) return callback(new ProcessingError(`No private ECDH key with id ${id} available`));
        try {
            ecdh.setPrivateKey(privateKey, KEYENCODING);
            secret = ecdh.computeSecret(otherPublicKey, KEYENCODING, KEYENCODING);
        } catch(err) {
            return callback(err);
        }
        return callback(null, secret);
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Encrypts compressed binary encoded Whiteflag message
 * @private
 * @param {buffer} unencryptedMessage binary encoded Whiteflag message to be encrypted
 * @param {string} method the Whiteflag encrytpion method
 * @param {buffer} key binary encoded encryption key
 * @param {buffer} iv binary encoded initialisation vector
 * @returns {buffer} binary encoded encrypted Whiteflag message
 */
function encrypt(unencryptedMessage, method, key, iv) {
    // Cryptographic parameters
    const cipher = encryptionParameters[method].algorithm;
    const encrypter = crypto.createCipheriv(cipher, key, iv);

    // Perform encryption and return result
    return Buffer.concat([
        unencryptedMessage.slice(0, 4),
        encrypter.update(unencryptedMessage.slice(4)),
        encrypter.final()
    ], unencryptedMessage.length);
}

/**
 * Decrypts binary encoded encypted Whiteflag message
 * @private
 * @param {buffer} encryptedMessage binary encoded encrypted Whiteflag message
 * @param {string} method the Whiteflag encrytpion method
 * @param {buffer} key binary encoded encryption key
 * @param {buffer} iv binary encoded initialisation vector
 * @param {buffer} tag binary encoded message authentication tag
 * @returns {buffer} binary encoded decrypted Whiteflag message
 */
function decrypt(encryptedMessage, method, key, iv, tag) {
    // Cryptographic parameters
    const cipher = encryptionParameters[method].algorithm;
    const decrypter = crypto.createDecipheriv(cipher, key, iv);
    ignore(tag);

    // Perform decryption and return result
    return Buffer.concat([
        encryptedMessage.slice(0, 4),
        decrypter.update(encryptedMessage.slice(4)),
        decrypter.final()
    ], encryptedMessage.length);
}

/**
 * Generates a random initialisation vector
 * @private
 * @param {number} length initialisation vector length in octets
 * @returns {buffer} a random initialisation vector
 */
function genInitVector(method) {
    return crypto.randomBytes(encryptionParameters[method].ivlength);
}

/**
 * Generates encryption/decryption key from input key material
 * @private
 * @param {buffer} ikm binary encoded encryption secret as input key material
 * @param {buffer} address binary encoded blockchain address by which the message is encrypted
 * @param {string} method single character indicating the Whiteflag encryption method
 * @returns {buffer} encryption key
 */
function generateKey(ikm, address, method) {
    if (ikm.length === 0) {
        throw new ProcessingError('Zero-length key input buffer for encryption key generation', null, 'WF_API_BAD_REQUEST');
    }
    // Get algorithm dependent parameters
    const keylength = encryptionParameters[method].keylength;
    const salt = hexToBuffer(encryptionParameters[method].salt);

    // Use HKDF to generate and return key
    return hkdf(ikm, salt, address, keylength);
}

/**
 * Determines which encryption key to use
 * @private
 * @param {string} metaheader hexadecimal representation of the secret in the metaheader
 * @param {string} keystore hexadecimal representation of the secret from the key store
 * @param {string} method single character indicating the Whiteflag encryption method
 * @returns {buffer} input key material
 */
function determineEncryptionKey(messageKey, stateKey, method) {
    if (messageKey && method === '2') {
        return hexToBuffer(messageKey);
    }
    if (stateKey) {
        return hexToBuffer(stateKey);
    }
    if (method === '2' && wfConfigData.encryption.psk) {
        return hexToBuffer(wfConfigData.encryption.psk);
    }
    switch (method) {
        case '1': {
            throw new ProtocolError('No ECDH encryption key available', null, 'WF_ENCRYPTION_ERROR');
        }
        case '2': {
            throw new ProtocolError('No pre-shared encryption key available', null, 'WF_ENCRYPTION_ERROR');
        }
        default: {
            throw new ProtocolError('No encryption key available', null, 'WF_ENCRYPTION_ERROR');
        }
    }
}

/**
 * Determines which decryption key to use
 * @private
 * @param {string} metaheader hexadecimal representation of the secret in the metaheader
 * @param {string} keystore hexadecimal representation of the secret from the key store
 * @param {string} method single character indicating the Whiteflag encryption method
 * @returns {buffer} input key material
 */
function determineDecryptionKey(messageKey, stateKey, method) {
    if (messageKey && method === '2') {
        return hexToBuffer(messageKey);
    }
    if (stateKey) {
        return hexToBuffer(stateKey);
    }
    switch (method) {
        case '1': {
            throw new ProtocolError('No ECDH decryption key available', null, 'WF_ENCRYPTION_ERROR');
        }
        case '2': {
            throw new ProtocolError('No pre-shared decryption key available', null, 'WF_ENCRYPTION_ERROR');
        }
        default: {
            throw new ProtocolError('No decryption key available', null, 'WF_ENCRYPTION_ERROR');
        }
    }
}
