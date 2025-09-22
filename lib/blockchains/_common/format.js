'use strict';
/**
 * @module lib/blockchains/_common/format
 * @summary Whiteflag API blockchains common formatting module
 * @description Module for common blockchain formatting functions
 */
module.exports = {
    noAddressHexPrefix,
    noPubkeyHexPrefix,
    noKeyHexPrefix,
    withHexPrefix
};

// Module constants //
const HEXPREFIX = '0x';
const SECPUBKEYPREFIX = '04';

// KEY AND ADDRESS FORMATTERS //
/**
 * Ensures that addresses are in generic api format
 * @function noAddressHexPrefix
 * @returns {string} The blockchain address without 0x hex prefix
 */
function noAddressHexPrefix(addressHexString) {
    // The api addresses keys WITHOUT 0x prefix
    // Note that certains blockchains use capitials as a checksum, so no toLowerCase()
    if (!addressHexString) return null;
    if (addressHexString.substring(0, 2) === HEXPREFIX) {
        return addressHexString.substring(2);
    }
    return addressHexString;
}

/**
 * Ensures that public keys are in generic api format
 * @function noPubkeyHexPrefix
 * @returns {string} The blockchain public key without 0x hex prefix but with prefix byte
 */
function noPubkeyHexPrefix(pubkeyHexString) {
    // The api uses uncompressed keys, WITHOUT 0x prefix, but WITH the SEC 0x04 prefix byte
    if (!pubkeyHexString) return null;
    pubkeyHexString = noKeyHexPrefix(pubkeyHexString);
    if (pubkeyHexString.length === 128) {
        pubkeyHexString = SECPUBKEYPREFIX + pubkeyHexString;
    }
    return pubkeyHexString;
}

/**
 * Ensures that keys are in generic api format
 * @function noKeyHexPrefix
 * @returns {string} The blockchain key without 0x hex prefix
 */
 function noKeyHexPrefix(hexString) {
    // The api uses keys WITHOUT 0x prefix
    if (!hexString) return null;
    if (hexString.substring(0, 2) === HEXPREFIX) {
        return hexString.substring(2).toLowerCase();
    }
    return hexString.toLowerCase();
}

/**
 * Ensures that addresses and keys have a hex prefix
 * @function withHexPrefix
 * @returns {string} The blockchain address or key with the 0x hex prefix
 */
function withHexPrefix(hexString) {
    // Blockchains typically use all hex strings WITH 0x prefix
    if (hexString.substring(0, 2) !== HEXPREFIX) {
        return (HEXPREFIX + hexString);
    }
    return hexString;
}
