'use strict';
/**
 * @module lib/blockchains/bitcoin
 * @summary Whiteflag API Bitcoin blockchain implementation
 * @description Module to use Bitcoin as underlying blockchain for Whiteflag
 */
module.exports = {
    // Bitcoin blockchain functions
    init: initBitcoin,
    sendMessage,
    lookupMessage,
    getTransaction,
    // requestSignature,
    // requestKeys,
    transfer,
    createAccount,
    updateAccount,
    deleteAccount
};

// Required external modules //
const request = require('request');
const bitcoin = require('bitcoinjs-lib');
const bs58 = require('bs58');
// const keccak = require('keccak');
// const KeyEncoder = require('key-encoder');
// const jwt = require('jsonwebtoken');

// Required common functions and classes //
const log = require('../common/logger');
const object = require('../common/objects');
const { ProcessingError, ProtocolError } = require('../common/errors');

// Required project modules //
const wfState = require('../protocol/state');

// Module constants //
// const SIGNALGORITHM = 'ES256';
// const SIGNKEYTYPE = 'secp256k1';
// const BINENCODING = 'hex';
// const ETHHEXPREFIX = '0x';
// const SECPUBKEYPREFIX = '04';
const STATUSINTERVAL = 60000;
const INFOINTERVAL = 3600000;
const WFINDENTIFIER = '5746';
const SCRIPTIDENTIFIER = 'OP_RETURN ';

// Module variables //
let _blockchainName = 'bitcoin';
let _blockchainState = {};
let _currentBlockNumber = 0;
let _blockInterval = 5000;
let _blockRetrievalEnd = 0; // For debugging purposes
let _blockRetrievalRestart = 100;
let _transactionBatchSize = 100;
let _transactionValue = '0';
let _traceRawTransaction = false;
let _testnet = false;
let _credentials = {};
let _transactionFee = 300;

/**
 * Initialises the Bitcoin blockchain
 * @function initBitcoin
 * @alias module:lib/blockchains/bitcoin.init
 * @param {blockchainInitCb} callback function to be called after intitialising Bitcoin
 */
function initBitcoin(bcConfig, callback) {
    // Preserve the name of the blockchain
    _blockchainName = bcConfig.name;

    // Get Bitcoin blockchain state
    wfState.getBlockchainData(_blockchainName, function blockchainsGetStateDb(err, blockchainState) {
        if (err) return callback(err, _blockchainName);
        _blockchainState = blockchainState;

        // Put Bitcoin-specific config parameters in state
        _blockchainState.parameters.primary = bcConfig.primary;
        _blockchainState.parameters.node = bcConfig.node;

        // Initialise transaction listener
        // Block retrieval parameters
        _blockInterval = bcConfig.blockRetrievalInterval;
        _blockRetrievalRestart = bcConfig.blockRetrievalRestart;
        _transactionBatchSize = bcConfig.transactionBatchSize;
        if (bcConfig.blockRetrievalStart && bcConfig.blockRetrievalStart > 0) {
            _currentBlockNumber = bcConfig.blockRetrievalStart - 1;
            if (bcConfig.blockRetrievalEnd && bcConfig.blockRetrievalEnd > 0) {
                _blockRetrievalEnd = bcConfig.blockRetrievalEnd;
            }
        }
        // Whether to out a trace per raw tranaction when data received
        // As this results in a lot of logging and only used in rare cases this can
        // enabled/disabled using this config flag.
        if (bcConfig.traceRawTransaction) {
            _traceRawTransaction = bcConfig.traceRawTransaction;
        }
        initListener();

        // Initialise accounts
        initAccounts();

        // Set transaction value to be used sending transactions
        if (bcConfig.transactionValue) {
            _transactionValue = bcConfig.transactionValue;
        }


        // Check if Bitcoin module is running in testnet
        if (bcConfig.testnet) {
            _testnet = bcConfig.testnet;
        }
        _credentials = {
            host: bcConfig.rpcHost,
            port: bcConfig.rpcPort,
            user: bcConfig.username,
            password: bcConfig.password
        };
        // Periodically node details, status information and account balances
        updateNodeInfo();
        setInterval(updateNodeInfo, INFOINTERVAL);
        updateNodeStatus();
        setInterval(updateNodeStatus, STATUSINTERVAL);

        // Done initialising
        wfState.updateBlockchainData(_blockchainName, _blockchainState);
        return callback(null, _blockchainName);
    });
}
/**
 * Makes a connection with a node
 * @function rpcCall
 * @param {string} method the rpc method
 * @param {string} params the parameters for the rpc method
 * @returns {object} returns the response from the node
 */
