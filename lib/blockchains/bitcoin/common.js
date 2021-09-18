'use strict';
/**
 * @module lib/blockchains/bitcoin/common
 * @summary Whiteflag API Bitcoin common module
 * @description Module defining common Bitcoin functions and data
 */
 module.exports = {
    getUxtoStatuses,
    signTransaction,
    setUtxoStatus,
    getTransactionInputs,
    getTotalUtxoInputValue,
    getUtxosForTransaction
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');

// Module constants //
const UTXOSTATUS = {
    SPENT: 'SPENT',
    NEEDSVERIFICATION: 'NEEDSVERIFICATION',
    UNSPENT: 'UNSPENT',
    SPENTVERIFIED: 'SPENTVERIFIED'
};


/**
 * Returns UXTO Statuses
 * @returns {Object} UXTO Statuses
 */
 function getUxtoStatuses() {
    return UTXOSTATUS;
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
 * Sets the status of the utxos for an account
 * @private
 * @param {Object} UtxoInputList
 * @param {Object} account
 */
function setUtxoStatus(utxoInputList, account) {
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
 * @returns {Object} totalUtxoValue
 */
function getTotalUtxoInputValue(UtxoInputList) {
    return UtxoInputList.reduce(function (a, b) {
        return a + b.value;
    }, 0);
}

/**
 * Returns a list of possible UTXO sets that meets or is greater then the target value
 * @private
 * @param {Object} account
 * @param {Object} amount
 * @returns {Object} utxoInputs
 */
function getUtxosForTransaction(account, amount) {
    let unspentUtxos = [];
    for (let utxo of account.utxos) {
        if (utxo.spent === UTXOSTATUS.UNSPENT) {
            unspentUtxos.push(utxo);
        }
    }
    let totalUtxoValue = unspentUtxos.reduce(function(a, b) {
        return a + b.value;
    }, 0);
    if (totalUtxoValue < amount || unspentUtxos.length < 1) {
        throw new Error('Not enough satoshis to perform the transaction');
    }
    unspentUtxos.sort((a, b) => a.value - b.value);
    return getUtxoInputs(unspentUtxos, amount);
}

/**
 * Returns a list of UTXOs that meets or is greater then the target value
 * @private
 * @param {Object} unspentUtxos
 * @returns {Object} possibleUtxoSets
 */
 function getUtxoInputs(unspentUtxos, data) {
    let utxoInputs = [];
    for (let y = 0; y <= unspentUtxos.length; y++) {
        utxoInputs.push(unspentUtxos[y]);
        let sum = utxoInputs.reduce(function(a, b) {
            return a + b.value;
        }, 0);
        if (sum >= data) {
            return utxoInputs;
        }
    }
    return utxoInputs;
 }

