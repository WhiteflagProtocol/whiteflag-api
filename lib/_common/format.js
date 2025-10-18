'use strict';
/**
 * @module lib/_common/format
 * @summary Whiteflag API common formatting module
 * @description Module for common formatting functions
 */
module.exports = {
    noAddressHexPrefix,
    noPubkeyHexPrefix,
    noHexPrefix,
    withHexPrefix
};

// Module constants //
const HEXPREFIX = '0x';
const SECPUBKEYPREFIX = '04';

// MAIN MODULE FUNCTIONS //
/**
 * Ensures that addresses are in generic api format without 0x prefix
 * @function noAddressHexPrefix
 * @alias module:lib/_common/format.noAddressHexPrefix
 * @param {string} a hexadecimal blockchain address
 * @returns {string} the blockchain address without 0x hex prefix
 */
function noAddressHexPrefix(addressHexString) {
    // Note that certains blockchains use capitials as a checksum, so no toLowerCase()
    if (!addressHexString) return null;
    if (addressHexString.startsWith(HEXPREFIX)) {
        return addressHexString.substring(2);
    }
    return addressHexString;
}

/**
 * Ensures that public keys are in generic api format without 0x prefix
 * @function noPubkeyHexPrefix
 * @alias module:lib/_common/format.noPubkeyHexPrefix
 * @param {string} a hexadecimal public key
 * @returns {string} the blockchain public key without 0x hex prefix but with prefix byte
 */
function noPubkeyHexPrefix(pubkeyHexString) {
    // The api uses uncompressed keys, WITHOUT 0x prefix, but WITH the SEC 0x04 prefix byte
    if (!pubkeyHexString) return null;
    pubkeyHexString = noHexPrefix(pubkeyHexString);
    if (pubkeyHexString.length === 128) {
        pubkeyHexString = SECPUBKEYPREFIX + pubkeyHexString;
    }
    return pubkeyHexString;
}

/**
 * Ensures that hexadecimals strings are in generic api format without a 0x prefix
 * @function noHexPrefix
 * @alias module:lib/_common/format.noHexPrefix
 * @param {string} a hexadecimal string
 * @returns {string} the hexadecimal string without 0x hex prefix
 */
 function noHexPrefix(hexString) {
    if (!hexString) return null;
    if (hexString.startsWith(HEXPREFIX)) {
        return hexString.substring(2).toLowerCase();
    }
    return hexString.toLowerCase();
}

/**
 * Ensures that hexadecimal strings have a hex prefix
 * @function withHexPrefix
 * @alias module:lib/_common/format.withHexPrefix
 * @param {string} a hexadecimal string
 * @returns {string} the hexadecimal string with 0x hex prefix
 */
function withHexPrefix(hexString) {
    if (!hexString.startsWith(HEXPREFIX)) {
        return (HEXPREFIX + hexString);
    }
    return hexString;
}
