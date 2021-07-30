'use strict';
/**
 * @module lib/blockchains/bitcoin
 * @summary Whiteflag API Bitcoin blockchain implementation
 * @description Module to use Bitcoin as utrlying blockchain for Whiteflag
 */
module.exports = {
    // Bitcoin blockchain functionsns 
    init: initBitcoin,
    sendMessage,
    getBinaryAddress,
    lookupMessage,
    getTransaction,
    transfer,
    createAccount,
    updateAccount,
    deleteAccount
};

const {ProtocolError, ProcessingError } = require('../common/errors');

// Required external modules //
const bitcoinAccountService = require('./bitcoin/bitcoinAccountService')
const bitcoinRpcService = require('./bitcoin/bitcoinRpcService')
const bitcoinUtxoService = require('./bitcoin/bitcoinUtxoService')
const bitcoinTransactionService = require('./bitcoin/bitcoinTransactionService');

const bitcoin = require('bitcoinjs-lib');
const bs58 = require('bs58');
// const keccak = require('keccak');
// const KeyEncoder = require('key-encoder');
// const jwt = require('jsonwebtoken');

// Required common functions and classes //
const log = require('../common/logger');
const object = require('../common/objects');

const wfRxEvent = require('../protocol/events').rxEvent;

// Required project modules //
const wfState = require('../protocol/state');
const STATUSINTERVAL = 60000;
const INFOINTERVAL = 3600000;
const WFINDENTIFIER = '5746';
const SCRIPTIDENTIFIER = 'OP_RETURN ';

// Module variables //
let _blockchainName = 'bitcoin';
let _blockchainState = {};
let _currentBlockNumber = 0;
let _blockInterval = 5000;
let _walletSyncronisationFailTimeout = 30000
let _blockRetrievalEnd = 0; // For debugging purposes
let _blockRetrievalRestart = 100;
let _transactionBatchSize = 0
let _transactionValue = '0';
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
    log.info(_blockchainName , 'INITIALIZING BITCOIN')
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

       bitcoinRpcService.setCredentials(bcConfig)
       bitcoinAccountService.setAccountServiceValues(_blockchainState, _network)
       bitcoinUtxoService.setBitcoinUtxoServiceValues(_network)
       bitcoinTransactionService.setTransactionServiceValues(_blockchainName, _traceRawTransaction)

        initListener();

        initAccounts();

        updateNodeInfo();

        setInterval(updateNodeInfo, INFOINTERVAL);

        updateNodeStatus();

        setInterval(updateNodeStatus, STATUSINTERVAL);

        wfState.updateBlockchainData(_blockchainName, _blockchainState);

        return callback(null, _blockchainName);


    });
}

// PRIVATE BLOCKCHAIN ACCOUNT FUNCTIONS //
/**
 * Initialises all accounts by synchronizing the wallet from the last block the wallet has synced
 * @private
 */
 function initAccounts() {
    for (let account of _blockchainState.accounts) {
        synchronizeWallet(account)
    }
    log.info(_blockchainName, 'Blockchain accounts have been intialised');
}

/**
 * Initiates the functions for retrieving data from the Bitcoin blockchain
 * @private
 */
function initListener() {
    if (_blockchainState.status.currentBlock == null) {
        _blockchainState.status.currentBlock = 0;
    }
    _currentBlockNumber = _blockchainState.status.currentBlock
    log.info(_blockchainName, 'current block number : ' + _currentBlockNumber)
    getBlockchainDataRecursive();
}

// PRIVATE BLOCKCHAIN STATUS FUNCTIONS //
/**
 * Requests some node information
 * @private
 */
