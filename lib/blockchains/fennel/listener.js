'use strict';
/**
 * @module lib/blockchains/fennel/listener
 * @summary Whiteflag API Fennel listener module
 * @description Module to connect to the Fennel parachain and crawl/listen for transactions
 */
module.exports = {
    init: initListener
};

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { ignore } = require('../../common/processing');
const { ProcessingError } = require('../../common/errors');

// Whiteflag modules //
const wfRxEvent = require('../../protocol/events').rxEvent;
const wfState = require('../../protocol/state');

// Whiteflag common blockchain functions //
const { determineStartingBlock, logStartingBlock } = require('../common/state');

// Fennel sub-modules //
const fnlRpc = require('./rpc');
const fennelTransactions = require('./transactions');

// Module constants //
const BLOCKSTACKSIZE = 100;
const BLOCKRETRYDELAY = 10000;
const BLOCKITERATIONDELAY = 5;

// Module variables //
let _fnlName = 'fennel';
let _fnlState;
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
 * Initiates the listener for Fennel blockchain transactions
 * @function initListener
 * @alias module:lib/blockchains/fennel/listener.init
 * @param {Object} fnlConfig the Fennel blockchain configuration
 * @param {Object} fnlState the Fennel blockchain state
 * @returns {Promise} resolve if succesfully initialised
 */
async function initListener(fnlConfig, fnlState) {
    _fnlName = fnlConfig.name;
    _fnlState = fnlState;

    log.trace(_fnlName, 'Initialising listener for Fennel blockchain transactions...');

    // Block processing parameters
    if (fnlConfig.blockMaxRetries) _blockMaxRetries = fnlConfig.blockMaxRetries;
    if (_blockMaxRetries > 0) log.debug(_fnlName, `Maximum retries for processing a block is set to ${_blockMaxRetries} for each block`);
    if (fnlConfig.transactionBatchSize) _transactionBatchSize = fnlConfig.transactionBatchSize;
    log.debug(_fnlName, `Maximum number of transactions in a block that are processed in parallel is set to ${_transactionBatchSize}`);

    // Block interval time
    if (fnlConfig.blockRetrievalInterval && fnlConfig.blockRetrievalInterval > 500) {
        _blockInterval = fnlConfig.blockRetrievalInterval;
    }
    log.info(_fnlName, `Block retrieval interval is set to ${_blockInterval} ms`);

    // Determine block retrieval range
    if (fnlConfig.blockRetrievalRestart) _blockRetrievalRestart = fnlConfig.blockRetrievalRestart;
    if (fnlConfig.blockRetrievalStart && fnlConfig.blockRetrievalStart > 0) {
        log.info(_fnlName, `Starting block specified in configuration: ${fnlConfig.blockRetrievalStart}`);
        _blockRetrievalStart = fnlConfig.blockRetrievalStart;
    }
    if (fnlConfig.blockRetrievalEnd && fnlConfig.blockRetrievalEnd > 0) {
        log.info(_fnlName, `Ending block specified in configuration: ${fnlConfig.blockRetrievalEnd}`);
        _blockRetrievalEnd = fnlConfig.blockRetrievalEnd;
    }

    // Determine starting block
    try {
        _fnlState.status.highestBlock = await fnlRpc.getHighestBlock();
        _blockCursor = determineStartingBlock(
            _fnlState.status.highestBlock,
            _fnlState.status.currentBlock,
            _blockRetrievalStart,
            _blockRetrievalRestart
        );
        logStartingBlock(_fnlName, _blockCursor, _fnlState.status.highestBlock);
    } catch(err) {
        if (err) return Promise.reject(err);
        return Promise.reject(new Error('Could not connect to Fennel node and determine starting block'));
    }
    // Schedule iterative block retrieval
    scheduleBlockIteration();
    wfState.updateBlockchainData(_fnlName, _fnlState);
    return Promise.resolve();
}

// PRIVATE BLOCKCHAIN LISTENER FUNCTIONS //
/**
 * Schedules next block retrieval iteration
 * @private
 */
function scheduleBlockIteration() {
    log.trace(_fnlName, `Scheduling block retrieval iteration ${(_iterationCount + 1)} in ${_blockInterval} ms`);
    setTimeout(executeBlockIteration, _blockInterval);
}