function rpcCall(method, params) {
    let promise = new Promise(function (resolve, reject) {
        let options = {
            url: _credentials.host + ':' + _credentials.port,
            method: 'post',
            headers:
            {
                'content-type': 'text/plain'
            },
            auth: {
                user: _credentials.user,
                pass: _credentials.password
            },
            body: JSON.stringify({
                'jsonrpc': '2.0',
                'method': method,
                'params': params
            })
        };
        request(options, (err, response, body) => {
            if (JSON.parse(body).result === null) {
                reject(new Error(JSON.parse(body).error.message), err);
            } else {
                resolve(JSON.parse(body).result);
            }
        });
    });
    return promise;
}

/**
 * Sends an encoded message on the Bitcoin blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/bitcoin.sendMessage
 * @param {object} wfMessage the Whiteflag message to be sent on Bitcoin
 * @param {blockchainSendMessageCb} callback function to be called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    // Get correct Bitcoin account
    let account = getAccount(wfMessage.MetaHeader.originatorAddress);
    if (!account) return callback(new ProcessingError(`No ${_blockchainName} account found with address: ${wfMessage.MetaHeader.originatorAddress}`));

    // Create and send Bitcoin transaction
    sendTransaction(account, account.address, _transactionValue, wfMessage.MetaHeader.encodedMessage,
        function bitcoinSendMessageCb(err, txHash) {
            if (err) return callback(err, _blockchainName);
            return callback(null, txHash);
        }
    );
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
    rpcCall('getrawtransaction', [wfQuery['MetaHeader.transactionHash'], 2]).then(function bitcoinGetTransactionCb(transaction) {
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


/**
 * Gets the const bitcoin = require('bitcoinjs-lib'); transaction in Whiteflag message structure
 * @function getTransaction
 * @alias module:lib/blockchains/bitcoin.getTransaction
 * @param {string} transactionHash function to be called upon completion
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function getTransaction(transactionHash, callback) {
    rpcCall('getrawtransaction', [transactionHash, 2]).then(function bitcoinGetRawTransactionCb(transaction) {
        if (!transaction) {
            return callback(new Error(`No transaction data received for transaction hash: ${transactionHash}`));
        }
        if (transaction.vout.length <= 1) {
            return callback(new ProtocolError(`Transaction ${transactionHash} is not a Whiteflag message`));
        }
        if (!transaction.vout[1].scriptPubKey.asm.startsWith(SCRIPTIDENTIFIER + WFINDENTIFIER)) {
            return callback(new ProtocolError(`Transaction ${transactionHash} is not a Whiteflag message`));
        }
        // Put transaction details in new Whiteflag message metaheader
        let encodedMessage = transaction.vout[1].scriptPubKey.asm.split(' ');
        transaction.encodedMessage = encodedMessage;
        let wfMessage;
        try {
            wfMessage = convertToWF(transaction);
        } catch (err) {
            log.error(_blockchainName, `Error caught while extracting Whiteflag message from transaction  ${transaction.hash}: ${err.toString()}`);
            return callback(err, null);
        }
        return callback(null, wfMessage);
    }).catch(function (err) {
        return callback(new Error(`Error retrieving transaction: ${err.message}`));
    });
}

/**
 * Transfers bitcoin from one Bitcoin address to an other address
 * @function transferValue
 * @alias module:lib/blockchains/bitcoin.transferValue
 * @param {object} transfer the object with the transaction details to transfer value
 * @param {blockchainTransferValueCb} callback function to be called upon completion
 */
function transfer(transfer, callback) {
    let fromAccount = getAccount(transfer.fromAddress);
    if (!fromAccount) return callback(new ProcessingError(`No ${_blockchainName} account found with address: ${transfer.fromAddress}`));

    // Create and send transaction
    sendTransaction(fromAccount, transfer.toAddress, transfer.value, '', function bitcoinValueTransferCb(err, txHash) {
        if (err) return callback(err, null);
        return callback(null, txHash);
    });
}

/**
 * Creates a new Bitcoin blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/bitcoin.createAccount
 * @param {blockchainCreateAccountCb} callback function to be called upon completion
 */