function updateNodeInfo() {
    log.info(_blockchainName, 'retrieving node info')
    bitcoinRpcService.getBlockChainInfo()
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
    log.info(_blockchainName, 'updating node status')
    _blockchainState.status.updated = new Date().toISOString();
   bitcoinRpcService.getConnectionCount().then(function bitcoinGetPeersCb(peers, err) {
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
        getBlockchainData().then(function bitcoinGetBlockchainDataCb(doContinue) {
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
 */
function getBlockchainData() {
    return new Promise((resolve, reject) => {
        // The actual Bitcoin blockchain height
        bitcoinRpcService.getBlockCount().then(async function bitcoinGetBlockNumberCb(latestBlockNumber) {
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
            await processMultipleBlocks(_currentBlockNumber, latestBlockNumber).then(function bitcoinGetMultipleBlocksCb() {
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
async function synchronizeWallet(account) {
    try{
    log.info(_blockchainName, 'synchronizing wallet for : ' + account.address + ' current blocknumber ' + account.lastBlock)
    let current = account.lastBlock
    for (current; current <= _currentBlockNumber; current++) {
        account.walletSyncing = true
        account.lastBlock = current;
        await bitcoinRpcService.getBlockIncludingTransactions(current).then(async function processTransactionsForAccount(block) {
            if (block != null) {
                await processTransactionsForBlockAndAccount(block.tx, account)
                account.lastBlock = current;
            }
        }
        )
    }
    account.walletSyncing = false
    }catch(e){log.error(_blockchainName, 'error synchronizing wallet' + e)
    await new Promise(resolve => setTimeout(resolve, _walletSyncronisationFailTimeout));
    synchronizeWallet(account)
}
}

/**
 * checks a block for whiteflag messages and utxos
 * @param {object} curent current block 
 * @private
 */
async function getBlockTransactions(current) {
    await bitcoinRpcService.getBlockIncludingTransactions(current).then(async function processTransactions(block) {
        checkWfMessage(block.tx)
        for (let account of _blockchainState.accounts) {
            if (account.walletSyncing == false
                & account.lastBlock <= current
            ) {
                await processTransactionsForBlockAndAccount(block.tx, account)
                account.lastBlock = current;
            }
        }
    })
}

/**
 * Syncronizes the wallet by looking for utxos
 * @param {object} curent current block
 * @param {object} limit limit block
 * @private
 */
async function processMultipleBlocks(current, limit) {
    for (current; current <= limit; current++) {
        await getBlockTransactions(current)
        _currentBlockNumber = current;
        _blockchainState.status.currentBlock = current
        log.info(_blockchainName, 'current block number in the blockchain state : ' + _currentBlockNumber)
    }
}

/**
 * checks a list of transactions for utxos related to an account
 * @param {object} transactions transactions 
 * @param {object} account account
 * @private
 */
function processTransactionsForBlockAndAccount(transactions, account) {
    for (let transaction of transactions) {
        for (const index of Object.keys(transaction.vout)) {
            if (typeof transaction.vout[index].scriptPubKey.addresses !== 'undefined') {
                checkTransactionsReceived(transaction, account, index);
                for (const index of Object.keys(transaction.vin)) {
                    if (typeof transaction.vin[index].txid !== 'undefined') {
                        for (let account of _blockchainState.accounts) {
                            checkTransactionsSpend(transaction, account, index)
                        }
                    }
                }
            }
        }
    }
}

/**
 * checks if a transactions contains an utxo that is received for an account, if a tansaction is received the balance is calculated and the account is saved
 * @param {object} transaction transaction
 * @param {object} account account
 * @param {object} index index of the transaction  
 * @private
 */
function checkTransactionsReceived(transaction, account, index) {
    //console.log(transaction.txid)
    if (account.address === transaction.vout[index].scriptPubKey.addresses[0]) {
        if (!account.utxos.some(e => e.txid === transaction.txid)) {
            let utxo = { txid: transaction.txid, index: index, value: parseInt((transaction.vout[index].value * 100000000).toFixed(0)), spent: 'UNSPENT' }
            log.info(_blockchainName, 'received ' + (transaction.vout[index].value * 100000000).toFixed(0) + ' on account : ' + account.address)
            account.utxos.push(utxo)
            account.balance = calculateAccountBalance(account)
            bitcoinAccountService.saveAccount(account)
        }
    }
}

/**
 * checks if a transactions contains an utxo that is spend for an account, if a tansaction is spend the balance is calculated and the account is saved
 * @param {object} transaction transaction
 * @param {object} account account
 * @param {object} index index of the transaction  
 * @private
 */
function checkTransactionsSpend(transaction, account, index) {
    for (let utxo of account.utxos) {
        if (utxo.txid == transaction.vin[index].txid & transaction.vin[index].vout == utxo.index && utxo.spent != 'SPENT-VERIFIED') {
            log.info(_blockchainName, 'spend ' + utxo.value + ' from account : ' + account.address)
            utxo.spent = 'SPENT-VERIFIED'
            calculateAccountBalance(account)
            bitcoinAccountService.saveAccount(account)
        }
    }
}

/**
 * Checks the transactions from a block for whiteflagmessages and sends wfRxEvent 
 * @private
 * @param {object} transactions
 */
function checkWfMessage(transactions) {
    for (let transaction of transactions) {
        if (transaction.vout.length > 0) {
            for (let vout of transaction.vout) {
                if (vout.scriptPubKey.asm.startsWith(SCRIPTIDENTIFIER)) {
                    let hexMessage = vout.scriptPubKey.asm
                    let encodedMessage = hexMessage.substring(hexMessage.indexOf(' ') + 1);
                    if (encodedMessage.startsWith(WFINDENTIFIER)) {
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
                        wfRxEvent.emit('messageReceived', wfMessage, function bitcoinMessageRxCb(err, wfMessage) {
                           log.info(_blockchainName, err)
                            log.info(_blockchainName, wfMessage)
                        });
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
 * checks a transaction for wfmessages
 * @param {object} transactionHash
 * @private
 */
function getTransaction(transactionHash, callback) {
    bitcoinRpcService.getRawTransaction(transactionHash).then(function bitcoinGetRawTransactionCb(transaction) {

        if (!transaction) {
            return callback(new Error(`No transaction data received for transaction hash: ${transactionHash}`));
        }
        if (transaction.vout.length <= 1) {
            return callback(new ProtocolError(`Transaction ${transactionHash} is not a Whiteflag message`));
        }
        for (let vout of transaction.vout) {
            if (vout.scriptPubKey.asm.startsWith(SCRIPTIDENTIFIER)) {
                let hexMessage = vout.scriptPubKey.asm
                hexMessage = hexMessage.substring(hexMessage.indexOf(' ') + 1);
                const encodedMessage = Buffer.from(hexMessage, 'hex').toString()
                if (encodedMessage.startsWith(WFINDENTIFIER)) {
                    transaction.encodedMessage = encodedMessage;
                    // Put transaction details in new Whiteflag message metaheader
                    let wfMessage;
                    try {
                        wfMessage = convertToWF(transaction);
                    } catch (err) {
                        log.error(_blockchainName, `Error caught while converting transaction ${transaction.hash} to Whiteflag message object and recovering public key: ${err.toString()}`);
                    }
                    // Process the Whiteflag message in the rx event chain
                    log.trace(_blockchainName, 'Message is a whiteflag message: ' + JSON.stringify(wfMessage));
                    return callback(null, wfMessage);
                }
            }
        }
    }).catch(function (err) {
        log.error(_blockchainName, err)
    });
}

function transfer(transfer, callback){
    return bitcoinTransactionService.transfer(transfer, callback)
}

function lookupMessage(){
    return bitcoinTransactionService.lookupMessage(wfQuery, callback)
}


function sendMessage(wfMessage, callback){
    return bitcoinTransactionService.sendMessage(wfMessage, callback)
}

function updateAccount(account, callback) {
   return bitcoinAccountService.updateAccount(account, callback)
}

function deleteAccount(address, callback) {
   return bitcoinAccountService.deleteAccount(address, callback)
}

function createAccount(wif, callback) {
    let account = bitcoinAccountService.createAccount(wif, callback)
    if(callback)return callback(null, account);
}

/**
 * Decodes bs58 addresses
 * @private
 */
 function getBinaryAddress(address, callback) {
    const addressBuffer = bs58.decode(address);
    return callback(null, addressBuffer);
}
