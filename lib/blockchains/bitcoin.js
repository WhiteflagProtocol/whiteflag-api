'use strict';
/**
 * @module lib/blockchains/bitcoin
 * @summary Whiteflag API Bitcoin blockchain implementation
 * @description Module to use Bitcoin as underlying blockchain for Whiteflag
 * @TODO Add signature functions for authentication
 */

// Bitcoin sub-modules //
const bcRpc = require('./bitcoin/rpc');
const bcUtxo = require('./bitcoin/utxo');
const bcAccounts = require('./bitcoin/accounts');
const bcListener = require('./bitcoin/listener');
const bcTransactions = require('./bitcoin/transactions');

module.exports = {
    // Bitcoin blockchain functionsns
    init: initBitcoin,
    sendMessage: bcTransactions.sendMessage,
    lookupMessage: bcTransactions.lookupMessage,
    getTransaction: bcTransactions.getTransaction,
    getBinaryAddress,
    transfer: bcTransactions.transferFunds,
    createAccount: bcAccounts.create,
    updateAccount: bcAccounts.update,
    deleteAccount: bcAccounts.delete
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');
const bs58 = require('bs58');

// Whiteflag common functions and classes //
const log = require('../common/logger');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Module variables //
let _blockchainName = 'bitcoin';
let _bcState = {};
let _testnet = true;

/**
 * Initialises the Bitcoin blockchain
 * @function initBitcoin
 * @alias module:lib/blockchains/bitcoin.init
 * @param {Object} bcConfig the Bitcoin blockchain configuration
 * @param {blockchainInitCb} callback function to be called after intitialising Bitcoin
 */
function initBitcoin(bcConfig, callback) {
    // Preserve the name of the blockchain
    _blockchainName = bcConfig.name;

    // Get Bitcoin blockchain state
    wfState.getBlockchainData(_blockchainName, function blockchainsGetStateDb(err, bcState) {
        if (err) return callback(err, _blockchainName);
        if (!bcState) {
            bcState = {
                parameters: {},
                status: {},
                accounts: []
            };
        }
        // Preserve state for module
        _bcState = bcState;

        // Initialise sub-modules
        bcRpc.init(bcConfig, _bcState);

        // Determine network parameters
        if (bcConfig.testnet) _testnet = bcConfig.testnet;
        if (_testnet) {
            _bcState.parameters.network = bitcoin.networks.testnet;
            log.info(_blockchainName, 'Configured to use the Bitcoin testnet');
        } else {
            _bcState.parameters.network = bitcoin.networks.bitcoin;
            log.info(_blockchainName, 'Configured to use the Bitcoin mainnet');
        }

        // Pass parameters to sub-modules
        bcTransactions.init(bcConfig, _bcState);
        bcAccounts.init(bcConfig, _bcState);
        bcUtxo.init(bcConfig, _bcState);
        bcListener.init(bcConfig, _bcState);

        // All done: update state and return
        wfState.updateBlockchainData(_blockchainName, _bcState);
        return callback(null, _blockchainName);
    });
}

// PRIVATE KEY AND ADDRESS FORMATTERS //
/**
 * Decodes bs58 addresses
 * @private
 */
 function getBinaryAddress(address, callback) {
    const addressBuffer = bs58.decode(address);
    return callback(null, addressBuffer);
}
