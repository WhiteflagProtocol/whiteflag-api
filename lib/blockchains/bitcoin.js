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
    sendMessage,
    lookupMessage: bcTransactions.lookupMessage,
    getTransaction: bcTransactions.getTransaction,
    requestSignature,
    requestKeys,
    getBinaryAddress,
    transferFunds,
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
const { ProcessingError } = require('../common/errors');

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
    log.trace(_blockchainName, 'Initialising the Bitcoin blockchain...');

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

        // Determine network parameters
        if (bcConfig.testnet) _testnet = bcConfig.testnet;
        if (_testnet) {
            _bcState.parameters.network = bitcoin.networks.testnet;
            log.info(_blockchainName, 'Configured to use the Bitcoin testnet');
        } else {
            _bcState.parameters.network = bitcoin.networks.bitcoin;
            log.info(_blockchainName, 'Configured to use the Bitcoin mainnet');
        }
        // Initialise sub-modules
        bcRpc.init(bcConfig, _bcState)
        .then(() => { return bcTransactions.init(bcConfig, _bcState); })
        .then(() => { return bcListener.init(bcConfig, _bcState); })
        .then(() => { return bcUtxo.init(bcConfig, _bcState); })
        .then(() => { return bcAccounts.init(bcConfig, _bcState); })
        .catch(initErr => {
            return callback(initErr, _blockchainName);
        });
        // All done: update state and return
        wfState.updateBlockchainData(_blockchainName, _bcState);
        return callback(null, _blockchainName);
    });
}

/**
 * Sends an encoded message on the Bitcoin blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/bitcoin.sendMessage
 * @param {Object} wfMessage the Whiteflag message to be sent on Bitcoin
 * @param {blockchainSendTransactionCb} callback function to be called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    bcAccounts.check(wfMessage.MetaHeader.originatorAddress, function checkAccountCb(err, account) {
        if (err) return callback(err);

        // Prepare transaction data
        const toAddress = account.address;
        const encodedMessage = Buffer.from(wfMessage.MetaHeader.encodedMessage, 'hex');
        bcTransactions.send(account, toAddress, 0, encodedMessage, callback);
    });
}

/**
 * Requests a Whiteflag signature for a specific Bitcoin address
 * @function requestSignature
 * @alias module:lib/blockchains/bitcoin.requestSignature
 * @param {wfSignaturePayload} signPayload the JWS payload for the Whiteflag signature
 * @param {blockchainRequestSignatureCb} callback function to be called upon completion
 */
function requestSignature(signPayload, callback) {
    return callback(new ProcessingError('Whiteflag signatures not yet implemented for Bitcoin', null, 'WF_API_NOT_IMPLEMENTED'));
}

/**
 * Requests the Bitcoin address and correctly encoded pubic key of an originator
 * @function requestKeys
 * @alias module:lib/blockchains/bitcoin.requestKeys
 * @param {string} originatorPubKey the raw hex public key of the originator
 * @param {blockchainRequestKeysCb} callback function to be called upon completion
 */
function requestKeys(originatorPubKey, callback) {
    return callback(new ProcessingError('Key and adress conversions not yet implemented for Bitcoin', null, 'WF_API_NOT_IMPLEMENTED'));
}

/**
 * Returns a Bitcoin address in binary encoded form
 * @param {string} address the Bitcoin blockchain address
 * @param {blockchainBinaryAddressCb} callback function to be called upon completion
 */
 function getBinaryAddress(address, callback) {
    const addressBuffer = bs58.decode(address);
    return callback(null, addressBuffer);
}

/**
 * Transfers bitcoin from one Bitcoin address to an other address
 * @function transferFunds
 * @alias module:lib/blockchains/bitcoin.transferFunds
 * @param {Object} transfer the transaction details for the funds transfer
 * @param {blockchainSendTransactionCb} callback function to be called upon completion
 */
 function transferFunds(transfer, callback) {
    bcAccounts.check(transfer.fromAddress, function checkAccountCb(err, account) {
        if (err) return callback(err);

        // Extract transaction data
        const toAddress = transfer.toAddress;
        const amount = transfer.value;
        bcTransactions.send(account, toAddress, amount, null, callback);
    });
}
