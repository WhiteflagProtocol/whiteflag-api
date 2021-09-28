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
    getTransaction,
    extractMessage,
    getFee: getTransactionFee
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { ProcessingError } = require('../../common/errors');

// Bitcoin sub-modules //
const bcCommon = require('./common');
const bcRpc = require('./rpc');
const bcAccounts = require('./accounts');

// Module constants //
const WFINDENTIFIER = '5746';
const SCRIPTIDENTIFIER = 'OP_RETURN ';
const OPRETURNSIZE = 80;
const UTXOSTATUS = bcCommon.getUxtoStatuses();

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

    // Get vconfiguration paramters
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
        // Create transaction
        let rawTransaction;
        let utxoInputList;
        try {
            // Add inputs to tranaction and calculate value
            utxoInputList = getUtxosForTransaction(account, amount);
            let transaction = getTransactionInputs(utxoInputList, _bcState.network);
            let totalUtxoValue = getTotalUtxoInputValue(utxoInputList);

            // Add output: embed data in unspendable OP_RETURN output
            if (data !== null) {
                const embed = bitcoin.payments.embed({ data: [data] });
                transaction.addOutput(embed.output, 0);
            }
            // Add output: amount to transfer to other address
            if (fromAddress !== toAddress) {
                transaction.addOutput(toAddress, amount);
            }
            // Add output: unspent funds go back to account address, minus mining fee
            const returnValue = (totalUtxoValue - (amount + _transactionFee));
            transaction.addOutput(fromAddress, returnValue);

            // Sign transaction
            rawTransaction = signTransaction(account, transaction, utxoInputList);
        } catch(err) {
            return reject(err);
        }
        // Send transaction to Bitcoin node
        bcRpc.sendSignedTransaction(rawTransaction)
        .then(txHash => {
            if (txHash === null) return reject(new Error('Transaction not processed by node'), null);
            setUtxoStatus(account, utxoInputList);
            bcAccounts.updateBalance(account);
            resolve(txHash);
        })
        .catch(err => reject(err));
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
        let wfMessage;
        try {
            let encodedMessage;
            for (let vout of transaction.vout) {
                if (!vout.scriptPubKey.asm.startsWith(SCRIPTIDENTIFIER)) {
                    return reject(new ProcessingError(`No Whiteflag message found in transaction: ${transaction.hash}`, null, 'WF_API_NO_DATA'));
                }
                const opReturn = vout.scriptPubKey.asm;
                const hexMessage = opReturn.substring(opReturn.indexOf(' ') + 1);
                if (!hexMessage.startsWith(WFINDENTIFIER)) {
                    return reject(new ProcessingError(`No Whiteflag message found in transaction: ${transaction.hash}`, null, 'WF_API_NO_DATA'));
                }
                encodedMessage = Buffer.from(hexMessage, 'hex').toString();
            }
            let { address } = bitcoin.payments.p2pkh({
                pubkey: pubkeyToBuffer(transaction.vin[0].scriptSig.asm.split('[ALL] ')[1]),
                network: _bcState.parameters.network
            });
            wfMessage = {
                MetaHeader: {
                    blockchain: _blockchainName,
                    blockNumber: blockNumber,
                    transactionHash: transaction.hash,
                    transactionTime: '',
                    originatorAddress: address,
                    originatorPubKey: transaction.vin[0].scriptSig.asm.split('[ALL] ')[1],
                    encodedMessage: encodedMessage
                }
            };
            if (timestamp) wfMessage.MetaHeader.transactionTime = new Date(timestamp * 1000).toISOString();
        } catch(err) {
            return reject(new Error(`Error extracting Whiteflag message from transaction: ${transaction.hash}`));
        }
        return resolve(wfMessage);
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
 * @param {Object} transaction
 * @param {Object} account
 * @param {Object} bcNetwork
 * @returns {Object} transaction hex
 */
 function signTransaction(account, transaction, bcNetwork) {
    let privateKey = bitcoin.ECPair.fromWif(account.wif, bcNetwork);
    for (let b = 0; b < transaction.__inputs.length; b++) {
        transaction.sign(b, privateKey);
    }
    return [transaction.build().toHex()];
}

/**
 * Sets the input values for a transaction
 * @private
 * @param {Object} UtxoInputList
 * @param {Object} bcNetwork
 * @returns {Object} transaction
 */
 function getTransactionInputs(UtxoInputList, bcNetwork) {
    let transaction = new bitcoin.TransactionBuilder(bcNetwork);
    for (let utxo of UtxoInputList) {
        transaction.addInput(utxo.txid, parseInt(utxo.index, 10));
    }
    return transaction;
}

/**
 * Returns the total UTXO value
 * @private
 * @param {Object} UtxoInputList
 * @returns {number} Total UXTO input value
 */
function getTotalUtxoInputValue(UtxoInputList) {
    return UtxoInputList.reduce(function (accumulator, uxto) {
        return accumulator + uxto.value;
    }, 0);
}

/**
 * Returns a list of possible UTXO sets that meets or is greater then the target value
 * @private
 * @param {Object} account
 * @param {Object} amount
 * @returns {Array} Input UXTOs sets
 */
function getUtxosForTransaction(account, amount) {
    let unspentUtxos = [];
    for (let utxo of account.utxos) {
        if (utxo.spent === UTXOSTATUS.UNSPENT) {
            unspentUtxos.push(utxo);
        }
    }
    let totalUtxoValue = unspentUtxos.reduce((accumulator, uxto) => {
        return accumulator + uxto.value;
    }, 0);
    if (totalUtxoValue < amount || unspentUtxos.length < 1) {
        throw new Error('Not enough satoshis to perform the transaction');
    }
    unspentUtxos.sort((a, b) => a.value - b.value);
    return getUtxoInputs(unspentUtxos, amount);
}

/**
 * Returns a list of UTXOs that meet or are greater then the target value
 * @private
 * @param {Object} unspentUtxos
 * @returns {Array} Input UTXOs
 */
function getUtxoInputs(unspentUtxos, data) {
    let utxoInputs = [];
    for (let y = 0; y <= unspentUtxos.length; y++) {
        utxoInputs.push(unspentUtxos[y]);
        let sum = utxoInputs.reduce((accumulator, uxto) => {
            return accumulator + uxto.value;
        }, 0);
        if (sum >= data) {
            return utxoInputs;
        }
    }
    return utxoInputs;
}

/**
 * Sets the status of the UXTOs for an account
 * @private
 * @param {Object} account the account to be 
 * @param {Object} UtxoInputList the UXTO input of a transaction
 * @returns {Object} the updated account
 */
 function setUtxoStatus(account, utxoInputList) {
    if (utxoInputList.length > 0) {
        utxoInputList.forEach(utxoInput => {
            account.utxos.forEach(utxoAccount => {
                if (utxoAccount.txid === utxoInput.txid) {
                    utxoAccount.spent = UTXOSTATUS.NEEDSVERIFICATION;
                }
            });
        });
    } else {
        account.utxos.forEach(utxoAccount => {
            if (utxoAccount.txid === utxoInputList.txid) {
                utxoAccount.spent = UTXOSTATUS.NEEDSVERIFICATION;
            }
        });
    }
    return account;
}
