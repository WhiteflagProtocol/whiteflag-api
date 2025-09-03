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
const fnlRpc = require('./rpc');
const { withHexPrefix,
    noKeyHexPrefix,
    noAddressHexPrefix,
    noPubkeyHexPrefix
} = require('../common/format');

// Module constants //
const MODULELOG = 'fennel';
const HEXPREFIX = '0x';
const WFINDENTIFIER = '5746';
const BINENCODING = 'hex';
const KEYIDLENGTH = 12;

// Module variables //
let _fnlChain;
let _traceRaw = false;

/**
 * Initialises Fennel Transactions processing
 * @function initTransactions
 * @alias module:lib/blockchains/fennel/transactions.init
 * @param {Object} fnlConfig the Fennel blockchain configuration
 * @param {Object} fnlState the Fennel blockchain state
 * @param {Object} web3 the Fennel Web3 instance
 * @returns {Promise} resolve if succesfully initialised
 */
function initTransactions(fnlConfig, fnlState) {
    log.trace(MODULELOG, 'Initialising Fennel transaction processing');
    _fnlChain = fnlConfig.name;

    // TODO: complete module
    ignore(fnlState);
    ignore(HEXPREFIX);
    ignore(WFINDENTIFIER);

    // Trace all transactions if configured
    if (fnlConfig.traceRawTransaction) _traceRaw = fnlConfig.traceRawTransaction;

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
    log.trace(MODULELOG, `Sending transaction from ${_fnlChain} account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Create transaction
        createTransaction(account, toAddress, value, data)
        .then(fnlRawExtrinsic => {
            // Get the private key to sign the transaction
            const privateKeyId = hash(_fnlChain + noAddressHexPrefix(account.address), KEYIDLENGTH);
            wfState.getKey('blockchainKeys', privateKeyId, function fennelGetKeyCb(err, privateKey) {
                if (err) return reject(err);

                // Sign and serialise transaction
                let rawTransaction;
                try {
                    const fnlExtrinsic = fnlRawExtrinsic;
                    const privateKeyBuffer = Buffer.from(privateKey, BINENCODING);
                    fnlExtrinsic.sign(privateKeyBuffer);
                    zeroise(privateKeyBuffer);

                    const serializedTransaction = fnlExtrinsic.serialize();
                    rawTransaction = withHexPrefix(serializedTransaction.toString(BINENCODING));
                } catch(err) {
                    return reject(new Error(`Could not create raw transaction: ${err.message}`));
                }
                // Send signed transaction and process mined receipt
                fnlRpc.sendRawTransaction(rawTransaction)
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
 * @param {Object} transaction
 * @param {number} timestamp the block time
 * @returns {Promise} resolves to a Whiteflag message
 */
 function extractMessage(transaction, timestamp) {
    if (_traceRaw) log.trace(MODULELOG, `Extracting Whiteflag message from ${_fnlChain} transaction`);
    return Promise.reject(new ProcessingError(`Cannot extract Whiteflag messages from ${_fnlChain} extrinsic`, null, 'WF_API_NOT_IMPLEMENTED'));

    // TODO: Extract transaction from substrate extrinsic
    // Example: https://github.com/fennelLabs/subservice/blob/main/src/lib/node.js
    // Original code from Ethereum:
    let originatorPubKey;
    let wfMessage = {
        MetaHeader: {
            blockchain: _fnlChain,
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
 * @param {string} value the value to be sent
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
