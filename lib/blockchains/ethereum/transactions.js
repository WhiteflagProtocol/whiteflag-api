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
const ethereumUtil = require('ethereumjs-util');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { hash, zeroise } = require('../../common/crypto');
const { ProcessingError } = require('../../common/errors');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Ethereum sub-modules //
const ethRpc = require('./rpc');
const { formatHexEthereum, formatHexApi, formatAddressApi, formatPubkeyApi } = require('./common');

// Module constants //
const ETHHEXPREFIX = '0x';
const WFINDENTIFIER = '5746';
const BINENCODING = 'hex';
const KEYIDLENGTH = 12;

// Module variables //
let _blockchainName;
let _ethState;
let _web3;
let _traceRawTransaction = false;

/**
 * Initialises Ethereum Transactions processing
 * @function initTransactions
 * @alias module:lib/blockchains/ethereum/transactions.init
 * @param {Object} ethConfig the Ethereum blockchain configuration
 * @param {Object} ethState the Ethereum blockchain state
 * @param {Object} web3 the Ethereum Web3 instance
 * @returns {Promise} resolve if succesfully initialised
 */
function initTransactions(ethConfig, ethState, web3) {
    _blockchainName = ethConfig.name;
    _ethState = ethState;
    _web3 = web3;
    log.trace(_blockchainName, 'Initialising Ethereum transaction processing...');

    // Trace all transactions if configured
    if (ethConfig.traceRawTransaction) _traceRawTransaction = ethConfig.traceRawTransaction;

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
    log.trace(_blockchainName, `Sending transaction from account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Create transaction
        createTransaction(account, toAddress, value, data)
        .then(rawTransactionObject => {
            // Get the private key to sign the transaction
            const privateKeyId = hash(_blockchainName + formatAddressApi(account.address), KEYIDLENGTH);
            wfState.getKey('blockchainKeys', privateKeyId, function ethGetKeyCb(keyErr, privateKey) {
                if (keyErr) return reject(keyErr);

                // Sign and serialise transaction
                let rawTransaction;
                try {
                    const ethTransactionObject = new EthereumTx(rawTransactionObject, { chain: _ethState.parameters.chainID });
                    const privateKeyBuffer = Buffer.from(privateKey, BINENCODING);
                    ethTransactionObject.sign(privateKeyBuffer);
                    zeroise(privateKeyBuffer);

                    const serializedTransaction = ethTransactionObject.serialize();
                    rawTransaction = formatHexEthereum(serializedTransaction.toString(BINENCODING));
                } catch(err) {
                    return reject(new Error(`Could not create raw transaction: ${err.message}`));
                }
                // Send signed transaction and process mined receipt
                _web3.eth.sendSignedTransaction(rawTransaction)
                .then(receipt => resolve(formatHexApi(receipt.transactionHash), receipt.blockNumber))
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
    return ethRpc.getRawTransaction(transactionHash)
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
 * Extracts Whiteflag message from Ethereum transaction data
 * @function extractMessage
 * @alias module:lib/blockchains/ethereum/transactions.extractMessage
 * @param {Object} transaction
 * @param {number} timestamp the block time
 * @returns {Promise} resolves to a Whiteflag message
 */
 function extractMessage(transaction, timestamp) {
    if (_traceRawTransaction) log.trace(_blockchainName, `Extracting Whiteflag message from transaction: ${transaction.hash}`);
    return new Promise((resolve, reject) => {
        if (
            !transaction ||
            !transaction.input ||
            !transaction.input.startsWith(ETHHEXPREFIX + WFINDENTIFIER)
        ) {
            return reject(new ProcessingError(`No Whiteflag message found in transaction: ${transaction.hash}`, null, 'WF_API_NO_DATA'));
        }
        // Get raw transaction data
        const rawTransactionObject = {
            nonce: transaction.nonce,
            gasPrice: ethereumUtil.bufferToHex(new ethereumUtil.BN(transaction.gasPrice)),
            gasLimit: transaction.gas,
            to: transaction.to,
            value: ethereumUtil.bufferToHex(new ethereumUtil.BN(transaction.value)),
            data: transaction.input,
            r: transaction.r,
            s: transaction.s,
            v: transaction.v
        };
        const ethTransactionObject = new EthereumTx(rawTransactionObject, { chain: _ethState.parameters.chainID });
        const originatorPubKey = ethereumUtil.bufferToHex(ethTransactionObject.getSenderPublicKey());

        // Construct and return Whiteflag message object
        let wfMessage = {
            MetaHeader: {
                blockchain: _blockchainName,
                blockNumber: transaction.blockNumber,
                transactionHash: formatHexApi(transaction.hash),
                transactionTime: '',
                originatorAddress: formatAddressApi(transaction.from),
                originatorPubKey: formatPubkeyApi(originatorPubKey),
                encodedMessage: formatHexApi(transaction.input)
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
        _web3.eth.estimateGas({
            to: formatHexEthereum(toAddress),
            data: formatHexEthereum(data)
        }),
        _web3.eth.getGasPrice()
    ])
    .then(result => {
        const txCount = result[0];
        const gasLimit = result[1];
        const gasPrice = result[2];
        const rawTransactionObject = {
            nonce: _web3.utils.toHex(txCount),
            to: formatHexEthereum(toAddress),
            value: _web3.utils.toHex(_web3.utils.toWei(value, 'ether')),
            gasLimit: _web3.utils.toHex(gasLimit),
            gasPrice: _web3.utils.toHex(gasPrice),
            data: formatHexEthereum(data)
        };
        return Promise.resolve(rawTransactionObject);
    })
    .catch(err => {
        return Promise.reject(new Error(`Could not create transaction: ${err.message}`));
    });
}
