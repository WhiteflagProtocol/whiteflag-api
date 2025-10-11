'use strict';
/**
 * @module lib/blockchains/common/crypto
 * @summary Whiteflag API blockchains common crypto module
 * @description Module for common blockchain crypto functions
 */
module.exports = {
    createSignature
};

// Node.js core and external modules //
const KeyEncoder = require('key-encoder').default;
const jwt = require('jsonwebtoken');

/**
 * Creates a JSON Web Signature (JWS) with a private blockchain key
 * @function createSignature
 * @alias module:lib/blockchains/common.createSignature
 * @param {Object} payload the payload to be signed
 * @param {string} privateKeyType the hexadecimal private blockchain key
 * @param {string} signKeyType the type of privatye blockchain key
 * @param {string} signAlgorithm the siging algorithm
 * @rteurn {Object} a flattened JSON Web Signature (JWS) serialisaton
 */
function createSignature(payload, privateKey, privateKeyType, signAlgorithm) {
    // Flattened JWS data structure
    let jws = {
        protected: '',
        payload: '',
        signature: ''
    };
    // Create JSON Web Signature (JWS)
    const keyEncoder = new KeyEncoder(privateKeyType);
    const signKey = keyEncoder.encodePrivate(privateKey, 'raw', 'pem');
    const jwsArray = jwt.sign(payload,
                              signKey,
                              { algorithm: signAlgorithm,
                                allowInvalidAsymmetricKeyTypes: true }
                             ).split('.');

    // Create and return flattend JSON serialization of JWS
    jws.protected = jwsArray[0];
    jws.payload = jwsArray[1];
    jws.signature = jwsArray[2];
    return jws;
}
