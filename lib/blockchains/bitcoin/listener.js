'use strict';
/**
 * @module lib/blockchains/bitcoin/listener
 * @summary Whiteflag API Bitcoin listener module
 * @description Module to connect to the Bitcoin network and crawl/listen for transactions
 */
module.exports = {
    init: initListener,
    scanBlocks
};

// Common internal functions and classes //
const log = require('../../_common/logger');
const { addArray } = require('../../_common/arrays');

// Whiteflag modules //
const wfRxEvent = require('../../protocol/events').rxEvent;
const wfState = require('../../protocol/state');

// Common blockchain functions //
const { determineStartingBlock,
        logStartingBlock} = require('../_common/state');

// Bitcoin sub-modules //
const btcRpc = require('./rpc');
const btcAccounts = require('./accounts');
const btcTransactions = require('./transactions');

// Module constants //
const MODULELOG = 'bitcoin';
const BLOCKSTACKSIZE = 100;
const BLOCKRETRYDELAY = 10000;
const BLOCKITERATIONDELAY = 5;

// Module variables //
let _btcChain;
let _btcState;
let _iterationCount = 0;
let _discoveredBlock = 0;
let _blockCursor = 0;
let _blockInterval = 60000;
let _blockRetrievalRestart = 20;
let _blockRetrievalStart = 0;
let _blockRetrievalEnd = 0;
let _blockStackSize = 0;
let _blockMaxRetries = 0;
let _blockRetryCount = 0;
let _skippedBlocks = 0;
let _transactionBatchSize = 128;

/**
 * Initiates the listener for Bitcoin blockchain transactions
 * @function initListener
 * @alias module:lib/blockchains/bitcoin/listener.init
 * @param {Object} btcConfig the Bitcoin blockchain configuration
 * @param {Object} btcState the Bitcoin blockchain state
 * @returns {Promise} resolve if succesfully initialised
 */
async function initListener(btcConfig, btcState) {
    log.trace(MODULELOG, 'Initialising listener for Bitcoin blockchain transactions');
    _btcChain = btcConfig.name;
    _btcState = btcState;

    // Block processing parameters
    if (btcConfig.blockMaxRetries) _blockMaxRetries = btcConfig.blockMaxRetries;
    if (_blockMaxRetries > 0) log.debug(MODULELOG, `Maximum retries for processing a block is set to ${_blockMaxRetries} for each block`);
    if (btcConfig.transactionBatchSize) _transactionBatchSize = btcConfig.transactionBatchSize;
    log.debug(MODULELOG, `Maximum number of transactions in a block that are processed in parallel is set to ${_transactionBatchSize}`);

    // Block interval time
    if (btcConfig.blockRetrievalInterval && btcConfig.blockRetrievalInterval > 500) {
        _blockInterval = btcConfig.blockRetrievalInterval;
    }
    log.info(MODULELOG, `Block retrieval interval is set to ${_blockInterval} ms`);

    // Determine block retrieval range
    if (btcConfig.blockRetrievalRestart) _blockRetrievalRestart = btcConfig.blockRetrievalRestart;
    if (btcConfig.blockRetrievalStart && btcConfig.blockRetrievalStart > 0) {
        log.info(MODULELOG, `Starting block specified in configuration: ${btcConfig.blockRetrievalStart}`);
        _blockRetrievalStart = btcConfig.blockRetrievalStart;
    }
    if (btcConfig.blockRetrievalEnd && btcConfig.blockRetrievalEnd > 0) {
        log.info(MODULELOG, `Ending block specified in configuration: ${btcConfig.blockRetrievalEnd}`);
        _blockRetrievalEnd = btcConfig.blockRetrievalEnd;
    }

    // Determine starting block
    try {
        _btcState.status.highestBlock = await btcRpc.getBlockCount();
        _discoveredBlock = _btcState.status.highestBlock;
        _blockCursor = determineStartingBlock(
            _btcState.status.highestBlock,
            _btcState.status.currentBlock,
            _blockRetrievalStart,
            _blockRetrievalRestart
        );
        logStartingBlock(MODULELOG, _blockCursor, _btcState.status.highestBlock);
    } catch(err) {
        if (err) return Promise.reject(err);
        return Promise.reject(new Error(`Could not connect to ${_btcChain} node and determine starting block`));
    }
    // Schedule iterative block retrieval
    scheduleBlockIteration();
    wfState.updateBlockchainData(_btcChain, _btcState);
    return Promise.resolve();
}

/**
 * Scans a block for Whiteflag messages, and triggers to scan next block
 * @function scanBlocks
 * @alias module:lib/blockchains/bitcoin/listener.scanBlocks
 * @param {number} cursor the block to scan
 * @param {number} lastBlock the last block to scan block
 * @param {Array} [messages] messages processed in an earlier block
 * @returns {Promise} resolves if all blocks are successfully processed
 */