/**
 * Executes block retrieval iteration and re-schedules itself when completed
 * @private
 */
async function executeBlockIteration() {
    _iterationCount += 1;
    log.trace(_fnlName, `Starting block retrieval iteration ${_iterationCount}`);

    // Get the actual Fennel blockchain height
    fnlRpc.getHighestBlock()
    .then(highestBlock => {
        // Check if one more new block exists
        if (highestBlock >  _fnlState.status.highestBlock) {
            _discoveredBlock = highestBlock;
            _fnlState.status.highestBlock = highestBlock;
            log.trace(_fnlName, `New highest block discovered on node is ${_discoveredBlock}`);
        }
        // Check if highest block is already processed, and schedule next iteration
        if (highestBlock === _blockCursor) {
            log.trace(_fnlName, `Highest block ${highestBlock} has already been processed`);
            return Promise.reject(); // Stop this iteration without error
        }
        // Current block may be higher than highest block when node is resyncing
        if (_blockCursor > highestBlock) {
            log.debug(_fnlName, `Current block ${_blockCursor} is higher than highest block ${highestBlock} on node`);
            return Promise.reject(); // Stop this iteration withour error
        }
        // Do not immediately process highest block 
        if ((highestBlock - 1) === _blockCursor) {
            log.trace(_fnlName, `Waiting for new block before processing current highest block ${highestBlock}`);
            return Promise.reject(); // Stop this iteration without error
        }
        // Retrieve until one before highest block or, if provided, end block
        let endBlock = highestBlock - 1;
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
        log.info(_fnlName, `Reached configured block retrieval end: ${_blockCursor}`);
        _blockRetrievalEnd = 0;

        // Dtermine from where to proceed
        _blockCursor = determineStartingBlock(_fnlName, _fnlState.status.highestBlock, _blockCursor, _blockRetrievalEnd, _blockRetrievalRestart);
        logStartingBlock(_fnlName, _blockCursor, _fnlState.status.highestBlock);
        return Promise.resolve();
    })
    .then(() => {
        // Continue with next iteration almost immediately
        return setTimeout(executeBlockIteration, BLOCKITERATIONDELAY);
    })
    .catch(err => {
        if (err) {
            // Schedule next iteration shortly to retry
            log.warn(_fnlName, `Could not complete retrieval of block ${_blockCursor} in iteration ${_iterationCount}: ${err.message}`);
            return setTimeout(executeBlockIteration, BLOCKRETRYDELAY);
        }
        // Schedule next iteration based on configured block time
        return scheduleBlockIteration();
    });
}

/**
 * Processes multiple Fennel blocks
 * @private
 * @param {number} startBlock the block after which the next blocks are processed
 * @param {number} endBlock the block up to which blocks should be processed
 * @returns {Promise} resolves to Error or null when completed
 */
async function processBlocks(startBlock, endBlock) {
    // Stack callbacks to a maximum of 100
    _blockStackSize += 1;
    if (_blockStackSize > BLOCKSTACKSIZE) {
        log.trace(_fnlName, `Reached maximum block processing stack size: ${_blockStackSize}`);
        return Promise.resolve(); // Completed for now
    }
    // If current block is last block, then there is no new block to retrieve
    if (startBlock === endBlock) {
        log.trace(_fnlName, `Processed block ${startBlock} of ${endBlock}; no new block to retrieve`);
        return Promise.resolve(); // Completed for now
    }
    // Block to be processed is the next block after starting block and skipped blocks
    if (_skippedBlocks > 0) log.trace(_fnlName, `Skipped ${_skippedBlocks} blocks since block ${startBlock}`);
    let thisBlock = startBlock + _skippedBlocks + 1;

    // Skip this block if the block has been retried too often
    if (_blockMaxRetries > 0 && _blockRetryCount > _blockMaxRetries) {
        log.warn(_fnlName, `Skipping block ${thisBlock} after ${_blockMaxRetries} retries`);
        thisBlock += 1;
        _blockRetryCount = 0;
        _skippedBlocks += 1;
    }
    // Log where we are with blocks
    if (_blockRetryCount !== 0) log.info(_fnlName, `Retry ${_blockRetryCount} to process block: ${thisBlock}`);
    log.trace(_fnlName, `Retrieving block ${_blockStackSize} of iteration ${_iterationCount}: ${thisBlock}`);

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
    _fnlState.status.currentBlock = _blockCursor;
    wfState.updateBlockchainData(_fnlName, _fnlState);

    // Get next block if not yet at last block
    if (thisBlock < endBlock) return processBlocks(_blockCursor, endBlock); // Process next block
    return Promise.resolve(); // Completed all blocks
}

