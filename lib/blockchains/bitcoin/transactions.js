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
    extractMessage,
    getFee: getTransactionFee
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
const WFINDENTIFIER = '5746';
const SCRIPTIDENTIFIER = 'OP_RETURN';
const OPRETURNSIZE = 80;
const KEYIDLENGTH = 12;

// Module variables //
let _blockchainName;
let _bcState;
let _transactionFee = 4000;
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
function sendTransaction(account, toAddress, amount, data) {
    log.trace(_blockchainName, `Sending transaction from account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Extract and check transaction data
        const fromAddress = account.address;
        if (data.length > OPRETURNSIZE) {
            return reject(new ProcessingError(`Encoded message size of ${data.length} bytes exceeds maximum size of ${OPRETURNSIZE} bytes`, null, 'WF_API_BAD_REQUEST'));
        }
        // Calculate input UTXOs
        let utxoInputList = getUtxosForTransaction(account, amount);
        let totalUtxoValue = getTotalUtxoInputValue(utxoInputList);

        // Create transaction
        let transaction;
        try {
            transaction = createTransaction(utxoInputList, _bcState.parameters.network);
        } catch(err) {
            return reject(new Error(`Error creating transaction: ${err.message}`));
        }
        // Add data to transaction
        try {
            // Embed data in unspendable OP_RETURN output
            if (data !== null) {
                const embed = bitcoin.payments.embed({ data: [data] });
                transaction.addOutput(embed.output, 0);
            }
        } catch (err) {
            return reject(new Error(`Error embedding data in transaction: ${err.message}`));
        }
        // Add outputs to transaction
        try {
            // Aamount to transfer to other address
            if (fromAddress !== toAddress) {
                transaction.addOutput(toAddress, amount);
            }
            // Unspent funds go back to account address, minus mining fee
            const returnValue = (totalUtxoValue - (amount + _transactionFee));
            transaction.addOutput(fromAddress, returnValue);
        } catch (err) {
            return reject(new Error(`Error adding outputs to transaction: ${err.message}`));
        }
        // Sign and send transaction
        signTransaction(account, transaction, _bcState.parameters.network)
        .then(rawTransaction => {
            return bcRpc.sendSignedTransaction(rawTransaction);
        })
        .then(transactionHash => {
            if (transactionHash === null) return reject(new Error('Transaction not processed by node'), null);
            bcAccounts.updateUtxosSpent(account, utxoInputList);
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
 * @todo Find better way to extract pubKey
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
            const pubKey = transaction.vin[0].scriptSig.asm.split('[ALL] ')[1];
            const { address } = bitcoin.payments.p2pkh({
                pubkey: pubkeyToBuffer(pubKey),
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
                    originatorPubKey: pubKey,
                    encodedMessage: data
                }
            });
        }
        return reject(new ProcessingError(`No Whiteflag message data found in transaction: ${transaction.hash}`, null, 'WF_API_NO_DATA'));
    });
}

/**
 * Determines the fee in satoshis per byte of a given Bitcoin transaction
 * @function getTransactionFee
 * @alias module:lib/blockchains/bitcoin/transactions.getFee
 * @param {string} transactionHash
 * @returns {Promise} resolves to transaction fee
 */
function getTransactionFee(transactionHash) {
    log.trace(_blockchainName, `Determining fee of transaction: ${transactionHash}`);
    return new Promise((resolve, reject) => {
        bcRpc.getRawTransaction(transactionHash)
        .then(transaction => {
            let totalOutputValue = 0;
            let totalInputValue = 0;
            let inputsBatch = [];
            transaction.vout.forEach(vout => {
                totalOutputValue += vout.value;
            });
            // loop through all inputs of the transaction, to find the input values
            transaction.vin.forEach(vin => {
                inputsBatch.push(
                    bcRpc.getRawTransaction(vin.transactionHash)
                    .then(inputTransaction => {
                        inputTransaction.vout.forEach(vout => {
                            if (vin.vout === vout.n && vout.value !== null) {
                                totalInputValue += vout.value;
                            }
                        });
                    })
                    .catch(err => reject(err))
                );
            });
            Promise.all(inputsBatch)
            .then(() => {
                let fee = (((totalInputValue - totalOutputValue) * 100000000) / transaction.size).toFixed();
                resolve(fee);
            })
            .catch(err => reject(err));
        })
        .catch(err => reject(err));
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Converts public key string to buffer
 * @private
 */
 function pubkeyToBuffer(publicKey) {
    let bytes = new Uint8Array(Math.ceil(publicKey.length / 2));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(publicKey.substr(i * 2, 2), 16);
    }
    return bytes;
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
 * Sets the input values for a transaction
 * @private
 * @param {Array} utxoInputList the input UTXOs for the transaction
 * @param {Object} bcNetwork the Bitcoin network parameters
 * @returns {Object} transaction
 */
 function createTransaction(utxoInputList, bcNetwork) {
    let transaction = new bitcoin.TransactionBuilder(bcNetwork);
    for (let utxo of utxoInputList) {
        transaction.addInput(utxo.txid, parseInt(utxo.index, 10));
    }
    return transaction;
}

/**
 * Returns the total value of an UTXO list
 * @private
 * @param {Array} utxoInputList list of UTXOs
 * @returns {number} the total value of the UTXOs in the list
 */
function getTotalUtxoInputValue(utxoInputList) {
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
    for (let utxo of account.utxos) {
        if (!utxo.spent) unspentUtxos.push(utxo);
    }
    let totalUtxoValue = unspentUtxos.reduce((accumulator, utxo) => {
        return accumulator + utxo.value;
    }, 0);
    if (totalUtxoValue < amount || unspentUtxos.length < 1) {
        throw new Error('Not enough satoshis to perform the transaction');
    }
    unspentUtxos.sort((a, b) => a.value - b.value);
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
    for (let y = 0; y <= unspentUtxos.length; y++) {
        utxoInputs.push(unspentUtxos[y]);
        let sum = utxoInputs.reduce((accumulator, utxo) => {
            return accumulator + utxo.value;
        }, 0);
        if (sum >= amount) {
            return utxoInputs;
        }
    }
    return utxoInputs;
}
