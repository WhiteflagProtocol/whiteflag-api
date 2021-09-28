'use strict';
/**
 * @module lib/blockchains/ethereum/accounts
 * @summary Whiteflag API Ethereum common functions module
 * @description Module for common functions used by all Ethereum wub-modules
 */
module.exports = {
    formatAddressApi,
    formatPubkeyApi,
    formatHexApi,
    formatHexEthereum
};

// Module constants //
const ETHHEXPREFIX = '0x';
const SECPUBKEYPREFIX = '04';

// KEY AND ADDRESS FORMATTERS //
/**
 * Ensures that addresses are in generic api format
 * @function formatAddressApi
 * @returns {String} The Ethereum address without 0x hex prefix
 */
function formatAddressApi(addressHexString) {
    // The api addresses keys WITHOUT 0x prefix
    // Note that Ethereum addresses use capitials as a checksum, so no toLowerCase()
    if (!addressHexString) return null;
    if (addressHexString.substring(0, 2) === ETHHEXPREFIX) {
        return addressHexString.substr(2);
    }
    return addressHexString;
}

/**
 * Ensures that public keys are in generic api format
 * @function formatPubkeyApi
 * @returns {String} The Ethereum public key without 0x hex prefix but with prefix byte
 */
function formatPubkeyApi(pubkeyHexString) {
    // The api uses uncompressed keys, WITHOUT 0x prefix, but WITH the SEC 0x04 prefix byte
    if (!pubkeyHexString) return null;
    pubkeyHexString = formatHexApi(pubkeyHexString);
    if (pubkeyHexString.length === 128) {
        pubkeyHexString = SECPUBKEYPREFIX + pubkeyHexString;
    }
    return pubkeyHexString;
}

/**
 * Ensures that keys are in generic api format
 * @function formatHexApi
 * @returns {String} The Ethereum key without 0x hex prefix
 */
 function formatHexApi(hexString) {
    // The api uses keys WITHOUT 0x prefix
    if (!hexString) return null;
    if (hexString.substring(0, 2) === ETHHEXPREFIX) {
        return hexString.substr(2).toLowerCase();
    }
    return hexString.toLowerCase();
}

/**
 * Ensures that addresses and keys are in Ethereum format
 * @function formatHexEthereum
 * @returns {String} The Ethereum address or key with the 0x hex prefix
 */
function formatHexEthereum(hexString) {
    // Ethereum uses all hex strings WITH 0x prefix
    if (hexString.substring(0, 2) !== ETHHEXPREFIX) {
        return (ETHHEXPREFIX + hexString);
    }
    return hexString;
}
