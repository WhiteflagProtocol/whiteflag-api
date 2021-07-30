module.exports = {
    signTransaction,
    setUtxoStatus,
    getTransactionInputs,
    getTotalUtxoInputValue,
    setBitcoinUtxoServiceValues,
    getUtxosForTransaction
};

const bitcoin = require('bitcoinjs-lib');
const { ProcessingError } = require('../../common/errors');

let _network

function setBitcoinUtxoServiceValues(network){
    _network = network
}

/**
 * Signs the transacton
 * @private
 * @param {Object} tx
 * @param {Object} account
 * @returns {Object} transaction hex
 */
function signTransaction(account, tx){
    let privateKey = bitcoin.ECPair.fromWIF(account.wif,
        _network);
    for (var b = 0; b < tx.__inputs.length; b++) {
        tx.sign(b, privateKey)
    }
    let raw = [tx.build().toHex()];
    return raw;
}

/**
 * Sets the status of the utxos for an account
 * @private
 * @param {Object} UtxoInputList
 * @param {Object} account
 */
function setUtxoStatus(utxoInputList, account){
    if (utxoInputList.length > 0) {
        utxoInputList.forEach(utxoInput => {
            account.utxos.forEach(utxoAccount => {
                if (utxoAccount.txid == utxoInput.txid) {
                    utxoAccount.spent = 'SPENT NEEDS VERIFICATION'
                }
            })
        }
        )
    } else {
        account.utxos.forEach(utxoAccount => {
            if (utxoAccount.txid == utxoInputList.txid) {
                utxoAccount.spent = 'SPENT NEEDS VERIFICATION'
            }
        })
    }
}

/**
 * Sets the input values for a transaction
 * @private
 * @param {Object} UtxoInputList
 * @returns {Object} tx
 */
function getTransactionInputs(UtxoInputList){
        var tx = new bitcoin.TransactionBuilder(_network);
            for (let utxo of UtxoInputList) {
                tx.addInput(utxo.txid, parseInt(utxo.index, 10))
            }
        return tx;
}

/**
 * Returns the total utxo value
 * @private
 * @param {Object} UtxoInputList
 * @returns {Object} totalUtxoValue
 */
function getTotalUtxoInputValue(UtxoInputList){
    let totalUtxoValue
        totalUtxoValue = UtxoInputList.reduce(function (a, b) {
            return a + b.value
        }, 0)   
    return totalUtxoValue
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
        if (utxo.spent == 'UNSPENT') {
            unspentUtxos.push(utxo)
        }
    }
    let totalUtxoValue = unspentUtxos.reduce(function(a, b) {
        return a + b.value
    }, 0)
    if(totalUtxoValue < amount | unspentUtxos.length<1){
        throw new ProcessingError('Not enough satoshis to perform the transaction')}
    unspentUtxos.sort((a, b) => a.value - b.value);
    let utxoInputs = getUtxoInputs(unspentUtxos,amount);
    return utxoInputs
}

/**
 * Returns a list of UTXO's that meets or is greater then the target value 
 * @private
 * @param {Object} unspentUtxos
 * @returns {Object} possibleUtxoSets
 */
 function getUtxoInputs(unspentUtxos, data){
    utxoInputs = []
    for (let y = 0; y <= unspentUtxos.length; y++) {
        utxoInputs.push(unspentUtxos[y])
        let sum = utxoInputs.reduce(function(a, b) {
            return a + b.value
        }, 0)
        if (sum >= data){
            return utxoInputs;
        }
    }
    return utxoInputs
 }

