module.exports = {
    // Bitcoin blockchain functionsns 
    transfer,
    sendMessage,
    sendTransaction,
    sendOpReturnMessage,
    getBitcoinFee,
    lookupMessage,
    setTransactionServiceValues
};

const bitcoinRpcService = require('./bitcoinRpcService')
const bitcoinAccountService = require('./bitcoinAccountService')
const bitcoinUtxoService = require('./bitcoinUtxoService')
const bitcoin = require('bitcoinjs-lib');
const { ProcessingError } = require('../../common/errors');


const log = require('../../common/logger');

let _blockchainName;
let _transactionFee = 1000;
let _traceRawTransaction;

function setTransactionServiceValues(blockchainName, traceRawTransaction){
    _blockchainName = blockchainName
    _traceRawTransaction = traceRawTransaction
}

/**
 * Transfers bitcoin from one Bitcoin address to an other address
 * @function transferValue
 * @alias module:lib/blockchains/bitcoin.transferValue
 * @param {object} transfer the object with the transaction details to transfer value
 * @param {blockchainTransferValueCb} callback function to be called upon completion
 */
function transfer(transfer, callback) {
    let fromAccount = bitcoinAccountService.getAccount(transfer.fromAddress);
    if (!fromAccount) return callback(new ProcessingError(`No ${_blockchainName} account found with address: ${transfer.fromAddress}`));
    log.info("TRANSFERING FUNDS + FROM ACCOUNT: " + fromAccount + "  + TO ACCOUNT : " + transfer.toAddress + " transfer value :" + transfer.value)
    sendTransaction(fromAccount, transfer.toAddress, transfer.value, function bitcoinValueTransferCb(err, txHash) {
        if (err) return callback(err, null);
        return callback(null, txHash);
    });
}

/**
 * Sends an encoded message on the Bitcoin blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/bitcoin.sendMessage
 * @param {object} wfMessage the Whiteflag message to be sent on Bitcoin
 * @param {blockchainSendMessageCb} callback function to be called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    let account = bitcoinAccountService.getAccount(wfMessage.MetaHeader.originatorAddress);
    if (!account) return callback(new ProcessingError(`No ${_blockchainName} account found with address: ${wfMessage.MetaHeader.originatorAddress}`));
    sendOpReturnMessage(account, account.address, _transactionFee, wfMessage.MetaHeader.encodedMessage,
        function bitcoinSendMessageCb(err, txHash) {
            if (err) return callback(err, _blockchainName);
            return callback(null, txHash);
        }
    );
}

/**
 * Sends a transaction on the Bitcoin blockchain
 * @private
 * @param {object} account the account parameters used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} data the data to be sent
 * @param {function} callback
 */
function sendTransaction(account, toAddress, amount, callback) {
    try {
        let UtxoInputList = bitcoinUtxoService.getUtxosForTransaction(account, (amount + _transactionFee))
        var tx = bitcoinUtxoService.getTransactionInputs(UtxoInputList);
        var totalUtxoValue = bitcoinUtxoService.getTotalUtxoInputValue(UtxoInputList)

        if(account.address == toAddress){
            tx.addOutput(toAddress, totalUtxoValue - _transactionFee)
        } else{
            tx.addOutput(toAddress, amount);
            let value = (totalUtxoValue - (amount + _transactionFee))
            tx.addOutput(account.address, value)
        }
        
        let raw = bitcoinUtxoService.signTransaction(account, tx, UtxoInputList)

        bitcoinRpcService.sendSignedTransaction(raw).then(function bitcoinSendSignedTransaction(txHash) {
            if(txHash == null){
                return callback(new Error('TRANSACTION NOT PROCESSED'), null)}else{
            
            bitcoinUtxoService.setUtxoStatus(UtxoInputList, account )
            account.balance=calculateAccountBalance(account)
                }
            return callback(null, txHash);
        }, err => {
            if (err) return callback(err, null);
        });
    } catch (err) {
        log.error(_blockchainName, `Error caught while sending transaction: ${err.toString()}`);
        return callback(err)
    }
}

/**
 * Sends OP_RETRUN messge on the Bitcoin blockchain
 * @private
 * @param {object} account the account parameters used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} data the data to be sent
 * @param {function} callback
 */
