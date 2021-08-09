'use strict';
/**
 * @module lib/blockchains/bitcoin/listener
 * @summary Whiteflag API Bitcoin listener module
 * @description Module to connect to the Bitcoin network and crawl/listen for transactions
 * @TODO Refactor and cross-check block retrieval algorithm with Ethereum
 */
module.exports = {
    init: initListener
};

// Whiteflag common functions and classes //
const log = require('../../common/logger');

// Whiteflag modules //
const wfRxEvent = require('../../protocol/events').rxEvent;
const wfState = require('../../protocol/state');

// Bitcoin sub-modules //
const bcRpc = require('./rpc');
const bcAccounts = require('./accounts');
const bcTransactions = require('./transactions');

// Module constants //
const WFINDENTIFIER = '5746';
const SCRIPTIDENTIFIER = 'OP_RETURN ';

// Module variables //
let _blockchainName;
let _bcState;
let _blockCursor = 0;
let _blockInterval = 5000;
let _blockMaxRetries = 100;
let _transactionBatchSize = 0;
let _blockRetrievalEnd = 0; // For debugging purposes
let _blockRetrievalRestart = 100;
let _currentBlockNumber = 0;

/**
 * Initiates the listener for Bitcoin blockchain transactions
 * @function initListener
 * @alias module:lib/blockchains/bitcoin/listener.init
 * @param {Object} bcConfig the Bitcoin blockchain configuration
 * @param {Object} bcState the Bitcoin blockchain state
 */
 function initListener(bcConfig, bcState) {
    _blockchainName = bcConfig.name;
    _bcState = bcState;

    // Block processing parameters
    if (bcConfig.blockMaxRetries) _blockMaxRetries = bcConfig.blockMaxRetries;
    if (_blockMaxRetries > 0) log.info(_blockchainName, `Maximum retries for processing a block is set to ${_blockMaxRetries} for each block`);
    if (bcConfig.transactionBatchSize) _transactionBatchSize = bcConfig.transactionBatchSize;
    log.info(_blockchainName, `Maximum number of transactions in a block that are processed in parallel is set to ${_transactionBatchSize}`);

    // Block interval time
    if (bcConfig.blockRetrievalInterval && bcConfig.blockRetrievalInterval > 500) {
        _blockInterval = bcConfig.blockRetrievalInterval;
    }
    log.info(_blockchainName, `Block retrieval interval is set to ${_blockInterval} ms`);


    // Coonect to node, determine blocks, and start listener
    bcRpc.getBlockCount().then(highestBlock => {
        // Determine block retrieval range
        if (bcConfig.blockRetrievalRestart) _blockRetrievalRestart = bcConfig.blockRetrievalRestart;
        if (bcConfig.blockRetrievalStart && bcConfig.blockRetrievalStart > 0) {
            log.info(_blockchainName, `Starting block specified in configuration: ${bcConfig.blockRetrievalStart}`);
            _blockCursor = bcConfig.blockRetrievalStart - 1;
        }
        if (bcConfig.blockRetrievalEnd && bcConfig.blockRetrievalEnd > 0) {
            log.info(_blockchainName, `Ending block specified in configuration: ${bcConfig.blockRetrievalEnd}`);
            _blockRetrievalEnd = bcConfig.blockRetrievalEnd;
        }
        // Determine current block from where we want to retrieve next block
        if (_blockCursor < 1 && bcConfig.blockRetrievalStart < 1) {
            if (_bcState.status.currentBlock > 0) {
                if ((highestBlock - _bcState.status.currentBlock) > _blockRetrievalRestart) {
                    let nextBlock = highestBlock - _blockRetrievalRestart;
                    _blockCursor = nextBlock - 1;
                    log.info(_blockchainName, `Resuming from block: ${nextBlock} (${_blockRetrievalRestart} blocks behind the highest block ${highestBlock} on node)`);
                }
                if ((highestBlock - _bcState.status.currentBlock) < _blockRetrievalRestart) {
                    _blockCursor = _bcState.status.currentBlock;
                    let nextBlock = _blockCursor + 1;
                    let arrearBlocks = highestBlock - nextBlock;
                    if (arrearBlocks < 0) {
                        log.info(_blockchainName, `Resuming from block: ${nextBlock} (when node catches up from its current highest block ${highestBlock})`);
                    } else {
                        log.info(_blockchainName, `Resuming from block: ${nextBlock} (${arrearBlocks} blocks behind the highest block ${highestBlock} on node)`);
                    }
                }
            } else {
                _blockCursor = highestBlock - 1;
                log.info(_blockchainName, `Starting from highest block on node: ${highestBlock}`);
            }
        }
        getBlockchainDataRecursive();
    }, err => {
        log.error(_blockchainName, `Could not retrieve highest blocknumer from Bitcoin node: ${err.message}`);
    });
}

// PRIVATE BLOCKCHAIN LISTENER FUNCTIONS //
/**
 * Initiates the functions for retrieving data from the Bitcoin blockchain
 * @private
 */
function getBlockchainDataRecursive() {
    setTimeout(function bitcoinGetBlockchainDataRecursiveTimeoutCb() {
        getBlockchainData()
        .then(function bitcoinGetBlockchainDataCb(doContinue) {
            wfState.updateBlockchainData(_blockchainName, _bcState);
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
async function getBlockchainData() {
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
                && _bcState.status.currentBlock > 0
                && (latestBlockNumber - _bcState.status.currentBlock) > _blockRetrievalRestart
            ) {
                _currentBlockNumber = latestBlockNumber - _blockRetrievalRestart;
            }
            if (_currentBlockNumber === 0
                && _bcState.status.currentBlock > 0
                && (latestBlockNumber - _bcState.status.currentBlock) < _blockRetrievalRestart
            ) {
                _currentBlockNumber = _bcState.status.currentBlock;
            }
            // Initial state if current block number = 0 hence it set to properly process current blocks
            if (_currentBlockNumber < 1) _currentBlockNumber = latestBlockNumber - 1;

            // Process block sequentially until the latest block is reached
            processMultipleBlocks(_currentBlockNumber, latestBlockNumber)
            .then(() => {
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
 * @param {Object} curent current block
 * @param {Object} limit limit block
 */
async function processMultipleBlocks(current, limit) {
    for (current; current <= limit; current++) {
        await getBlockTransactions(current);
        _currentBlockNumber = current;
        _bcState.status.currentBlock = current;
        log.debug(_blockchainName, 'Current block number in the blockchain state: ' + _currentBlockNumber);
    }
}

/**
 * checks a block for whiteflag messages and utxos
 * @param {Object} curent current block
 * @private
 */
async function getBlockTransactions(current) {
    await bcRpc.getBlockIncludingTransactions(current)
    .then(function processTransactions(block) {
        checkWfMessage(block.tx);
        for (let account of _bcState.accounts) {
            if (account.walletSyncing === false
                && account.lastBlock <= current
            ) {
                bcAccounts.processAccountTransactions(block.tx, account);
                account.lastBlock = current;
            }
        }
    });
}

/**
 * Checks the transactions from a block for Whiteflag messages and sends wfRxEvent
 * @private
 * @param {Object} transactions
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
                            wfMessage = bcTransactions.extractMessage(transaction);
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
