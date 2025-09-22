'use strict';
/**
 * @module lib/blockchains/_common/keys
 * @summary Whiteflag API blockchains common crypto module
 * @description Module for common blockchain crypto functions
 */
module.exports = {
    getPrivateKeyId
};

// Whiteflag common functions and classes //
const { hash } = require('../../_common/crypto');

// Module constants //
const KEYIDLENGTH = 12;

/**
 * Gets the identifier to get private key from state
 * @param {string} blockchain the blockchain name
 * @param {string} address the address of the account
 * @param {number} length the length of the identifier
 * @returns {string} a hexadecimal string with the private key id
 */
function getPrivateKeyId(blockchain, address, length = KEYIDLENGTH) {
    return hash(blockchain + address, length);
}
