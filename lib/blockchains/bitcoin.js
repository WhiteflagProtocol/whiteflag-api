'use strict';
/**
 * @module lib/blockchains/bitcoin
 * @summary Whiteflag API Bitcoin blockchain implementation
 * @description Module to use Bitcoin as underlying blockchain for Whiteflag
 * @TODO Add signature functions for authentication
 */
module.exports = {
    // Bitcoin blockchain functionsns
    init: initBitcoin,
    sendMessage,
    lookupMessage,
    getTransaction,
    getBinaryAddress,
    transfer,
    createAccount,
    updateAccount,
    deleteAccount
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');
const bs58 = require('bs58');

// Whiteflag common functions and classes //
const log = require('../common/logger');
const {ProtocolError } = require('../common/errors');

// Whiteflag modules //
const wfRxEvent = require('../protocol/events').rxEvent;
const wfState = require('../protocol/state');

// Bitcoin sub-modules //
const bcRpc = require('./bitcoin/rpc');
const bcUtxo = require('./bitcoin/utxo');
const bcAccounts = require('./bitcoin/accounts');
const bcTransactions = require('./bitcoin/transactions');
const { UTXOSTATUS } = require('./bitcoin/common');

// Module constants //
const STATUSINTERVAL = 60000;
const INFOINTERVAL = 3600000;
const WFINDENTIFIER = '5746';
const SCRIPTIDENTIFIER = 'OP_RETURN ';
const SATOSHI = 100000000;

// Module variables //
let _blockchainName = 'bitcoin';
let _blockchainState = {};
let _currentBlockNumber = 0;
let _blockInterval = 5000;
let _walletSyncronisationFailTimeout = 30000;
let _blockRetrievalEnd = 0; // For debugging purposes
let _blockRetrievalRestart = 100;
// eslint-disable-next-line no-unused-vars
let _transactionBatchSize = 0; // TODO: Not used, considere deleting from config
// eslint-disable-next-line no-unused-vars
let _transactionValue = '0'; // TODO: Not used, considere deleting from config
let _traceRawTransaction = false;
let _testnet = true;
let _network;

/**
 * Initialises the Bitcoin blockchain
 * @function initBitcoin
 * @alias module:lib/blockchains/bitcoin.init
 * @param {blockchainInitCb} callback function to be called after intitialising Bitcoin
 */
function initBitcoin(bcConfig, callback) {
    log.info(_blockchainName, 'INITIALIZING BITCOIN');
    _blockchainName = bcConfig.name;

    wfState.getBlockchainData(_blockchainName, function blockchainsGetStateDb(err, blockchainState) {
        if (err) return callback(err, _blockchainName);

        _blockchainState = blockchainState;
        _blockchainState.parameters.primary = bcConfig.primary;
        _blockchainState.parameters.node = bcConfig.node;

        _blockInterval = bcConfig.blockRetrievalInterval;
        _blockRetrievalRestart = bcConfig.blockRetrievalRestart;
        _transactionBatchSize = bcConfig.transactionBatchSize;
        if (bcConfig.blockRetrievalStart && bcConfig.blockRetrievalStart > 0) {
            _currentBlockNumber = bcConfig.blockRetrievalStart - 1;
            if (bcConfig.blockRetrievalEnd && bcConfig.blockRetrievalEnd > 0) {
                _blockRetrievalEnd = bcConfig.blockRetrievalEnd;
            }
        }

        // Set transaction value to be used sending transactions
        if (bcConfig.transactionValue) {
            _transactionValue = bcConfig.transactionValue;
        }
        if (bcConfig.traceRawTransaction) {
            _traceRawTransaction = bcConfig.traceRawTransaction;
        }
        if (bcConfig.transactionValue) {
            _transactionValue = bcConfig.transactionValue;
        }
        if (bcConfig.testnet) {
            _testnet = bcConfig.testnet;
        }
        _network = bitcoin.networks.bitcoin;
        if (_testnet) {
            _network = bitcoin.networks.testnet;
        }
        // Set parameters for sub-modules
        bcRpc.setParameters(bcConfig);
        bcAccounts.setParameters(_blockchainState, _network);
        bcUtxo.setParameters(_network);
        bcTransactions.setParameters(_blockchainName, _traceRawTransaction);

        // Initialise listeners, accounts and status monitoring
        initListener();
        initAccounts();

        updateNodeInfo();
        setInterval(updateNodeInfo, INFOINTERVAL);

        updateNodeStatus();
        setInterval(updateNodeStatus, STATUSINTERVAL);

        // All done: update state and return
        wfState.updateBlockchainData(_blockchainName, _blockchainState);
        return callback(null, _blockchainName);
    });
}

function transfer(transferObj, callback) {
    return bcTransactions.transfer(transferObj, callback);
}

function lookupMessage(wfQuery, callback) {
    return bcTransactions.lookupMessage(wfQuery, callback);
}

function sendMessage(wfMessage, callback) {
    return bcTransactions.sendMessage(wfMessage, callback);
}

function updateAccount(account, callback) {
   return bcAccounts.updateAccount(account, callback);
}

function deleteAccount(address, callback) {
   return bcAccounts.deleteAccount(address, callback);
}

function createAccount(wif, callback) {
    let account = bcAccounts.createAccount(wif, callback);
    if (callback) return callback(null, account);
}

// PRIVATE BLOCKCHAIN ACCOUNT FUNCTIONS //
/**
 * Initialises all accounts by synchronizing the wallet from the last block the wallet has synced
 * @private
 */
 function initAccounts() {
    for (let account of _blockchainState.accounts) {
        synchronizeWallet(account);
    }
    log.info(_blockchainName, 'Blockchain accounts have been intialised');
}

/**
 * Initiates the functions for retrieving data from the Bitcoin blockchain
 * @private
 */
function initListener() {
    if (_blockchainState.status.currentBlock === null) {
        _blockchainState.status.currentBlock = 0;
    }
    _currentBlockNumber = _blockchainState.status.currentBlock;
    log.info(_blockchainName, 'current block number : ' + _currentBlockNumber);
    getBlockchainDataRecursive();
}

// PRIVATE BLOCKCHAIN STATUS FUNCTIONS //
/**
 * Requests some node information
 * @private
 */
function updateNodeInfo() {
    log.info(_blockchainName, 'retrieving node info');
    bcRpc.getBlockChainInfo()
        .then(function bitcoinGetNetIdCb(networkID, err) {
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
    log.info(_blockchainName, 'updating node status');
    _blockchainState.status.updated = new Date().toISOString();
    bcRpc.getConnectionCount().then(function bitcoinGetPeersCb(peers, err) {
        if (err) return log.error(_blockchainName, `Could not retrieve number of peers: ${err.message}`);
        _blockchainState.status.peers = peers;
    }).catch(err => {
        log.error(_blockchainName, `Error caught while retrieving node status: ${err.toString()}`);
    });
    wfState.updateBlockchainData(_blockchainName, _blockchainState);
    log.debug(_blockchainName, `Node status: { ${JSON.stringify(_blockchainState.parameters)}, ${JSON.stringify(_blockchainState.status)} }`);
}

/**
 * Initiates the functions for retrieving data from the Bitcoin blockchain
 * @private
 */
function getBlockchainDataRecursive() {
    setTimeout(function bitcoinGetBlockchainDataRecursiveTimeoutCb() {
        getBlockchainData()
        .then(function bitcoinGetBlockchainDataCb(doContinue) {
            wfState.updateBlockchainData(_blockchainName, _blockchainState);
            if (doContinue) {
                getBlockchainDataRecursive();
            }
        }, err => {
            log.debug(_blockchainName, `Retrieving blockchain data failed: ${err.message}`);
            getBlockchainDataRecursive();
        });
    }, _blockInterval);
}

/**
 * Gets transactions from unprocessed blocks
 * @private
 * @returns {Promise}
 * @TODO Replace async-await construct
 */
function getBlockchainData() {
    return new Promise((resolve, reject) => {
        // The actual Bitcoin blockchain height
        bcRpc.getBlockCount()
        .then(function bitcoinGetBlockNumberCb(latestBlockNumber) {
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
            processMultipleBlocks(_currentBlockNumber, latestBlockNumber) // TODO: Does not return a promise!
            .then(function bitcoinGetMultipleBlocksCb() {
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
 * Syncronizes the wallet by looking for utxos
 * @private
 */
function synchronizeWallet(account) {
    log.info(_blockchainName, `Synchronizing wallet for account ${account.address} from block ${account.lastBlock}`);
    try {
        for (let thisBlock = account.lastBlock; thisBlock <= _currentBlockNumber; thisBlock++) {
            account.walletSyncing = true;
            account.lastBlock = thisBlock;
            bcRpc.getBlockIncludingTransactions(thisBlock)
            .then(function processTransactionsForAccount(block) {
                if (block !== null) {
                    processAccountTransactions(block.tx, account);
                    account.lastBlock = thisBlock;
                }
            });
        }
        account.walletSyncing = false;
    } catch(err) {
        log.error(_blockchainName, 'Error synchronizing wallet: ' + err.message);
        setTimeout(function timeoutCb() {
            synchronizeWallet(account);
        }, _walletSyncronisationFailTimeout);
    }
}

/**
 * checks a block for whiteflag messages and utxos
 * @param {object} curent current block
 * @private
 */
function getBlockTransactions(current) {
    bcRpc.getBlockIncludingTransactions(current)
    .then(function processTransactions(block) {
        checkWfMessage(block.tx);
        for (let account of _blockchainState.accounts) {
            if (account.walletSyncing === false
                && account.lastBlock <= current
            ) {
                processAccountTransactions(block.tx, account);
                account.lastBlock = current;
            }
        }
    });
}

/**
 * Syncronizes the wallet by looking for utxos
 * @param {object} curent current block
 * @param {object} limit limit block
 * @private
 */
function processMultipleBlocks(current, limit) {
    for (current; current <= limit; current++) {
        getBlockTransactions(current);
        _currentBlockNumber = current;
        _blockchainState.status.currentBlock = current;
        log.info(_blockchainName, 'Current block number in the blockchain state: ' + _currentBlockNumber);
    }
}

/**
 * Checks a list of transactions for utxos related to an account
 * @private
 * @param {object} transactions the transactions to check
 * @param {object} account the account to check for
 */
function processAccountTransactions(transactions, account) {
    for (let transaction of transactions) {
        for (let indexOut of Object.keys(transaction.vout)) {
            if (typeof transaction.vout[indexOut].scriptPubKey.addresses !== 'undefined') {
                checkAccountUtxoReceived(transaction, account, indexOut);
                for (let indexIn of Object.keys(transaction.vin)) {
                    if (typeof transaction.vin[indexIn].txid !== 'undefined') {
                        for (let otherAccount of _blockchainState.accounts) {
                            checkAccountUtxoSpent(transaction, otherAccount, indexIn);
                        }
                    }
                }
            }
        }
    }
}

/**
 * checks if a transactions contains an utxo that is received for an account, if a tansaction is received the balance is calculated and the account is saved
 * @param {object} transaction the transaction to check
 * @param {object} account the account to check against
 * @param {object} index index of the transaction
 * @private
 */
function checkAccountUtxoReceived(transaction, account, index) {
    // console.log(transaction.txid)
    if (account.address === transaction.vout[index].scriptPubKey.addresses[0]) {
        if (!account.utxos.some(utxo => utxo.txid === transaction.txid)) {
            let utxo = {
                txid: transaction.txid,
                index: index,
                value: parseInt((transaction.vout[index].value * SATOSHI).toFixed(0)),
                spent: UTXOSTATUS.UNSPENT
            };
            log.info(_blockchainName, 'Received ' + (transaction.vout[index].value * SATOSHI).toFixed(0) + ' on account: ' + account.address);
            account.utxos.push(utxo);
            account.balance = calculateAccountBalance(account);
            bcAccounts.saveAccount(account);
        }
    }
}

/**
 * Checks if a transaction contains an utxo for an account; if the tansaction has spent, the balance is calculated and the account is saved
 * @private
 * @param {object} transaction the transaction to check
 * @param {object} account the account to check against
 * @param {object} index index of the transaction
 */
function checkAccountUtxoSpent(transaction, account, index) {
    for (let utxo of account.utxos) {
        if (utxo.txid === transaction.vin[index].txid
            && transaction.vin[index].vout === utxo.index
            && utxo.spent !== UTXOSTATUS.SPENTVERIFIED
        ) {
            log.info(_blockchainName, 'Spent ' + utxo.value + ' from account: ' + account.address);
            utxo.spent = UTXOSTATUS.SPENTVERIFIED;
            calculateAccountBalance(account);
            bcAccounts.saveAccount(account);
        }
    }
}

/**
 * Checks the transactions from a block for Whiteflag messages and sends wfRxEvent
 * @private
 * @param {object} transactions
 * @TDOD Function is to complex and need refactoring
 */
function checkWfMessage(transactions) {
    for (let transaction of transactions) {
        if (transaction.vout.length > 0) {
            for (let vout of transaction.vout) {
                if (vout.scriptPubKey.asm.startsWith(SCRIPTIDENTIFIER)) {
                    let hexMessage = vout.scriptPubKey.asm;
                    let encodedMessage = hexMessage.substring(hexMessage.indexOf(' ') + 1);
                    if (encodedMessage.startsWith(WFINDENTIFIER)) {
                        transaction.encodedMessage = encodedMessage;

                        // Put transaction details in new Whiteflag message metaheader
                        let wfMessage;
                        try {
                            wfMessage = convertToWF(transaction);
                        } catch(err) {
                            log.error(_blockchainName, `Error caught while converting transaction ${transaction.hash} to Whiteflag message object and recovering public key: ${err.toString()}`);
                        }
                        // Process the Whiteflag message in the rx event chain
                        log.trace(_blockchainName, 'Received Whiteflag message: ' + JSON.stringify(wfMessage));
                        wfRxEvent.emit('messageReceived', wfMessage);
                    }
                }
            }
        }
    }
}

/**
 * Puts Bitcoin transaction data in Whiteflag metaheader
 * @private
 * @param {object} transaction
 * @returns {object} wfMessage a Whiteflag message
 */
function convertToWF(transaction) {
    let { address } = bitcoin.payments.p2pkh({
        pubkey: pubkeyToBuffer(transaction.vin[0].scriptSig.asm.split('[ALL] ')[1]),
        network: _network
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
 * Calculates the account balance based on unspent UTXOs
 * @private
 * @param {object} account the Bitcoin account
 * @returns {object} balance of the account
 * @TDOD Remove function and use the one in accounts submodule
 */
function calculateAccountBalance(account) {
    // Put unspent UTXOs in an array
    let unspentUtxos = [];
    for (let utxo of account.utxos) {
        if (utxo.spent === UTXOSTATUS.UNSPENT) {
            unspentUtxos.push(utxo);
        }
    }
    // Accumulate all UTXO values
    return unspentUtxos.reduce(function(accumulator, utxo) {
        return accumulator + utxo.value;
    }, 0);
}

/**
 * Checks a transaction for wfmessages
 * @private
 * @param {object} transactionHash
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
                        wfMessage = convertToWF(transaction);
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
 * Decodes bs58 addresses
 * @private
 */
 function getBinaryAddress(address, callback) {
    const addressBuffer = bs58.decode(address);
    return callback(null, addressBuffer);
}