function createAccount(callback) {
    // Create Bitcoin account and store in state
    let newAccount = generateAccount();
    saveAccount(newAccount);
    if (callback) return callback(null, newAccount);
    return newAccount;
}

/**
 * Updates Bitcoin blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/bitcoin.updateAccount
 * @param {blockchainUpdateAccountCb} callback function to be called upon completion
 */
function updateAccount(account, callback) {
    let updateAccount = getAccount(account.address);
    if (!updateAccount) return callback(new ProcessingError(`No ${_blockchainName} account found with address: ${account.address}`));

    // Update state with new or updated account
    saveAccount(account);
    if (callback) return callback(null, account);
    return account;
}

/**
 * Deletes Bitcoin blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/bitcoin.deleteAccount
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function deleteAccount(account, callback) {
    let deleteAccount = getAccount(account.address);
    if (!deleteAccount) return callback(new ProcessingError(`No ${_blockchainName} account found with address: ${account.address}`));

    // Remove account from state
    removeAccount(account);
    if (callback) return callback(null, account);
    return account;
}

// PRIVATE MODULE FUNCTIONS //
// Required project modules //
/*
 * The WF transceive modules are required by the private functions,
 * but must be loaded after module.export to prevent a circular dependency
 */
const wfReceive = require('../protocol/receive');

/**
 * Ignores its arguments
 * @private
 */
function ignore() { }

// PRIVATE BLOCKCHAIN DATA CONVERSION FUNCTIONS //

/**
 * Puts Bitcoin transaction data in Whiteflag metaheader
 * @private
 * @param {object} transaction
 * @returns {object} wfMessage a Whiteflag message
 */
function convertToWF(transaction) {
    let network = bitcoin.networks.bitcoin;
    // Testnet adresses are different from mainnet
    if (_testnet) {
        network = bitcoin.network.testnet;
    }
    let { address } = bitcoin.payments.p2pkh({
        pubkey: pubkeyToBuffer(transaction.vin[0].scriptSig.asm.split('[ALL] ')[1]),
        network: network
    });
    let wfMessage = {
        MetaHeader: {
            blockchain: _blockchainName,
            blockNumber: 0, // No longer necessary?
            transactionHash: transaction.hash,
            originatorAddress: address,
            originatorPubKey: transaction.vin[0].scriptSig.asm.split('[ALL] ')[1], // Find diffrent way to extract pubKey
            encodedMessage: transaction.encodedMessage
        }
    };
    return wfMessage;
}

// PRIVATE KEY AND ADDRESS FORMATTERS //
/**
 * Buffers public key
 * @private
 */
function pubkeyToBuffer(publicKey) {
    var bytes = new Uint8Array(Math.ceil(publicKey.length / 2));
    for (var i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(publicKey.substr(i * 2, 2), 16);
    }
    return bytes;
}

/**
 * Decodes bs58 addresses
 * @private
 */
function getBinaryAddress(address, callback) {
    const addressBuffer = bs58.decode(address);
    return callback(null, addressBuffer);
}


// PRIVATE BLOCKCHAIN STATUS FUNCTIONS //
/**
 * Requests some node information
 * @private
 */
function updateNodeInfo() {
        rpcCall('getblockchaininfo').then(function bitcoinGetNetIdCb(networkID, err) {
            if (err) return log.error(_blockchainName, `Could not get network: ${err.message}`);
                _blockchainState.parameters.networkID = networkID.chain;
        }).catch(err => {
                log.error(_blockchainName, `Error caught while updating node info ${err.toString()}`);
    });
}
/**
 * Requests some Bitcoin blockchain status information
 * @private
 */
function updateNodeStatus() {
    _blockchainState.status.updated = new Date().toISOString();
        rpcCall('getconnectioncount').then(function bitcoinGetPeersCb(peers, err) {
            if (err) return log.error(_blockchainName, `Could not retrieve number of peers: ${err.message}`);
                _blockchainState.status.peers = peers;
        }).catch(err => {
        log.error(_blockchainName, `Error caught while retrieving node status: ${err.toString()}`);
    });
    wfState.updateBlockchainData(_blockchainName, _blockchainState);
    log.debug(_blockchainName, `Node status: { ${JSON.stringify(_blockchainState.parameters)}, ${JSON.stringify(_blockchainState.status)} }`);
}

// PRIVATE BLOCKCHAIN TRANSACTION TX FUNCTIONS //
/**
 * Sends a transaction on the Bitcoin blockchain
 * @private
 * @param {object} account the account parameters used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} data the data to be sent
 * @param {function} callback
 */
