'use strict';
/**
 * @module lib/blockchains/fennel/transactions
 * @summary Whiteflag API Fennel transaction module
 * @description Module to process Fennel transactions for Whiteflag
 */
module.exports = {
    init: initTransactions,
    get: getTransaction,
    sendSignal,
    sendTokens,
    extractMessage
};

/* Common internal functions and classes */
const log = require('../../_common/logger');
const { ProcessingError } = require('../../_common/errors');
const { withHexPrefix, 
        noHexPrefix } = require('../../_common/format');

/* Fennel sub-modules */
const fnlRpc = require('./rpc');
const fnlAccounts = require('./accounts');

/* Module constants */
const MODULELOG = 'fennel';
const WFINDENTIFIER = '5746';

/* Module variables */
let _fnlChain;
let _traceRaw = false;

/**
 * Initialises Fennel Transactions processing
 * @function initTransactions
 * @alias module:lib/blockchains/fennel/transactions.init
 * @param {Object} fnlConfig the Fennel blockchain configuration
 * @returns {Promise} resolve if succesfully initialised
 */
function initTransactions(fnlConfig) {
    log.trace(MODULELOG, 'Initialising Fennel transaction processing');
    _fnlChain = fnlConfig.name;

    // Trace all transactions if configured
    if (fnlConfig.traceRawTransaction) _traceRaw = fnlConfig.traceRawTransaction;

    // Succesfully completed initialisation
    return Promise.resolve();
}

/**
 * Sends a signal transaction on the Fennel blockchain
 * @function sendSignal
 * @alias module:lib/blockchains/fennel/transactions.sendSignal
 * @param {wfAccount} account the account used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} data the data to be sent
 * @returns {Promise} resolve to transaction hash and block number
 */
function sendSignal(account, data) {
    log.debug(MODULELOG, `Sending signal from account ${account.address}: ${data}`);
    return fnlAccounts.getKeyring(account.address)
    .then(originator => {
        const signal = withHexPrefix(data);
        return fnlRpc.sendSignal(originator, signal);
    })
    .then(result => {
        log.debug(MODULELOG, `Transaction result: ${JSON.stringify(result)}`)
        return Promise.resolve(noHexPrefix(result.toHex()));
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Sends a token transaction on the Fennel blockchain
 * @function sendTokens
 * @alias module:lib/blockchains/fennel/transactions.sendTokens
 * @param {wfAccount} account the account used to send the transaction
 * @param {string} toAddress the address to transfer the tokens to
 * @param {number} amount the amount of tokens to transfer
 * @returns {Promise} resolve to transaction hash and block number
 */
function sendTokens(account, toAddress, amount) {
    log.debug(MODULELOG, `Sending tokens from account ${account.address} to ${toAddress}: ${amount}`);
    return fnlAccounts.getKeyring(account.address)
    .then(originator => {
        return fnlRpc.sendTokens(originator, toAddress, amount);
    })
    .then(result => {
        log.debug(MODULELOG, `Transaction result: ${JSON.stringify(result)}`)
        return Promise.resolve(result.toHex());
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Gets a transaction by transaction hash and checks for Whiteflag message
 * @private
 * @param {string} transactionHash
 * @returns {Promise} resolves to a blockchain transaction
 */
function getTransaction(transactionHash) {
    log.trace(MODULELOG, `Retrieving transaction: ${transactionHash}`);
    return fnlRpc.getRawTransaction(transactionHash)
    .then(transaction => {
        if (!transaction) {
            return Promise.reject(new ProcessingError(`No transaction returned by ${_fnlChain} node for hash: ${transactionHash}`, null, 'WF_API_NO_DATA'));
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
 * @param {Object} transaction the Fennel transaction
 * @returns {Promise} resolves to a Whiteflag message
 */
 function extractMessage(transaction) {
    if (_traceRaw) log.trace(MODULELOG, `Extracting Whiteflag message from extrinsic ${transaction.block}/${transaction.index}: ${JSON.stringify(transaction)}`);
    return fnlAccounts.getPublicKey(transaction.originator)
    .then(fnlPubkey => {
        if (transaction.signal.startsWith(WFINDENTIFIER)) {
            let wfMessage = {
                MetaHeader: {
                    blockchain: _fnlChain,
                    blockNumber: transaction.block,
                    transactionIndex: transaction.index,
                    transactionHash: transaction.hash,
                    transactionTime: transaction.timestamp,
                    originatorAddress: transaction.originator,
                    originatorPubKey: fnlPubkey,
                    encodedMessage: transaction.signal
                }
            };
            return Promise.resolve(wfMessage);
        }
        return Promise.reject(new ProcessingError(`No Whiteflag message found in extrinsic ${transaction.block}/${transaction.index}`, null, 'WF_API_NO_DATA'));
    })
    .catch(err => {
        return Promise.reject(err);
    });
}
