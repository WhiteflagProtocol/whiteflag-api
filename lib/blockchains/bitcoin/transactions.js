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
    lookupMessage,
    getTransaction,
    extractMessage,
    getFee: getTransactionFee
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { ProcessingError, ProtocolError } = require('../../common/errors');

// Bitcoin sub-modules //
const bcRpc = require('./rpc');
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
        _transactionFee = bcConfig.transactionValue;
    }
    log.trace(_blockchainName, 'Transaction processing initialized.');
}

/**
 * Sends an transaction with an embedded Whiteflag message on the Bitcoin blockchain
 * @function sendTransaction
 * @alias module:lib/blockchains/bitcoin/transactions.sendTransaction
 * @param {Object} account the account used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} amount the amount of funds to be transfered with the transaction
 * @param {Buffer} data the data to be embedded in the OP_RETURN of the transaction
 * @param {blockchainSendTransactionCb} callback function to be called after sending teh transaction
 */
 function sendTransaction(account, toAddress, amount, data, callback) {
    // Extract and check transaction data
    let fromAddress = account.address;
    if (data.length > OPRETURNSIZE) {
        return callback(new ProcessingError(`Encoded message size of ${data.length} bytes exceeds maximum size of ${OPRETURNSIZE} bytes`, null, 'WF_API_BAD_REQUEST'));
    }
    // Create transaction
    try {
        // Add inputs to tranaction and calculate value
        let UtxoInputList = bcUtxo.getUtxosForTransaction(account, amount);
        let tx = bcUtxo.getTransactionInputs(UtxoInputList);
        let totalUtxoValue = bcUtxo.getTotalUtxoInputValue(UtxoInputList);

        // Add outputs to transaction
        if (data !== null) {
            // Embed data in unspendable OP_RETURN output
            const embed = bitcoin.payments.embed({ data: [data] });
            tx.addOutput(embed.output, 0);
        }
        if (account.address !== toAddress) {
            // Add amount to transfer to other address
            tx.addOutput(toAddress, amount);
        }
        // Unspent funds go back to account address, minus mining fee
        let returnValue = (totalUtxoValue - (amount + _transactionFee));
        tx.addOutput(fromAddress, returnValue);

        // Sign transaction
        let rawTransaction = bcUtxo.signTransaction(account, tx, UtxoInputList);

        // Send transaction to Bitcoin node
        bcRpc.sendSignedTransaction(rawTransaction)
        .then(function bitcoinSendSignedTransaction(txHash) {
            if (txHash === null) {
                return callback(new Error('Transaction not processed by node'), null);
            }
            bcUtxo.setUtxoStatus(UtxoInputList, account);
            account.balance = calculateAccountBalance(account);
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
 * Performs a simple query to find a message on Bitcoin by transaction hash
 * @function lookupMessage
 * @alias module:lib/blockchains/bitcoin/transactions.lookupMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {blockchainLookupMessageCb} callback function to be called after Whiteflag message lookup
 */
 function lookupMessage(wfQuery, callback) {
    log.trace(_blockchainName, 'Performing query: ' + JSON.stringify(wfQuery));

    // Get transaction from node
    bcRpc.getRawTransaction(wfQuery['MetaHeader.transactionHash'])
    .then(function bitcoinGetTransactionCb(transaction) {
        if (!transaction) return callback(new ProcessingError(`Transaction hash not found on ${_blockchainName}: ${wfQuery['MetaHeader.transactionHash']}`, null, 'WF_API_NO_RESOURCE'));
        if (_traceRawTransaction) log.trace(_blockchainName, `Transaction retrieved: ${JSON.stringify(transaction)}`);
        if (transaction.vout.length > 1) {
            // Check for Whiteflag prefix in transaction
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