function sendOpReturnMessage(account, toAddress, amount, encodedMessage, callback) {
    try {
        let UtxoInputList = bitcoinUtxoService.getUtxosForTransaction(account, amount)
        var tx = bitcoinUtxoService.getTransactionInputs(UtxoInputList);
        var totalUtxoValue = bitcoinUtxoService.getTotalUtxoInputValue(UtxoInputList)
        const data = Buffer.from(encodedMessage , 'hex');
    
        const embed = bitcoin.payments.embed({ data: [data] })
        tx.addOutput(embed.output, 0)
        tx.addOutput(toAddress, totalUtxoValue - amount)

        let raw = bitcoinUtxoService.signTransaction(account, tx, UtxoInputList)
        
        if(Buffer.from(encodedMessage , 'hex').length > 80){
             throw new Error('SIZE OF MESSAGE: '+ Buffer.from(encodedMessage , 'hex').length + ' IS TOO LARGE MAXIMUM SIZE OF MESSAGE IS 80 BYTES')
        }

        bitcoinRpcService.sendSignedTransaction(raw).then(function bitcoinSendSignedTransaction(txHash) {
            bitcoinUtxoService.setUtxoStatus(UtxoInputList, account )
            account.balance=calculateAccountBalance(account)
            if(txHash == null){
                return callback(new Error('TRANSACTION NOT PROCESSED'), null)}else{
                bitcoinUtxoService.setUtxoStatus(UtxoInputList, account )
                account.balance=calculateAccountBalance(account)
                return callback(null, txHash);
                }
        }, err => {
            if (err) return callback(err, null);
        });

    } catch (err) {
        log.error(_blockchainName, `Error caught while sending transaction: ${err.toString()}`);
        return callback(err)
    }
}

/**
 * calculates the accountbalance based on unspent utxos
 * @param {object} account
 * @private
  @returns {object} balance of the account
 */
function calculateAccountBalance(account){
    let unspentUtxos = []
    for(var y=0; y<account.utxos.length; y++){
        if(account.utxos[y].spent == 'UNSPENT'){
            unspentUtxos.push(account.utxos[y])
        }
    }
    let totalUtxoValue = unspentUtxos.reduce(function(a, b) {
        return a + b.value
    }, 0)
   return totalUtxoValue
}

/**
 * Determines the fee in satoshis per byte of a given Bitcoin transaction
 * @private
 * @param {string} txid
 * @returns {Promise}
 */
function getBitcoinFee(txid) {
    let promise = new Promise(function (resolve, reject) {aw
       bitcoinRpcService.getRawTransaction(txid).then(function (transaction) {
            let totalOutputValue = 0;
            let totalInputValue = 0;
            let promises = [];
            transaction.vout.forEach(vout => {
                totalOutputValue += vout.value;
            });
            // loop through all inputs of the transaction, to find the input values
            transaction.vin.forEach(vin => {
                promises.push(
                    bitcoinRpcService.getRawTransaction(vin.txid).then(function (inputTransaction) {
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
    return promise;
}

/**
 * Performs a simple query to find a message on Bitcoin by transaction hash
 * @function lookupMessage
 * @alias module:lib/blockchains/bitcoin.lookupMessage
 * @param {object} wfQuery the property of the transaction to look up
 * @param {blockchainLookupMessageCb} callback function to be called after Whiteflag message lookup
 */
function lookupMessage(wfQuery, callback) {
    log.trace(_blockchainName, 'Performing query: ' + JSON.stringify(wfQuery));
    bitcoinRpcService.getRawTransaction(wfQuery['MetaHeader.transactionHash']).then(function bitcoinGetTransactionCb(transaction) {
        if (!transaction) return callback(new ProcessingError(`Transaction hash not found on ${_blockchainName}: ${wfQuery['MetaHeader.transactionHash']}`, null, 'WF_API_NO_RESOURCE'));
        if (_traceRawTransaction) log.trace(_blockchainName, `Transaction retrieved: ${JSON.stringify(transaction)}`);
        if (transaction.vout.length > 1) {
            if (transaction.vout[1].scriptPubKey.asm.startsWith(SCRIPTIDENTIFIER + WFINDENTIFIER)) {
                let encodedMessage = transaction.vout[1].scriptPubKey.asm.split(' ');
                transaction.encodedMessage = encodedMessage;
                // Put transaction details in new Whiteflag message metaheader
                let wfMessage;
                try {
                    wfMessage = convertToWF(transaction);
                } catch (err) {
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
    })
        .catch(function (err) {
            log.error(_blockchainName, `Error caught while retrieving Whiteflag message: ${err.toString()}`);
            return callback(err, null);
        });
}

