'use strict';
/**
 * @module lib/blockchains/ethereum/transactions
 * @summary Whiteflag API Ethereum transaction module
 * @description Module to process Ethereum transactions for Whiteflag
 */
module.exports = {
    // Ethereum transaction functions
    init: initTransactions,
    send: sendTransaction,
    get: getTransaction,
    extractMessage
};

// Node.js core and external modules //
const EthereumTx = require('ethereumjs-tx').Transaction;
const ethUtil = require('ethereumjs-util');

// Whiteflag common functions and classes //
const log = require('../../_common/logger');
const { hash, zeroise } = require('../../_common/crypto');
const { ProcessingError } = require('../../_common/errors');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Ethereum sub-modules //
const ethRpc = require('./rpc');
const { withHexPrefix,
        noKeyHexPrefix,
        noAddressHexPrefix,
        noPubkeyHexPrefix
    } = require('../_common/format');

// Module constants //
const MODULELOG = 'ethereum';
const ETHHEXPREFIX = '0x';
const WFINDENTIFIER = '5746';
const KEYIDLENGTH = 12;

// Module variables //
let _ethChain = 'ethereum';
let _ethState;
let _ethApi;
let _traceRaw = false;

/**
 * Initialises Ethereum Transactions processing
 * @function initTransactions
 * @alias module:lib/blockchains/ethereum/transactions.init
 * @param {Object} ethConfig the Ethereum blockchain configuration
 * @param {Object} ethState the Ethereum blockchain state
 * @param {Object} ethApi the Ethereum Web3 instance
 * @returns {Promise} resolve if succesfully initialised
 */
function initTransactions(ethConfig, ethState, ethApi) {
    log.trace(MODULELOG, 'Initialising Ethereum transaction processing');
    _ethChain = ethConfig.name;
    _ethState = ethState;
    _ethApi = ethApi;

    // Trace all transactions if configured
    if (ethConfig.traceRawTransaction) _traceRaw = ethConfig.traceRawTransaction;

    // Succesfully completed initialisation
    return Promise.resolve();
}

/**
 * Sends a transaction on the Ethereum blockchain
 * @function sendTransaction
 * @alias module:lib/blockchains/ethereum/transactions.send
 * @param {Object} account the account used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} value the value to be sent in ether
 * @param {string} data the data to be sent
 * @returns {Promise} resolve to transaction hash and block number
 */
function sendTransaction(account, toAddress, value, data) {
    log.trace(MODULELOG, `Sending transaction from ${_ethChain} account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Create transaction
        createTransaction(account, toAddress, value, data)
        .then(rawTransactionObject => {
            // Get the private key to sign the transaction
            const privateKeyId = hash(_ethChain + noAddressHexPrefix(account.address), KEYIDLENGTH);
            wfState.getKey('blockchainKeys', privateKeyId, function ethGetKeyCb(err, privateKey) {
                if (err) return reject(err);

                // Sign and serialise transaction
                let rawTransaction;
                try {
                    const ethTransactionObject = new EthereumTx(rawTransactionObject, { chain: _ethState.parameters.chainID });
                    const privateKeyBuffer = hexToBuffer(privateKey);
                    ethTransactionObject.sign(privateKeyBuffer);
                    zeroise(privateKeyBuffer);

                    const serializedTransaction = ethTransactionObject.serialize();
                    rawTransaction = withHexPrefix(bufferToHex(serializedTransaction));
                } catch(err) {
                    return reject(new Error(`Could not create raw transaction: ${err.message}`));
                }
                // Send signed transaction and process mined receipt
                _ethApi.eth.sendSignedTransaction(rawTransaction)
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
    return ethRpc.getRawTransaction(transactionHash)
    .then(transaction => {
        if (!transaction) {
            return Promise.reject(new ProcessingError(`No transaction returned by ${_ethChain} node for hash: ${transactionHash}`, null, 'WF_API_NO_DATA'));
        }
        return Promise.resolve(transaction);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Extracts Whiteflag message from Ethereum transaction data
 * @function extractMessage
 * @alias module:lib/blockchains/ethereum/transactions.extractMessage
 * @param {Object} transaction
 * @param {number} timestamp the block time
 * @returns {Promise} resolves to a Whiteflag message
 */
 function extractMessage(transaction, timestamp) {
    if (_traceRaw) log.trace(MODULELOG, `Extracting Whiteflag message from ${_ethChain} transaction: ${transaction.hash}`);
    return new Promise((resolve, reject) => {
        if (
            !transaction ||
            !transaction.input ||
            !transaction.input.startsWith(ETHHEXPREFIX + WFINDENTIFIER)
        ) {
            return reject(new ProcessingError(`No Whiteflag message found in ${_ethChain} transaction: ${transaction.hash}`, null, 'WF_API_NO_DATA'));
        }
        // Get raw transaction data
        const rawTransactionObject = {
            nonce: transaction.nonce,
            gasPrice: ethUtil.bufferToHex(new ethUtil.BN(transaction.gasPrice)),
            gasLimit: transaction.gas,
            to: transaction.to,
            value: ethUtil.bufferToHex(new ethUtil.BN(transaction.value)),
            data: transaction.input,
            r: transaction.r,
            s: transaction.s,
            v: transaction.v
        };
        const ethTransactionObject = new EthereumTx(rawTransactionObject, { chain: _ethState.parameters.chainID });
        const orgPubkey = ethUtil.bufferToHex(ethTransactionObject.getSenderPublicKey());

        // Construct and return Whiteflag message object
        let wfMessage = {
            MetaHeader: {
                blockchain: _ethChain,
                blockNumber: transaction.blockNumber,
                transactionHash: noKeyHexPrefix(transaction.hash),
                transactionTime: '',
                originatorAddress: noAddressHexPrefix(transaction.from),
                originatorPubKey: noPubkeyHexPrefix(orgPubkey),
                encodedMessage: noKeyHexPrefix(transaction.input)
            }
        };
        if (timestamp) wfMessage.MetaHeader.transactionTime = new Date(timestamp * 1000).toISOString();
        return resolve(wfMessage);
    });
}

// PRIVATE TRANSACTION FUNCTIONS //
/**
 * Creates a new Ethereum transaction to be signed
 * @private
 * @param {Object} account the account parameters used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} value the value to be sent in ether
 * @param {string} data the data to be sent
 * @returns {Promise} resolves to a raw unsigned transaction object
 */
function createTransaction(account, toAddress, value, data) {
    return Promise.all([
        ethRpc.getTransactionCount(account.address),
        _ethApi.eth.estimateGas({
            to: withHexPrefix(toAddress),
            data: withHexPrefix(data)
        }),
        _ethApi.eth.getGasPrice()
    ])
    .then(result => {
        const txCount = result[0];
        const gasLimit = result[1];
        const gasPrice = result[2];
        const rawTransactionObject = {
            nonce: _ethApi.utils.toHex(txCount),
            to: withHexPrefix(toAddress),
            value: _ethApi.utils.toHex(_ethApi.utils.toWei(value, 'ether')),
            gasLimit: _ethApi.utils.toHex(gasLimit),
            gasPrice: _ethApi.utils.toHex(gasPrice),
            data: withHexPrefix(data)
        };
        return Promise.resolve(rawTransactionObject);
    })
    .catch(err => {
        return Promise.reject(new Error(`Could not create transaction: ${err.message}`));
    });
}
