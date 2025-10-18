'use strict';
/**
 * @module lib/_common/crypto
 * @summary Whiteflag API common cryptographic functions
 * @description Module with synchronous cryptographic functions
 * @tutorial modules
 */
module.exports = {
    hkdf,
    hash,
    zeroise
};

// Node.js core modules //
const crypto = require('crypto');

// MAIN MODULE FUNCTIONS //
/**
 * Hash-based Key Derivation Function using SHA-256 i.a.w. RFC 5869
 * @function hkdf
 * @alias module:lib/_common/crypto.hkdf
 * @param {Buffer} ikm input key material
 * @param {Buffer} salt salt
 * @param {Buffer} info info
 * @param {Buffer} keylen output key length in octets
 * @returns {Buffer} generated key
 */
function hkdf(ikm, salt, info, keylen) {
    const HASHALG = 'sha256';
    const HASHLEN = 32;
    const N = Math.ceil(keylen / HASHLEN);

    // Function variables
    let okm = Buffer.alloc(keylen);
    let t = Buffer.alloc(HASHLEN);
    let offset = 0;

    // Step 1. HKDF-Extract(salt, IKM) -> PRK
    let prk = crypto.createHmac(HASHALG, salt).update(ikm).digest();
    zeroise(ikm);

    // Step 2. HKDF-Expand(PRK, info, L) -> OKM
    for (let i = 1; i <= N; i++) {
        // Concatinate previous hash t, info and counter i
        let block = Buffer.alloc(offset + info.length + 1);
        t.copy(block, 0);
        info.copy(block, offset);
        block[offset + info.length] = i;

        // Get hash and add to okm buffer
        let hash = crypto.createHmac(HASHALG, prk).update(block).digest();
        hash.copy(t, 0);
        hash.copy(okm, offset * (i - 1));

        // Block contains t after after first interation
        offset = HASHLEN;
    }
    // Return output key material
    return okm;
}

/**
 * Basic hashing function
 * @function hash
 * @alias module:lib/_common/crypto.hash
 * @param {string} data data to hash
 * @param {number} [lentgh] output length in octets
 * @param {string} [algorithm] hash algorithm
 * @returns {string} hexadecimal representation of the hash
 */
function hash(data, length, algorithm = 'sha256') {
    const output = crypto.createHash(algorithm).update(data).digest('hex');
    if (!length) return output;
    return output.substring(0, (length * 2));
}

/**
 * Basic zeroisation function
 * @function zeroise
 * @alias module:lib/_common/crypto.zeroise
 * @param {Buffer} buffer buffer to zeroise
 * @returns {Buffer} the zeroised buffer
 */
function zeroise(buffer) {
    return buffer.fill(0);
}