function scanBlocks(cursor, lastBlock, messages = []) {
    return processBlock(cursor)
    .then(wfMessages => {
        messages = addArray(messages, wfMessages);
        let nextBlock = ++cursor;
        if (nextBlock > lastBlock) return Promise.resolve(messages);
        return scanBlocks(nextBlock, lastBlock, messages);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

// PRIVATE BLOCKCHAIN LISTENER FUNCTIONS //
/**
 * Schedules next block retrieval iteration
 * @private
 */
function scheduleBlockIteration() {
    setTimeout(executeBlockIteration, _blockInterval);
}

/**
 * Executes block retrieval iteration and re-schedules itself when completed
 * @private
 */
async function executeBlockIteration() {
    _iterationCount += 1;

    // Get the actual Bitcoin blockchain height
    btcRpc.getBlockCount()
    .then(highestBlock => {
        // Check if one more new block exists
        if (highestBlock >  _discoveredBlock) {
            _discoveredBlock = highestBlock;
            _btcState.status.highestBlock = highestBlock;
            log.trace(MODULELOG, `Iteration ${_iterationCount}: New highest block discovered on node is ${_discoveredBlock}`);
        }
        // Check if highest block is already processed, and schedule next iteration
        if (highestBlock === _blockCursor) {
            log.trace(MODULELOG, `Iteration ${_iterationCount}: Highest block ${highestBlock} has already been processed`);
            return Promise.reject(); // Stop this iteration without error
        }
        // Current block may be higher than highest block when node is resyncing
        if (_blockCursor > highestBlock) {
            log.trace(MODULELOG, `Iteration ${_iterationCount}: Current block ${_blockCursor} is higher than highest block ${highestBlock} on node`);
            return Promise.reject(); // Stop this iteration withour error
        }
        // Last block to retrieve is highest block or, if provided, end block
        let endBlock = highestBlock;
        if (_blockRetrievalEnd > 0 && _blockRetrievalEnd < highestBlock) {
            endBlock = _blockRetrievalEnd;
        }
        // Process new stack of blocks
        _blockStackSize = 0;
        return processBlocks(_blockCursor, endBlock); // Return new Promise
    })
    .then(async () => {
        // Done processing blocks, continue with the next
        if (_blockRetrievalEnd === 0 || _blockCursor < _blockRetrievalEnd) {
            return Promise.resolve(); // This iteration is completed
        }
        // Provided end block is reached
        log.info(MODULELOG, `Iteration ${_iterationCount}: Reached configured block retrieval end: ${_blockCursor}`);
        _blockRetrievalEnd = 0;

        // Dtermine from where to proceed
        _blockCursor = determineStartingBlock(
            _btcState.status.highestBlock,
            _blockCursor,
            _blockRetrievalEnd,
            _blockRetrievalRestart
        );
        logStartingBlock(MODULELOG, _blockCursor, _btcState.status.highestBlock);
        return Promise.resolve();
    })
    .then(() => {
        // Continue with next iteration almost immediately
        return setTimeout(executeBlockIteration, BLOCKITERATIONDELAY);
    })
    .catch(err => {
        if (err) {
            // Schedule next iteration shortly to retry
            log.warn(MODULELOG, `Could not complete retrieval of block ${_blockCursor} in iteration ${_iterationCount}: ${err.message}`);
            return setTimeout(executeBlockIteration, BLOCKRETRYDELAY);
        }
        // Schedule next iteration based on configured block time
        return scheduleBlockIteration();
    });
}

/**
 * Processes multiple Bitcoin blocks
 * @private
 * @param {number} startBlock the block after which the next blocks are processed
 * @param {number} endBlock the block up to which blocks should be processed
 * @returns {Promise} resolves to Error or null when completed
 */
async function processBlocks(startBlock, endBlock) {
    // Stack callbacks to a maximum of 100
    _blockStackSize += 1;
    if (_blockStackSize > BLOCKSTACKSIZE) {
        log.trace(MODULELOG, `Iteration ${_iterationCount}: Reached maximum block processing stack size: ${_blockStackSize}`);
        return Promise.resolve(); // Completed for now
    }
    // If current block is last block, then there is no new block to retrieve
    if (startBlock === endBlock) {
        log.trace(MODULELOG, `Iteration ${_iterationCount}: No new block to retrieve`);
        return Promise.resolve(); // Completed for now
    }
    // Block to be processed is the next block after starting block and skipped blocks
    if (_skippedBlocks > 0) log.debug(MODULELOG, `Iteration ${_iterationCount}: Skipped ${_skippedBlocks} blocks since block ${startBlock}`);
    let thisBlock = startBlock + _skippedBlocks + 1;

    // Skip this block if the block has been retried too often
    if (_blockMaxRetries > 0 && _blockRetryCount > _blockMaxRetries) {
        log.warn(MODULELOG, `Iteration ${_iterationCount}: Skipping block ${thisBlock} after ${_blockMaxRetries} retries`);
        thisBlock += 1;
        _blockRetryCount = 0;
        _skippedBlocks += 1;
    }
    // Log where we are with blocks
    if (_blockRetryCount !== 0) log.debug(MODULELOG, `Iteration ${_iterationCount}: Retry ${_blockRetryCount} to process block: ${thisBlock}`);
    log.trace(MODULELOG, `Iteration ${_iterationCount}: Retrieving block ${_blockStackSize}: ${thisBlock}`);

    // Retrieve new block
    try {
        await processBlock(thisBlock);
    } catch(err) {
        _blockRetryCount += 1;
        return Promise.reject(err); // Retry this block
    }
    // Completed this block
    _blockCursor = thisBlock;
    _blockRetryCount = 0;
    _skippedBlocks = 0;

    // Update state
    _btcState.status.currentBlock = _blockCursor;
    wfState.updateBlockchainData(_btcChain, _btcState);

    // Get next block if not yet at last block
    if (thisBlock < endBlock) return processBlocks(_blockCursor, endBlock); // Process next block
    return Promise.resolve(); // Completed all blocks
}

/**
 * Processes a single Bitcoin block
 * @private
 * @param {number} blockNumber the block to be processed
 * @returns {Promise} resolves if the block is succesfully processed
 */
async function processBlock(blockNumber) {
    // Get block from node
    let block;
    try {
        block = await btcRpc.getBlockByNumber(blockNumber, true); // Get full block inclusing transactions
    } catch(err) {
        return Promise.reject(new Error(`Could not retrieve block ${blockNumber}: ${err.message}`));
    }
    // Check transactions in block
    let transactionCount = block.tx.length;
    if (!block || transactionCount < 1) {
        // Rare case, but a block may be empty
        log.info(MODULELOG, `No transactions in block: ${blockNumber}`);
        return Promise.resolve(); // Completed this block
    }
    log.trace(MODULELOG, `Transactions discovered in block ${blockNumber}: ${transactionCount}`);

    // Let accounts process this block for UTXOs
    btcAccounts.processBlock(blockNumber, block);

    // Process transactions from block
    return processTransactions(blockNumber, block.time, block.tx)
    .then((wfMessages) => {
        return Promise.resolve(wfMessages.filter(message => {
            return message !== null && 
                   message !== '' &&
                   message !== undefined;
            }
        ));
    })
    .then((wfMessages) => {
        log.info(MODULELOG, `Found ${wfMessages.length} Whiteflag messages in ${transactionCount} transactions in block ${blockNumber}`);
        return Promise.resolve(wfMessages); // Completed this block
    })
    .catch(err => {
        if (!err) return Promise.reject(new Error(`Could not process block ${blockNumber}`));
        return Promise.reject(new Error(`Could not process block ${blockNumber}: ${err.message}`));
    });
}

/**
 * Processes the transactions of a Bitcoin block
 * @private
 * @param {number} blockNumber the block number of the transactions
 * @param {number} blockTime the block timestamp
 * @param {Array} transactions the transactions to process
 * @param {number} [index] the first transaction in the array to process
 * @param {Array} [messages] messages processes in an earlier batch
 * @returns {Promise} resolves if all transactions are successfully processed
 */
function processTransactions(blockNumber, blockTime, transactions, index = 0, messages = []) {
    // Get transaction batch of Promises in an array to extract Whiteflag messages
    let transactionBatch = createTransactionBatch(blockNumber, blockTime, transactions, index);
    if (transactionBatch.length < 1) return Promise.resolve();

    // Resolve all transaction promises in the batch
    return Promise.all(transactionBatch)
    .then(wfMessages => {
        messages = addArray(messages, wfMessages);

        // Next batch
        let nextIndex = index + _transactionBatchSize;
        if (nextIndex >= transactions.length) return Promise.resolve(messages);
        return processTransactions(blockNumber, blockTime, transactions, nextIndex, messages);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Combines multiple transactions from a Bitcoin block as promises in an array for batch processing
 * @private
 * @param {number} blockNumber the block number of the transactions
 * @param {number} blockTime the block timestamp
 * @param {Array} transactions the transactions to process
 * @param {number} index the first transaction in the array to process
 * @returns {Array} Array with transaction Promises
 */
function createTransactionBatch(blockNumber, blockTime, transactions, index) {
    let transactionBatch = [];
    for (
        let i = index;
        i < Math.min(index + _transactionBatchSize, transactions.length);
        i++
    ) {
        // Get a promise for the next transaction
        transactionBatch.push(
            new Promise((resolve, reject) => {
                btcTransactions.extractMessage(transactions[i], blockNumber, blockTime)
                .then(wfMessage => {
                    log.trace(MODULELOG, `Received Whiteflag message: ${JSON.stringify(wfMessage.MetaHeader)}`);
                    wfRxEvent.emit('messageReceived', wfMessage);
                    return resolve(wfMessage);
                })
                .catch(err => {
                    if (err.code === 'WF_API_NO_DATA') return resolve(); // No Whiteflag message in transaction
                    return reject(new Error(`Could not process transaction ${transactions[i].hash}: ${err.message}`)); // Other error
                });
            })
        );
    }
    return transactionBatch;
}
