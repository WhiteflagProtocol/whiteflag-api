'use strict';
/**
 * @module lib/blockchains/bitcoin/utxo
 * @summary Whiteflag API Bitcoin UTXO module
 * @description Module for tracking Bitcoin UTXO
 */
module.exports = {
    init: initUtxo,
    signTransaction,
    setUtxoStatus,
    getTransactionInputs,
    getTotalUtxoInputValue,
    getUtxosForTransaction
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { ProcessingError } = require('../../common/errors');

// Bitcoin sub-modules //
const { UTXOSTATUS } = require('./common');

// Module variables //
let _blockchainName;
let _bcNetwork;

/**
 * Initialises Bitcoin UTXO tracking
 * @function initUtxo
 * @alias module:lib/blockchains/bitcoin/utxo.init
 * @param {Object} bcConfig the Bitcoin blockchain configuration
 * @param {Object} bcState the Bitcoin blockchain state
 */
 function initUtxo(bcConfig, bcState) {
    _blockchainName = bcConfig.name;
    _bcNetwork = bcState.network;
    log.trace(_blockchainName, 'UTXO tracking initialized.');
}

/**
 * Signs the transacton
 * @private
 * @param {Object} tx
 * @param {Object} account
 * @returns {Object} transaction hex
 */
function signTransaction(account, tx) {
    let privateKey = bitcoin.ECPair.fromWif(account.wif, _bcNetwork);
    for (let b = 0; b < tx.__inputs.length; b++) {
        tx.sign(b, privateKey);
    }
    return [tx.build().toHex()];
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
 * @returns {Object} tx
 */
function getTransactionInputs(UtxoInputList) {
    let tx = new bitcoin.TransactionBuilder(_bcNetwork);
    for (let utxo of UtxoInputList) {
        tx.addInput(utxo.txid, parseInt(utxo.index, 10));
    }
    return tx;
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
        throw new ProcessingError('Not enough satoshis to perform the transaction');
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
