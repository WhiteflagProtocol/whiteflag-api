'use strict';
/**
 * @module lib/blockchains/fennel/transactions
 * @summary Whiteflag API Fennel transaction module
 * @description Module to process Fennel transactions for Whiteflag
 */
module.exports = {
    // Fennel transaction functions
    init: initTransactions,
    send: sendTransaction,
    get: getTransaction,
    extractMessage
};

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { hash, zeroise } = require('../../common/crypto');
const { ignore } = require('../../common/processing');
const { ProcessingError } = require('../../common/errors');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Fennel sub-modules //
const fennelRpc = require('./rpc');
const { withHexPrefix,
    noKeyHexPrefix,
    noAddressHexPrefix,
    noPubkeyHexPrefix
} = require('../common/format');

// Module constants //
const HEXPREFIX = '0x';
const WFINDENTIFIER = '5746';
const BINENCODING = 'hex';
const KEYIDLENGTH = 12;

// Module variables //
let _blockchainName;
let _traceRawTransaction = false;

/**
 * Initialises Fennel Transactions processing
 * @function initTransactions
 * @alias module:lib/blockchains/fennel/transactions.init
 * @param {Object} fennelConfig the Fennel blockchain configuration
 * @param {Object} fennelState the Fennel blockchain state
 * @param {Object} web3 the Fennel Web3 instance
 * @returns {Promise} resolve if succesfully initialised
 */
function initTransactions(fennelConfig, fennelState) {
    _blockchainName = fennelConfig.name;
    log.trace(_blockchainName, 'Initialising Fennel transaction processing...');

    // TODO: complete module
    ignore(fennelState);
    ignore(HEXPREFIX);
    ignore(WFINDENTIFIER);

    // Trace all transactions if configured
    if (fennelConfig.traceRawTransaction) _traceRawTransaction = fennelConfig.traceRawTransaction;

    // Succesfully completed initialisation
    return Promise.resolve();
}

/**
 * Sends a transaction on the Fennel blockchain
 * @function sendTransaction
 * @alias module:lib/blockchains/fennel/transactions.send
 * @param {Object} account the account used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} value the value to be sent
 * @param {string} data the data to be sent
 * @returns {Promise} resolve to transaction hash and block number
 */
function sendTransaction(account, toAddress, value, data) {
    log.trace(_blockchainName, `Sending transaction from account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Create transaction
        createTransaction(account, toAddress, value, data)
        .then(fennelRawExtrinsic => {
            // Get the private key to sign the transaction
            const privateKeyId = hash(_blockchainName + noAddressHexPrefix(account.address), KEYIDLENGTH);
            wfState.getKey('blockchainKeys', privateKeyId, function fennelGetKeyCb(keyErr, privateKey) {
                if (keyErr) return reject(keyErr);

                // Sign and serialise transaction
                let rawTransaction;
                try {
                    const fennelExtrinsic = fennelRawExtrinsic;
                    const privateKeyBuffer = Buffer.from(privateKey, BINENCODING);
                    fennelExtrinsic.sign(privateKeyBuffer);
                    zeroise(privateKeyBuffer);

                    const serializedTransaction = fennelExtrinsic.serialize();
                    rawTransaction = withHexPrefix(serializedTransaction.toString(BINENCODING));
                } catch(err) {
                    return reject(new Error(`Could not create raw transaction: ${err.message}`));
                }
                // Send signed transaction and process mined receipt
                fennelRpc.sendRawTransaction(rawTransaction)
                .then(receipt => resolve(noKeyHexPrefix(receipt.transactionHash), receipt.blockNumber))
                .catch(err => {
                    if (err) return reject(new Error(`Could not send transaction from account ${account.address}: ${err.message}`));
                    return reject(new Error(`Could not send transaction from account: ${account.address}`));
                });
            });
        });
    });
}

/**
 * Gets a transaction by transaction hash and checks for Whiteflag message
 * @private
 * @param {string} transactionHash
 * @returns {Promise} resolves to a blockchain transaction
 */
function getTransaction(transactionHash) {
    log.trace(_blockchainName, `Retrieving transaction: ${transactionHash}`);
    return fennelRpc.getRawTransaction(transactionHash)
    .then(transaction => {
        if (!transaction) {
            return Promise.reject(new ProcessingError(`No transaction returned by node for hash: ${transactionHash}`, null, 'WF_API_NO_DATA'));
        }
        return Promise.resolve(transaction);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Extracts Whiteflag message from Fennel transaction data
 * @function extractMessage
 * @alias module:lib/blockchains/fennel/transactions.extractMessage
 * @param {Object} transaction
 * @param {number} timestamp the block time
 * @returns {Promise} resolves to a Whiteflag message
 */
 function extractMessage(transaction, timestamp) {
    if (_traceRawTransaction) log.trace(_blockchainName, `Extracting Whiteflag message from transaction`);
    return Promise.reject(new ProcessingError(`Cannot extract Whiteflag messages from extrinsic`, null, 'WF_API_NOT_IMPLEMENTED'));

    // TODO: Extract transaction from substrate extrinsic
    // Example: https://github.com/fennelLabs/subservice/blob/main/src/lib/node.js
    // Original code from Ethereum:
    let originatorPubKey;
    let wfMessage = {
        MetaHeader: {
            blockchain: _blockchainName,
            blockNumber: transaction.blockNumber,
            transactionHash: noKeyHexPrefix(transaction.hash),
            transactionTime: '',
            originatorAddress: noAddressHexPrefix(transaction.from),
            originatorPubKey: noPubkeyHexPrefix(originatorPubKey),
            encodedMessage: noKeyHexPrefix(transaction.input)
        }
    };
    if (timestamp) wfMessage.MetaHeader.transactionTime = new Date(timestamp * 1000).toISOString();
    return Promise.resolve(wfMessage);
}

// PRIVATE TRANSACTION FUNCTIONS //
/**
 * Creates a new Fennel transaction to be signed
 * @private
 * @param {Object} account the account parameters used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} value the value to be sent in ether
 * @param {string} data the data to be sent
 * @returns {Promise} resolves to a raw unsigned transaction object
 */
function createTransaction(account, toAddress, value, data) {
        // TODO: create function
        ignore(account);
        ignore(toAddress);
        ignore(value);
        ignore(data);
        let rawTransactionObject = {};
        return Promise.resolve(rawTransactionObject);
}