/**
 * Processes a single Fennel block
 * @private
 * @param {number} blockNumber the block to be processed
 * @returns {Promise} resolves if the block is succesfully processed
 */
async function processBlock(blockNumber) {
    // Get block from node
    let block;
    try {
        block = await fnlRpc.getBlockByNumber(blockNumber, true); // Get full block inclusing transactions
    } catch(err) {
        return Promise.reject(new Error(`Could not retrieve block ${blockNumber}: ${err.message}`));
    }
    // Check transactions in block
    let transactionCount = block.extrinsics.length;
    if (!block || transactionCount < 1) {
        // Rare case, but a block may be empty
        log.info(_fnlName, `No transactions in block: ${blockNumber}`);
        return Promise.resolve(); // Completed this block
    }
    log.trace(_fnlName, `Transactions discovered in block ${blockNumber}: ${transactionCount}`);

    // Process transactions from block
    return processTransactions(blockNumber, 0, block.extrinsics, block.time)
    .then(() => {
        log.info(_fnlName, `Transactions processed from block ${blockNumber}: ${transactionCount} `);
        return Promise.resolve(); // Completed this block
    })
    .catch(err => {
        if (!err) return Promise.reject(new Error(`Could not process block ${blockNumber}`));
        return Promise.reject(new Error(`Could not process block ${blockNumber}: ${err.message}`));
    });
}

/**
 * Processes the transactions of a Fennel block
 * @private
 * @param {number} blockNumber the block number of the transactions
 * @param {number} index the first transaction in the array to process
 * @param {Array} transactions the transactions to process
 * @param {number} timestamp the block timestamp
 * @returns {Promise} resolves if all transactions are successfully processed
 */
function processTransactions(blockNumber, index, transactions, timestamp) {
    // Get transaction batch of Promises in an array to extract Whiteflag messages
    let transactionBatch = createTransactionBatch(blockNumber, index, transactions, timestamp);
    if (transactionBatch.length < 1) return Promise.resolve();

    // Resolve all transaction promises in the batch
    return Promise.all(transactionBatch)
    .then(data => {
        ignore(data); // All extracted Whiteflag messages are already put on the rx event chain

        // Next batch
        let nextIndex = index + _transactionBatchSize;
        if (nextIndex >= transactions.length) return Promise.resolve();
        return processTransactions(blockNumber, nextIndex, transactions, timestamp);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Combines multiple transactions from a Fennel block as promises in an array for batch processing
 * @private
 * @param {number} blockNumber the block number of the transactions
 * @param {number} index the first transaction in the array to process
 * @param {Array} transactions the transactions to process
 * @param {number} timestamp the block timestamp
 * @return {Array} Array with transaction Promises
 */
function createTransactionBatch(blockNumber, index, transactions, timestamp) {
    let transactionBatch = [];
    for (
        let i = index;
        i < Math.min(index + _transactionBatchSize, transactions.length);
        i++
    ) {
        // Get a promise for the next transaction
        transactionBatch.push(
            new Promise((resolve, reject) => {
                fennelTransactions.extractMessage(transactions[i], blockNumber, timestamp)
                .then(wfMessage => {
                    log.trace(_fnlName, `Received Whiteflag message: ${JSON.stringify(wfMessage.MetaHeader)}`);
                    wfRxEvent.emit('messageReceived', wfMessage);
                    return resolve();
                })
                .catch(err => {
                    if (err instanceof ProcessingError) return resolve(); // No Whiteflag message in transaction
                    return reject(new Error(`Could not process transaction ${transactions[i].hash}: ${err.message}`)); // Other error
                });
            })
        );
    }
    return transactionBatch;
}
