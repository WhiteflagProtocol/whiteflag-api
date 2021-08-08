'use strict';
/**
 * @module lib/blockchains/bitcoin/transactions
 * @summary Whiteflag API Bitcoin transaction module
 * @description Module to process Bitcoin transactions for Whiteflag
 */
module.exports = {
    // Bitcoin transaction functions
    init: initTransactions,
    sendMessage,
    lookupMessage,
    getTransaction,
    extractMessage,
    transferFunds,
    getFee: getTransactionFee
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { ProcessingError, ProtocolError } = require('../../common/errors');

// Bitcoin sub-modules //
const bcRpc = require('./rpc');
const bcAccounts = require('./accounts');
const bcUtxo = require('./utxo');
const { UTXOSTATUS } = require('./common');

// Module constants //
const WFINDENTIFIER = '5746';
const SCRIPTIDENTIFIER = 'OP_RETURN ';
const OPRETURNSIZE = 80;

// Module variables //
let _blockchainName;
let _bcState;
let _transactionFee = 4000;
let _transactionValue = 0;
let _traceRawTransaction;

/**
 * Initialises Bitcoin transactions processing
 * @function initTransactions
 * @alias module:lib/blockchains/bitcoin/transactions.init
 * @param {Object} bcConfig the Bitcoin blockchain configuration
 * @param {Object} bcState the Bitcoin blockchain state
 */
 function initTransactions(bcConfig, bcState) {
    _blockchainName = bcConfig.name;
    _bcState = bcState;
    if (bcConfig.traceRawTransaction) {
        _traceRawTransaction = bcConfig.traceRawTransaction;
    }
    if (bcConfig.transactionValue) {
        _transactionValue = bcConfig.transactionValue;
    }
    log.trace(_blockchainName, 'Transaction processing initialized.');
}

/**
 * Sends an encoded message on the Bitcoin blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/bitcoin/transactions.sendMessage
 * @param {Object} wfMessage the Whiteflag message to be sent on Bitcoin
 * @param {blockchainSendMessageCb} callback function to be called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    let account;
    try {
        account = checkAccount(wfMessage.MetaHeader.originatorAddress);
    } catch(err) {
        return callback(err, null);
    }
    sendOpReturnMessage(account, account.address, _transactionValue, wfMessage.MetaHeader.encodedMessage,
        function bitcoinSendMessageCb(err, txHash) {
            if (err) return callback(err, _blockchainName);
            return callback(null, txHash);
        }
    );
}

/**
 * Performs a simple query to find a message on Bitcoin by transaction hash
 * @function lookupMessage
 * @alias module:lib/blockchains/bitcoin/transactions.lookupMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {blockchainLookupMessageCb} callback function to be called after Whiteflag message lookup
 * @TODO remove dependency on higher level module ../bitcoin.js (bcMain)
 */
 function lookupMessage(wfQuery, callback) {
    log.trace(_blockchainName, 'Performing query: ' + JSON.stringify(wfQuery));
    bcRpc.getRawTransaction(wfQuery['MetaHeader.transactionHash']).then(function bitcoinGetTransactionCb(transaction) {
        if (!transaction) return callback(new ProcessingError(`Transaction hash not found on ${_blockchainName}: ${wfQuery['MetaHeader.transactionHash']}`, null, 'WF_API_NO_RESOURCE'));
        if (_traceRawTransaction) log.trace(_blockchainName, `Transaction retrieved: ${JSON.stringify(transaction)}`);
        if (transaction.vout.length > 1) {
            if (transaction.vout[1].scriptPubKey.asm.startsWith(SCRIPTIDENTIFIER + WFINDENTIFIER)) {
                let encodedMessage = transaction.vout[1].scriptPubKey.asm.split(' ');
                transaction.encodedMessage = encodedMessage;

                // Put transaction details in new Whiteflag message metaheader
                let wfMessage;
                try {
                    wfMessage = extractMessage(transaction);
                } catch(err) {
                    log.error(_blockchainName, `Error caught while extracting Whiteflag message from transaction ${transaction.hash}: ${err.toString()}`);
                    return callback(err, null);
                }
                // Return the found Whiteflag message
                log.trace(_blockchainName, 'Retrieved Whiteflag message: ' + JSON.stringify(wfMessage));
                return callback(null, wfMessage);
            }
        }
        // Check for Whiteflag prefix in transaction
        return callback(new ProcessingError(`Transaction ${wfQuery['MetaHeader.transactionHash']} does not contain a Whiteflag message`, null, 'WF_API_NO_DATA'));
    }).catch(function (err) {
        log.error(_blockchainName, `Error caught while retrieving Whiteflag message: ${err.toString()}`);
        return callback(err, null);
    });
}

/**
 * Gets a transaction by transaction hash and checks for Whiteflag message
 * @private
 * @param {string} transactionHash
 */
 function getTransaction(transactionHash, callback) {
    bcRpc.getRawTransaction(transactionHash).then(function bitcoinGetRawTransactionCb(transaction) {
        if (!transaction) {
            return callback(new Error(`No transaction data received for transaction hash: ${transactionHash}`));
        }
        if (transaction.vout.length <= 1) {
            return callback(new ProtocolError(`Transaction ${transactionHash} is not a Whiteflag message`));
        }
        for (let vout of transaction.vout) {
            if (vout.scriptPubKey.asm.startsWith(SCRIPTIDENTIFIER)) {
                let hexMessage = vout.scriptPubKey.asm;
                hexMessage = hexMessage.substring(hexMessage.indexOf(' ') + 1);
                const encodedMessage = Buffer.from(hexMessage, 'hex').toString();
                if (encodedMessage.startsWith(WFINDENTIFIER)) {
                    transaction.encodedMessage = encodedMessage;
                    // Put transaction details in new Whiteflag message metaheader
                    let wfMessage;
                    try {
                        wfMessage = extractMessage(transaction);
                    } catch(err) {
                        log.error(_blockchainName, `Error caught while converting transaction ${transaction.hash} to Whiteflag message object and recovering public key: ${err.toString()}`);
                    }
                    // Process the Whiteflag message in the rx event chain
                    log.trace(_blockchainName, 'Message is a whiteflag message: ' + JSON.stringify(wfMessage));
                    return callback(null, wfMessage);
                }
            }
        }
    }).catch(function (err) {
        log.error(_blockchainName, err);
    });
}


/**
 * Extracts Whiteflag message from Bitcoin transaction data
 * @private
 * @param {Object} transaction
 * @returns {Object} wfMessage a Whiteflag message
 */
 function extractMessage(transaction) {
    let { address } = bitcoin.payments.p2pkh({
        pubkey: pubkeyToBuffer(transaction.vin[0].scriptSig.asm.split('[ALL] ')[1]),
        network: _bcState.parameters.network
    });
    return {
        MetaHeader: {
            blockchain: _blockchainName,
            blockNumber: 0, // No longer necessary?
            transactionHash: transaction.hash,
            originatorAddress: address,
            originatorPubKey: transaction.vin[0].scriptSig.asm.split('[ALL] ')[1], // Find diffrent way to extract pubKey
            encodedMessage: transaction.encodedMessage
        }
    };
}

/**
 * Transfers bitcoin from one Bitcoin address to an other address
 * @function transferFunds
 * @alias module:lib/blockchains/bitcoin/transactions.transferValue
 * @param {Object} transferObj the object with the transaction details to transfer value
 * @param {blockchainTransferValueCb} callback function to be called upon completion
 */
 function transferFunds(transferObj, callback) {
    let fromAccount;
    try {
        fromAccount = checkAccount(transferObj.fromAddress);
    } catch(err) {
        return callback(err, null);
    }
    log.info('Transfering funds from account: ' + fromAccount + '  + to account : ' + transferObj.toAddress + ' transfer value :' + transferObj.value);
    sendTransaction(fromAccount, transferObj.toAddress, transferObj.value, function bitcoinValueTransferCb(err, txHash) {
        if (err) return callback(err, null);
        return callback(null, txHash);
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
    return new Promise(function (resolve, reject) {
        bcRpc.getRawTransaction(transactionHash)
        .then(function (transaction) {
            let totalOutputValue = 0;
            let totalInputValue = 0;
            let promises = [];
            transaction.vout.forEach(vout => {
                totalOutputValue += vout.value;
            });
            // loop through all inputs of the transaction, to find the input values
            transaction.vin.forEach(vin => {
                promises.push(
                    bcRpc.getRawTransaction(vin.transactionHash).then(function (inputTransaction) {
                        inputTransaction.vout.forEach(vout => {
                            if (vin.vout === vout.n && vout.value !== null) {
                                totalInputValue += vout.value;
                            }
                        });
                    }).catch(err => {
                        reject(err);
                    })
                );
            });
            Promise.all(promises).then(function () {
                let fee = (((totalInputValue - totalOutputValue) * 100000000) / transaction.size).toFixed();
                resolve(fee);
            }).catch(err => {
                reject(err);
            });
        }).catch(err => {
            reject(err);
        });
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Verifies if an account exists and the wallet is not syncing
 * @private
 * @param {Object} address the address parameters used to send the transaction from
 * @returns {Object} balance of the account
 * @TODO Replace throw with a callback
 */
function checkAccount(address) {
    let account = bcAccounts.getAccount(address);
    if (!account) {
        throw new ProcessingError(`No ${_blockchainName} account found with address: ${address}`);
    }
    if (account.walletSyncing === true) {
        throw new ProcessingError('wallet is syncing at blocknumber : ' + account.lastBlock + ' , wait until synchronization is finished', null);
    }
    return account;
}

/**
 * Sends a transaction on the Bitcoin blockchain
 * @private
 * @param {Object} account the account parameters used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} data the data to be sent
 * @param {function} callback
 */
function sendTransaction(account, toAddress, amount, callback) {
    try {
        let UtxoInputList = bcUtxo.getUtxosForTransaction(account, (amount + _transactionFee));
        let tx = bcUtxo.getTransactionInputs(UtxoInputList);
        let totalUtxoValue = bcUtxo.getTotalUtxoInputValue(UtxoInputList);

        if (account.address === toAddress) {
            tx.addOutput(toAddress, totalUtxoValue - _transactionFee);
        } else{
            tx.addOutput(toAddress, amount);
            let value = (totalUtxoValue - (amount + _transactionFee));
            tx.addOutput(account.address, value);
        }
        let rawTransaction = bcUtxo.signTransaction(account, tx, UtxoInputList);

        bcRpc.sendSignedTransaction(rawTransaction).then(function bitcoinSendSignedTransaction(txHash) {
            if (txHash === null) {
                return callback(new ProcessingError('transaction not processed'), null);
        } else {
            bcUtxo.setUtxoStatus(UtxoInputList, account);
            account.balance = calculateAccountBalance(account);
        }
            return callback(null, txHash);
        }, err => {
            if (err) return callback(err, null);
        });
    } catch(err) {
        log.error(_blockchainName, `Error caught while sending transaction: ${err.toString()}`);
        return callback(err);
    }
}

/**
 * Sends an transaction with an embedded Whiteflag message on the Bitcoin blockchain
 * @private
 * @param {Object} account the account parameters used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} encodedMessage the encoded Whiteflag message to be sent
 * @param {Function} callback
 */
function sendOpReturnMessage(account, toAddress, amount, encodedMessage, callback) {
    try {
        let UtxoInputList = bcUtxo.getUtxosForTransaction(account, amount);
        let tx = bcUtxo.getTransactionInputs(UtxoInputList);
        let totalUtxoValue = bcUtxo.getTotalUtxoInputValue(UtxoInputList);
        const data = Buffer.from(encodedMessage, 'hex');
        const embed = bitcoin.payments.embed({ data: [data] });

        tx.addOutput(embed.output, 0);
        tx.addOutput(toAddress, totalUtxoValue - amount);

        let rawTransaction = bcUtxo.signTransaction(account, tx, UtxoInputList);
        if (Buffer.from(encodedMessage, 'hex').length > OPRETURNSIZE) {
             throw new ProcessingError('size of message: ' + Buffer.from(encodedMessage, 'hex').length + ' is too large maximum size of the message = ' + OPRETURNSIZE);
        }
        bcRpc.sendSignedTransaction(rawTransaction).then(function bitcoinSendSignedTransaction(txHash) {
            if (txHash === null) {
                return callback(new ProcessingError('transaction not processed'), null);
        } else {
                bcUtxo.setUtxoStatus(UtxoInputList, account);
                account.balance = calculateAccountBalance(account);
                return callback(null, txHash);
                }
        }, err => {
            if (err) return callback(err, null);
        });
    } catch(err) {
        log.error(_blockchainName, `Error caught while sending transaction: ${err.toString()}`);
        return callback(err);
    }
}

/**
 * Calculates the account balance based on unspent utxos
 * @private
 * @param {Object} account
 * @returns {Object} balance of the account
 */
function calculateAccountBalance(account) {
    let unspentUtxos = [];
    for (let utxo of account.utxos) {
        if (utxo.spent === UTXOSTATUS.UNSPENT) {
            unspentUtxos.push(utxo);
        }
    }
    return unspentUtxos.reduce(function(a, b) {
        return a + b.value;
    }, 0);
}

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
