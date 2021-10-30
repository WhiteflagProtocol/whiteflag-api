'use strict';
/**
 * @module lib/blockchains/bitcoin/transactions
 * @summary Whiteflag API Bitcoin transaction module
 * @description Module to process Bitcoin transactions for Whiteflag
 */
module.exports = {
    // Bitcoin transaction functions
    init: initTransactions,
    send: sendTransaction,
    get: getTransaction,
    extractMessage
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { hash } = require('../../common/crypto');
const { ProcessingError } = require('../../common/errors');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Bitcoin sub-modules //
const bcRpc = require('./rpc');
const bcAccounts = require('./accounts');

// Module constants //
const BINENCODING = 'hex';
const WFINDENTIFIER = '5746';
const SCRIPTIDENTIFIER = 'OP_RETURN';
const OPRETURNSIZE = 80;
const KEYIDLENGTH = 12;
const KILOBYTE = 1024;
const SATOSHI = 100000000;
const P2PKHOUTPUTBYTES = 33;
const P2PKHINPUTBUTES = 146;

// Module variables //
let _blockchainName;
let _bcState;
let _transactionFee = 1000;
let _transactionPriority = 0;
let _traceRawTransaction = false;

/**
 * Initialises Bitcoin transactions processing
 * @function initTransactions
 * @alias module:lib/blockchains/bitcoin/transactions.init
 * @param {Object} bcConfig the Bitcoin blockchain configuration
 * @param {Object} bcState the Bitcoin blockchain state
 * @returns {Promise} resolves if completed
 */
function initTransactions(bcConfig, bcState) {
    _blockchainName = bcConfig.name;
    _bcState = bcState;
    log.trace(_blockchainName, 'Initialising Bitcoin transaction processing...');

    // Get configuration paramters
    if (bcConfig.transactionValue) _transactionFee = bcConfig.transactionValue;
    if (bcConfig.transactionPriority) _transactionPriority = bcConfig.transactionPriority;
    if (bcConfig.traceRawTransaction) _traceRawTransaction = bcConfig.traceRawTransaction;

    // Succesfully completed initialisation
    return Promise.resolve();
}

/**
 * Sends an transaction with an embedded Whiteflag message on the Bitcoin blockchain
 * @function sendTransaction
 * @alias module:lib/blockchains/bitcoin/transactions.sendTransaction
 * @param {Object} account the account used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} amount the amount of funds to be transfered with the transaction
 * @param {Buffer} data the data to be embedded in the OP_RETURN of the transaction
 * @returns {Promise} resolves to transaction hash
 */
function sendTransaction(account, toAddress, amount, data = null) {
    log.trace(_blockchainName, `Sending transaction from account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Check transaction data
        if (data && data.length > OPRETURNSIZE) {
            return reject(new ProcessingError(`Encoded message size of ${data.length} bytes exceeds maximum size of ${OPRETURNSIZE} bytes`, null, 'WF_API_BAD_REQUEST'));
        }
        // Create transaction
        let inputs = getUtxosForTransaction(account, amount);
        let transaction;
        try {
            transaction = createTransaction(account, toAddress, inputs, amount, data);
        } catch(err) {
            resolve(new ProcessingError(`Could not create transaction: ${err.message}`));
        }
        // Sign and send transaction
        signTransaction(account, transaction, _bcState.parameters.network)
        .then(signedTransaction => {
            return bcRpc.sendSignedTransaction(signedTransaction);
        })
        .then(transactionHash => {
            if (transactionHash === null) return reject(new Error('Transaction not processed by node'), null);
            bcAccounts.updateUtxosSpent(account, inputs);
            resolve(transactionHash);
        })
        .catch(err => reject(new Error(`Error signing and sending transaction: ${err.message}`)));
    });
}

/**
 * Gets a transaction by transaction hash and checks for Whiteflag message
 * @private
 * @param {string} transactionHash
 * @returns {Promise} resolves to a Whiteflag message
 */
function getTransaction(transactionHash) {
    log.trace(_blockchainName, `Retrieving transaction: ${transactionHash}`);
    return new Promise((resolve, reject) => {
        bcRpc.getRawTransaction(transactionHash)
        .then(transaction => {
            if (!transaction) {
                return reject(new Error(`No data received for transaction hash: ${transactionHash}`));
            }
            resolve(transaction);
        })
        .catch(err => reject(err));
    });
}

/**
 * Extracts Whiteflag message from Bitcoin transaction data
 * @param {Object} transaction
 * @param {number} blockNumber the block number
 * @param {number} timestamp the block or transaction time
 * @returns {Promise} resolves to a Whiteflag message
 */
function extractMessage(transaction, blockNumber, timestamp) {
    if (_traceRawTransaction) log.trace(_blockchainName, `Extracting Whiteflag message from transaction: ${transaction.hash}`);
    return new Promise((resolve, reject) => {
        for (let vout of transaction.vout) {
            // Check for opreturn
            const asm = vout.scriptPubKey.asm;
            if (!asm.startsWith(SCRIPTIDENTIFIER)) continue;

            // Check for Whiteflag message identifier
            const data = asm.substring(SCRIPTIDENTIFIER.length + 1);
            if (!data.startsWith(WFINDENTIFIER)) continue;

            // Get transaction time
            let transactionTime;
            if (Object.prototype.hasOwnProperty.call(transaction, 'time')) {
                transactionTime = new Date(transaction.time * 1000).toISOString();
            } else {
                transactionTime = new Date(timestamp * 1000).toISOString();
            }
            // Get originator address and public key
            const publicKey = transaction.vin[0].scriptSig.asm.split('[ALL] ')[1];
            const { address } = bitcoin.payments.p2pkh({
                pubkey: Buffer.from(publicKey, BINENCODING),
                network: _bcState.parameters.network
            });
            // Return a new Whiteflag message object
            return resolve({
                MetaHeader: {
                    blockchain: _blockchainName,
                    blockNumber: blockNumber,
                    transactionHash: transaction.hash,
                    transactionTime: transactionTime,
                    originatorAddress: address,
                    originatorPubKey: publicKey,
                    encodedMessage: data
                }
            });
        }
        return reject(new ProcessingError(`No Whiteflag message data found in transaction: ${transaction.hash}`, null, 'WF_API_NO_DATA'));
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Creates a new Bitcoin transaction
 * @private
 * @param {Object} account the account used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} amount the amount of funds to be transfered with the transaction
 * @param {Buffer} data the data to be embedded in the OP_RETURN of the transaction
 * @returns {Object} the newly create transaction
 */
 function createTransaction(account, toAddress, inputs, amount, data = null) {
    // New transactions
    let transaction = new bitcoin.TransactionBuilder(_bcState.parameters.network);

    // Transaction inputs
    let inputValue = sumUtxos(inputs);
    for (let utxo of inputs) {
        transaction.addInput(utxo.txid, +utxo.index);
    }
    // Embed data in transaction
    let outputLength = P2PKHOUTPUTBYTES;
    if (data !== null) {
        const embed = bitcoin.payments.embed({ data: [data] });
        transaction.addOutput(embed.output, 0);
        outputLength += 2 + data.length;
    }
    // Aamount to transfer to other address
    if (account.address !== toAddress) {
        transaction.addOutput(toAddress, amount);
        outputLength += P2PKHOUTPUTBYTES;
    }
    // Unspent funds go back to account address, minus mining fee
    const transactionSize = (inputs.length * P2PKHINPUTBUTES) + (outputLength) + 10;
    const transactionFee = getTransactionFee((transactionSize));
    const returnValue = (inputValue - (amount + transactionFee));
    transaction.addOutput(account.address, returnValue);

    // Return the new transaction
    log.debug(_blockchainName, `Created a new Bitcoin transaction with a fee of ${transactionFee} satoshis`);
    return transaction;
}

/**
 * Determines the fee for a new transaction in satoshis
 * @private
 * @param {string} transactionHash
 * @returns {Promise} resolves to transaction fee
 */
function getTransactionFee(transactionSize) {
    // Use fixed transaction fee if priority not set or unkown fee rate
    if (!_transactionPriority) return _transactionFee;
    if (!_bcState.status.feerate) return _transactionFee;

    // Calculate and return fee
    return Math.ceil((_bcState.status.feerate * SATOSHI) * (transactionSize / KILOBYTE));
}

/**
 * Signs a transacton
 * @private
 * @param {Object} transaction the transaction to sign
 * @param {Object} account the account making the transaction
 * @param {Object} bcNetwork the Bitcoin network parameters
 * @returns {Promise} resolves to the transaction in hexadecimal format
 */
 function signTransaction(account, transaction, bcNetwork) {
    return new Promise((resolve, reject) => {
        const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
        wfState.getKey('blockchainKeys', privateKeyId, function bcGetKeyCb(err, privateKey) {
            if (err) return reject(err);

            // Get keys in the correct encoding and sign inputs
            const privateKeyBuffer = Buffer.from(privateKey, 'hex');
            const keyPair = bitcoin.ECPair.fromPrivateKey(privateKeyBuffer, { network: bcNetwork });
            for (let b = 0; b < transaction.__inputs.length; b++) {
                transaction.sign(b, keyPair);
            }
            return resolve([transaction.build().toHex()]);
        });
    });
}

/**
 * Returns the total value of an UTXO list
 * @private
 * @param {Array} utxoInputList list of UTXOs
 * @returns {number} the total value of the UTXOs in the list
 */
function sumUtxos(utxoInputList) {
    return utxoInputList.reduce((accumulator, utxo) => {
        return accumulator + utxo.value;
    }, 0);
}

/**
 * Returns a list of unspent UTXOs of the specified account that meets or exceeds the required amount
 * @private
 * @param {Object} account the account making the transaction
 * @param {Object} amount the required amount
 * @returns {Array} list of unspent UTXOs providing the required amount
 */
function getUtxosForTransaction(account, amount) {
    let unspentUtxos = [];
    let totalValue = 0;
    for (let utxo of account.utxos) {
        if (!utxo.spent) unspentUtxos.push(utxo);
        totalValue += utxo.value;
    }
    if (totalValue < amount || unspentUtxos.length < 1) {
        throw new Error('Not enough satoshis to perform the transaction');
    }
    unspentUtxos.sort((a, b) => {
        return a.value - b.value;
    });
    return getUtxoInputs(unspentUtxos, amount);
}

/**
 * Returns a subset of the provided unspent UTXOs that meets or exceeds the required amount
 * @private
 * @param {Array} unspentUtxos list of unspent UTXOs
 * @param {Object} amount the required amount
 * @returns {Array} list of unspent UTXOs providing the required amount
 */
function getUtxoInputs(unspentUtxos, amount) {
    let utxoInputs = [];
    let totalInput = 0;
    for (let utxo of unspentUtxos) {
        utxoInputs.push(utxo);
        totalInput += utxo.value;
        if (totalInput >= amount) {
            return utxoInputs;
        }
    }
    return utxoInputs;
}
