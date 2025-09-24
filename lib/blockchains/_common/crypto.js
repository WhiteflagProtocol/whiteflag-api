'use strict';
/**
 * @module lib/blockchains/_common/crypto
 * @summary Whiteflag API blockchains common crypto module
 * @description Module for common blockchain crypto functions
 */
module.exports = {
    createJWS,
    verifyJWS
};

// Node.js core and external modules //
const KeyEncoder = require('key-encoder').default;
const jwt = require('jsonwebtoken');

// Common internal functions and classes //
const { ProtocolError } = require('../../_common/errors');
const { toCompact } = require('../../_common/jws')

/**
 * Creates a JSON Web Signature (JWS) with a private blockchain key
 * @function createJWS
 * @alias module:lib/blockchains/common.createJWS
 * @param {wf} payload the payload to be signed
 * @param {string} privateKey the hexadecimal private blockchain key
 * @param {string} privateKeyType the type of privatye blockchain key
 * @param {string} signAlgorithm the siging algorithm
 * @returns {Object} a flattened JSON Web Signature (JWS) serialisaton
 */
function createJWS(payload, privateKey, privateKeyType, signAlgorithm) {
    // Flattened JWS data structure
    let jws = {
        protected: '',
        payload: '',
        signature: ''
    };
    // Create JSON Web Signature (JWS)
    const keyEncoder = new KeyEncoder(privateKeyType);
    const signKey = keyEncoder.encodePrivate(privateKey, 'raw', 'pem');
    const jwsArray = jwt.sign(
        payload,
        signKey,
        {
            algorithm: signAlgorithm,
            allowInvalidAsymmetricKeyTypes: true
        })
        .split('.');

    // Create and return flattend JSON serialization of JWS
    jws.protected = jwsArray[0];
    jws.payload = jwsArray[1];
    jws.signature = jwsArray[2];
    return jws;
}

/**
 * Verifies a JSON Web Signature (JWS) with a public blockchain key
 * @param {Veri} jws a flattened JSON Web Signature (JWS) serialisaton
 * @param {string} publicKey the hexadecimal public blockchain key
 * @param {string} publicKeyType the type of public blockchain key
 * @returns 
 */
function verifyJWS(jws, publicKey, publicKeyType) {
    const jwsCompact = toCompact(jws);
    const keyEncoder = new KeyEncoder(publicKeyType);
    const verificationKey = keyEncoder.encodePrivate(publicKey, 'raw', 'pem');
    try {
        return jwt.verify(
            jwsCompact,
            verificationKey,
            { allowInvalidAsymmetricKeyTypes: true }
        );
    } catch(err) {
        if (err.name === 'JsonWebTokenError'
            || err.name === 'TokenExpiredError'
            || err.name === 'NotBeforeError'
        ) {
            throw new Error(`Invalid JSON Web Signature: ${err.name}: ${err.message}`);
        }
        throw new Error(`Could not verify JSON Web Signature: ${err.message}`);
    }
}