function sendTransaction(account, toAddress, data, callback) {
    try {
        let network = bitcoin.networks.bitcoin;
        // Testnet adresses are different from mainnet
        if (_testnet) {
            network = bitcoin.network.testnet;
        }
        var tx = new bitcoin.TransactionBuilder(network);
        tx.addInput(account.lastTx, 0);
        tx.addOutput(account.address, account.balance - _transactionFee);
        let ret = bitcoin.script.compile(
            [
                bitcoin.opcodes.OP_RETURN,
                data
            ]);
        tx.addOutput(ret, 0);
        let privateKey = bitcoin.ECPair.fromWIF(account.wif,
            network);
        tx.sign(0, privateKey);
        let raw = [tx.build().toHex()];
        // Broadcast transaction
        sendSignedTransaction(raw, account).then(function bitcoinSendSignedTransaction(txHash) {
            return callback(null, txHash);
        }, err => {
            if (err) return callback(err);
        });
    } catch (err) {
        log.error(_blockchainName, `Error caught while sending Whiteflag message: ${err.toString()}`);
    }
}

/**
 * Sends a signed transaction on the Bitcoin blockchain
 * @private
 * @param {string} raw
 * @returns {Promise}
 */
function sendSignedTransaction(raw, account) {
    return new Promise((resolve, reject) => {
        rpcCall('sendrawtransaction', raw).then(function (data) {
            account.lastTx = data.hex;
            account.balance = account.balance - _transactionFee;
            saveAccount(account);
            resolve(data.hex);
        }, err => {
            reject(err);
        });
    }).catch(err => {
        // Let any error bubble up for processing
        throw (new Error(err));
    });
}

// PRIVATE BLOCKCHAIN TRANSACTION RX FUNCTIONS //
/*
* The functions below retrieve Bitcoin blockchain data, then the blocks and then for each
* block the transactions. To assure the data is retrieved in a controlled and sequential
* manner, promises are used. Thus, when one block has succesfully been processed, the next
* block will be processed. When an error occurs while retrieving a block, the  block
* will be retrieved again until successfully processed. To optimize retrieval of data,
* transactions for a single block will be retrieved in a batch, based on the batch number
* configuration parameter.
*/

/**
 * Determines the fee in satoshis per byte of a given Bitcoin transaction
 * @private
 * @param {string} txid
 * @returns {Promise}
 */
function getBitcoinFee(txid) {
    console.log(txid);
    let promise = new Promise(function (resolve, reject) {
        rpcCall('getrawtransaction', [txid, 2]).then(function (transaction) {
            let totalOutputValue = 0;
            let totalInputValue = 0;
            let promises = [];
            transaction.vout.forEach(vout => {
                totalOutputValue += vout.value;
            });
            // loop through all inputs of the transaction, to find the input values
            transaction.vin.forEach(vin => {
                promises.push(
                    rpcCall('getrawtransaction', [vin.txid, 2]).then(function (inputTransaction) {
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
 * Initiates the functions for retrieving data from the Bitcoin blockchain
 * @private
 */
function initListener() {
    getBlockchainDataRecursive();
}

/**
 * Gets Bitcoin blockchain data and calls itself recursively
 * @private
 */
function getBlockchainDataRecursive() {
    setTimeout(function bitcoinGetBlockchainDataRecursiveTimeoutCb() {
        getBlockchainData().then(function bitcoinGetBlockchainDataCb(doContinue) {
            _blockchainState.status.currentBlock = _currentBlockNumber;
            wfState.updateBlockchainData(_blockchainName, _blockchainState);
            if (doContinue) {
                getBlockchainDataRecursive();
            }
        }, err => {
            log.debug(_blockchainName, `Transaction processing failed: ${err.message}`);
            getBlockchainDataRecursive();
        });
    }, _blockInterval);
}

/**
 * Gets transactions from unprocessed blocks
 * @private
 * @returns {Promise}
 */
function getBlockchainData() {
    return new Promise((resolve, reject) => {
        // The actual Bitcoin blockchain height
        rpcCall('getblockcount').then(function bitcoinGetBlockNumberCb(latestBlockNumber) {
            // The block currently processed
            if (_currentBlockNumber === latestBlockNumber) {
                resolve(true);
                return;
            }
            // If a end block retrieval number is provided the logic needs to crawl a specific range of blocks
            // Hence the latestBlockNumber is overwritten.
            if (_blockRetrievalEnd > 0) latestBlockNumber = _blockRetrievalEnd;
            // Validate if the listener has been off for a short period of time and.
            if (_currentBlockNumber === 0
                && _blockchainState.status.currentBlock > 0
                && (latestBlockNumber - _blockchainState.status.currentBlock) > _blockRetrievalRestart
            ) {
                _currentBlockNumber = latestBlockNumber - _blockRetrievalRestart;
            }
            if (_currentBlockNumber === 0
                && _blockchainState.status.currentBlock > 0
                && (latestBlockNumber - _blockchainState.status.currentBlock) < _blockRetrievalRestart
            ) {
                _currentBlockNumber = _blockchainState.status.currentBlock;
            }
            // Initial state if current block number = 0 hence it set to properly process current blocks
            if (_currentBlockNumber < 1) _currentBlockNumber = latestBlockNumber - 1;

            // Process block sequentially until the latest block is reached
            getMultipleBlocks(_currentBlockNumber, latestBlockNumber).then(function bitcoinGetMultipleBlocksCb() {
                _currentBlockNumber = latestBlockNumber;
                if (latestBlockNumber === _blockRetrievalEnd) {
                    log.debug(_blockchainName, `Reached configured block retrieval end: ${latestBlockNumber}`);
                    resolve(false); // As an end blocknumber is provided and already reached. We stop further processing.
                    return;
                }
                resolve(true);
            }, err => {
                reject(err);
            });
        }, err => {
            err.message = 'Error when retrieving latest block: ' + err.message;
            reject(err);
        });
    }).catch(err => {
        if (err) log.error(_blockchainName, `Error caught while retrieving blockchain data: ${err.toString()}`);
        getBlockchainDataRecursive();
    });
}

/**
 * Processes transactions from multiple blocks
 * @private
 * @param {!number} current
 * @param {!number} limit
 * @returns {Promise}
 */
function getMultipleBlocks(current, limit) {
    let nextBlock = current + 1;
    return new Promise((resolve, reject) => {
        // Get block data
        rpcCall('getblockhash', [current]).then(function bitcoinGetBlockHashCb(blockhash) {
            rpcCall('getblock', [blockhash, 1]).then(function bitcoinGetBlockCb(block) {
                if (block) {
                    if (block.tx.length > 0) {
                        getMultipleTransactions(0, block.tx).then(function bitcoinGetMultipleBlockTransactionsCb() {
                            log.debug(_blockchainName, `Transactions processed from block ${nextBlock}: ${block.tx.length} `);
                            if (nextBlock < limit) {
                                getMultipleBlocks(nextBlock, limit).then(function bitcoinGetMultipleBlocksRecursiveCb() {
                                    resolve();
                                }, err => {
                                    reject(err);
                                });
                            } else {
                                resolve(); // The last promise will start the chain resolve to assure finalization of the chained sequential calls
                            }
                        }, err => {
                            reject(err);
                        });
                    } else {
                        // Rare case, but in certain instances there are no transactions in the block.
                        // This block can be skipped and we can move on to the next block.
                        // Get the next block when we are still under the limit.
                        if (nextBlock < limit) {
                            getMultipleBlocks(nextBlock, limit).then(function bitcoinGetMultipleBlocksNoTransactionsRecursiveCb() {
                                resolve();
                            }, err => {
                                reject(err);
                            });
                        } else {
                            resolve();
                        }
                    }
                    log.trace(_blockchainName, `Transactions discovered in block ${nextBlock}: ${block.tx.length}`);
                }
            }, err => {
                reject(err);
            }).catch(err => {
                if (err) log.error(_blockchainName, `Error caught while retrieving block ${nextBlock}: ${err.toString()}`);
                getMultipleBlocks(current, limit);
            });
        }, err => {
            reject(err);
        }).catch(err => {
            if (err) log.error(_blockchainName, `Error caught while retrieving blockhash of ${nextBlock}: ${err.toString()}`);
            getMultipleBlocks(current, limit);
        });
    }).catch(err => {
        if (err) log.error(_blockchainName, `Error caught while retrieving multiple blocks: ${err.toString()}`);
        // Redo block retrieval
        getMultipleBlocks(current, limit);
    });
}

/**
 * Gets multiple transaction at once from the Bitcoin blockchain
 * @private
 * @param {number} currentIndex
 * @param {array} transactions
 * @returns {Promise}
 */
function getMultipleTransactions(currentIndex, transactions) {
    return new Promise((resolve, reject) => {
        getBatchedMultipleTransactions(currentIndex, transactions).then(function bitcoinGetBatchedMultipleTransactionsCb(transactionRequests) {
            return Promise.all(transactionRequests).then(function bitcoinGetMultipleTransactionsPromiseAllCb(data) {
                ignore(data);
                if (currentIndex + _transactionBatchSize < transactions.length - 1) {
                    getMultipleTransactions(currentIndex + _transactionBatchSize, transactions).then(
                        function bitcoinGetMultipleTransactionsCb() {
                            resolve();
                        }, err => {
                            reject(err);
                        });
                } else {
                    resolve();
                }
            });
        }, err => {
            log.error(_blockchainName, `Cannot retrieve multiple transactions: ${err.message}`);
        });
    }).catch(err => {
        if (err) log.error(_blockchainName, `Error caught while retrieving multiple transactions: ${err.toString()}`);
        getMultipleTransactions(currentIndex, transactions);
    });
}

/**
 * Gets multiple transaction in a batch from the Bitcoin blockchain
 * @private
 * @param {number} currentIndex
 * @param {array} transactions
 * @returns {Promise}
 */
function getBatchedMultipleTransactions(currentIndex, transactions) {
    return new Promise((resolve, reject) => {
        let transactionRequests = [];
        // Combine the batch of transactions together based on the batch size.
        for (var i = currentIndex, len = Math.min(currentIndex + _transactionBatchSize, transactions.length); i < len; i++) {
            let transactionHash = transactions[i];
            transactionRequests.push(
                getRawTransaction(transactionHash).then(function bitcoinGetRawTransactionBatchCb(transaction) {
                    if (transaction) {
                        // Check if new bitcoins are send to a account address present in the current Whiteflagstate
                        let account = _blockchainState.accounts[0];
                        if(typeof transaction.vout[0].scriptPubKey.addressesn !== 'undefined') {
                            if(transaction.vout[0].scriptPubKey.addresses[0] === account.address) {
                                try {
                                    let network = bitcoin.networks.bitcoin;
                                    // Testnet adresses are different from mainnet
                                    if (_testnet) {
                                        network = bitcoin.network.testnet;
                                    }
                                    var tx = new bitcoin.TransactionBuilder(network);
                                    // Check if account had a previous UTXO
                                    if (account.lastTx !== '') {
                                        tx.addInput(account.lastTx, 0);
                                    }
                                    tx.addInput(transaction.txid, transaction.vout[0].value * 100000000);
                                    tx.addOutput(account.address, transaction.vout[0].value * 100000000 + account.balance - _transactionFee);
                                    let privateKey = bitcoin.ECPair.fromWIF(account.wif,
                                        network);
                                    tx.sign(0, privateKey);
                                    let raw = [tx.build().toHex()];
                                    // Broadcast transaction
                                    sendSignedTransaction(raw, account).then(function bitcoinSendSignedTransaction() {
                                        log.trace(_blockchainName, `Bitcoins received: ${transaction.vout[0].value} : Transaction id: ${transaction.txid}`);
                                    }, err => {
                                        if (err) log.error(_blockchainName, `Error caught while adding new bitcoins to account: ${err.toString()} : Transaction id: ${transaction.txid}`);
                                    });
                                } catch (err) {
                                    log.error(_blockchainName, `Error caught while adding new bitcoins to account: ${err.toString()} : Transaction id: ${transaction.txid} `);
                                }
                            }
                    }
                        // Check for Whiteflag prefix in transaction
                        if (transaction.vout.length > 1) {
                            if (transaction.vout[1].scriptPubKey.asm.startsWith(SCRIPTIDENTIFIER + WFINDENTIFIER)) {
                                let encodedMessage = transaction.vout[1].scriptPubKey.asm.split(' ');
                                transaction.encodedMessage = encodedMessage;
                                // Put transaction details in new Whiteflag message metaheader
                                let wfMessage;
                                try {
                                    wfMessage = convertToWF(transaction);
                                } catch (err) {
                                    log.error(_blockchainName, `Error caught while converting transaction ${transaction.hash} to Whiteflag message object and recovering public key: ${err.toString()}`);
                                }
                                // Process the Whiteflag message in the rx event chain
                                log.trace(_blockchainName, 'Received Whiteflag message: ' + JSON.stringify(wfMessage));
                                wfReceive.rxEvent.emit('messageReceived', wfMessage, function bitcoinMessageRxCb(err, wfMessage) {
                                    // Errors and logging already handled by rx event chain
                                    ignore(err);
                                    ignore(wfMessage);
                                });
                            }
                        }
                    }
                }, (err, transaction) => {
                    ignore(transaction);
                    log.error(_blockchainName, `Error retrieving transaction: ${err.message}`);
                })
            );
        }
        if (transactionRequests.length > 0) {
            resolve(transactionRequests);
        } else {
            reject();
        }
    }).catch(err => {
        log.error(_blockchainName, `Error caught while retrieving transaction batch: ${err.toString()}`);
        getBatchedMultipleTransactions(currentIndex, transactions);
    });
}

/**
 * Gets a single transaction from the Bitcoin blockchain
 * @private
 * @param {string} transactionHash
 * @returns {Promise}
 */
function getRawTransaction(transactionHash) {
    return new Promise((resolve, reject) => {
        rpcCall('getrawtransaction', [transactionHash, true]).then(function bitcoinGetTransactionCb(transaction) {
            // For tracing purposed transaction is submitted to the log
            if (_traceRawTransaction) {
                log.trace(_blockchainName, `Transaction received: ${JSON.stringify(transaction)}`);
            }
            // The last promise will resolve all previous promises in the chain
            resolve(transaction);
        }, err => {
            reject(err);
        });
    }).catch(err => {
        if (err) log.error(_blockchainName, `Error caught while retrieving transaction data: ${err.toString()}`);
        // Get transaction again.
        getRawTransaction(transactionHash);
    });
}

// PRIVATE BLOCKCHAIN ACCOUNT FUNCTIONS //
/**
 * Initialises all accounts by creating one if no account exists in the Bitcoin blockchain state
 * @private
 */
function initAccounts() {
    if (_blockchainState.accounts.length === 0) {
        // No accounts in state; creating new account
        let newAccount = generateAccount();
        saveAccount(newAccount);
    }
    log.info(_blockchainName, 'Blockchain accounts have been intialised');
}

/**
 * Generates a new Bitcoin account
 * @private
 * @returns {object} account
 */
function generateAccount() {
    let network = bitcoin.networks.bitcoin;
    // Testnet adresses are different from mainnet
    if (_testnet) {
        network = bitcoin.network.testnet;
    }
    // Generate a keypair
    let keyPair = bitcoin.ECPair.makeRandom({ network: network });
    let account = {
        address: bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: network
        }).address,
        publicKey: keyPair.publicKey.toString('hex'),
        privateKey: keyPair.privateKey.toString('hex'),
        wif: keyPair.toWIF(),
        balance: 0,
        lastTx: ''
    };
    log.info(_blockchainName, `Blockchain account created: ${account.address}`);
    return account;
}

/**
 * Updates the Bitcoin blockchain state with new or updated account
 * @private
 * @param {object} account
 */
function saveAccount(upsertAccount) {
    // Check if we are inserting or updating
    let stateAccount = _blockchainState.accounts.find(account => account.address === upsertAccount.address);
    if (!stateAccount) {
        // Insert new account
        _blockchainState.accounts.push(upsertAccount);
        log.info(_blockchainName, `Blockchain account added to state: ${upsertAccount.address}`);
    } else {
        // Update account
        object.update(upsertAccount, stateAccount);
        log.info(_blockchainName, `Blockchain account updated in state: ${upsertAccount.address}`);
    }
    wfState.updateBlockchainData(_blockchainName, _blockchainState);
}

/**
 * Removes an account from the Bitcoin blockchain state
 * @private
 * @param {object} account
 */
function removeAccount(delAccount) {
    // Get index of account
    let stateAccountIdx = _blockchainState.accounts.findIndex(account => account.address === delAccount.address);
    if (stateAccountIdx > -1) {
        // Remove account
        _blockchainState.accounts.splice(stateAccountIdx, 1);
        log.info(_blockchainName, `Blockchain account removed from state: ${delAccount.address}`);
    }
    wfState.updateBlockchainData(_blockchainName, _blockchainState);
}

/**
 * Gets account from the Bitcoin blockchain state by address
 * @private
 * @param {string} address
 * @returns {object} account
 */
function getAccount(address) {
    let foundAccount = _blockchainState.accounts.find(account => {
        if (account.address === address) {
            return account;
        }
    });
    return foundAccount;
}
