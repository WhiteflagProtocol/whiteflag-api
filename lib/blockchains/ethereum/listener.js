'use strict';
/**
 * @module lib/blockchains/ethereum/listener
 * @summary Whiteflag API Ethereum listener module
 * @description Module to connect to the Ethereum network and crawl/listen for transactions
 */
module.exports = {
    init: initListener
};

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { ignore } = require('../../common/processing');
const { ProcessingError } = require('../../common/errors');
const { determineStartingBlock, logStartingBlock} = require('../common');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Whiteflag event emitters //
const wfRxEvent = require('../../protocol/events').rxEvent;

// Ethereum sub-modules //
const ethRpc = require('./rpc');
const ethTransactions = require('./transactions');

// Module constants //
const BLOCKSTACKSIZE = 100;
const BLOCKRETRYDELAY = 10000;
const BLOCKITERATIONDELAY = 5;

// Module variables //
let _blockchainName;
let _ethState;
let _iterationCount = 0;
let _discoveredBlock = 0;
let _blockCursor = 0;
let _blockInterval = 6000;
let _blockRetrievalRestart = 100;
let _blockRetrievalStart = 0;
let _blockRetrievalEnd = 0;
let _blockStackSize = 0;
let _blockMaxRetries = 0;
let _blockRetryCount = 0;
let _skippedBlocks = 0;
let _transactionBatchSize = 64;

/**
 * Initialises Ethereum blockchain listener
 * @function initListener
 * @alias module:lib/blockchains/ethereum/listener.init
 * @param {Object} ethConfig the Ethereum blockchain configuration
 * @param {Object} ethState the Ethereum blockchain state
 * @returns {Promise} resolve if succesfully initialised
 */
async function initListener(ethConfig, ethState) {
    _blockchainName = ethConfig.name;
    _ethState = ethState;
    log.trace(_blockchainName, 'Initialising listener for Ethereum blockchain transactions...');

    // Block processing parameters
    if (ethConfig.blockMaxRetries) _blockMaxRetries = ethConfig.blockMaxRetries;
    if (_blockMaxRetries > 0) log.debug(_blockchainName, `Maximum retries for processing a block is set to ${_blockMaxRetries} for each block`);
    if (ethConfig.transactionBatchSize) _transactionBatchSize = ethConfig.transactionBatchSize;
    log.debug(_blockchainName, `Maximum number of transactions in a block that are processed in parallel is set to ${_transactionBatchSize}`);

    // Block interval time
    if (ethConfig.blockRetrievalInterval && ethConfig.blockRetrievalInterval > 500) {
        _blockInterval = ethConfig.blockRetrievalInterval;
    }
    log.info(_blockchainName, `Block retrieval interval: ${_blockInterval} ms`);

    // Determine block retrieval range
    if (ethConfig.blockRetrievalRestart) _blockRetrievalRestart = ethConfig.blockRetrievalRestart;
    if (ethConfig.blockRetrievalStart && ethConfig.blockRetrievalStart > 0) {
        log.info(_blockchainName, `Starting block specified in configuration: ${ethConfig.blockRetrievalStart}`);
        _blockRetrievalStart = ethConfig.blockRetrievalStart;
    }
    if (ethConfig.blockRetrievalEnd && ethConfig.blockRetrievalEnd > 0) {
        log.info(_blockchainName, `Ending block specified in configuration: ${ethConfig.blockRetrievalEnd}`);
        _blockRetrievalEnd = ethConfig.blockRetrievalEnd;
    }
    // Determine starting block
    try {
        _ethState.status.highestBlock = await ethRpc.getHighestBlock();
        _blockCursor = determineStartingBlock(
            _ethState.status.highestBlock,
            _ethState.status.currentBlock,
            _blockRetrievalStart,
            _blockRetrievalRestart
        );
        logStartingBlock(_blockchainName, _blockCursor, _ethState.status.highestBlock);
    } catch(err) {
        if (err) return Promise.reject(err);
        return Promise.reject(new Error('Could not connect to Ethereum node and determine statring block'));
    }
    // Schedule iterative block retrieval
    scheduleBlockIteration();
    wfState.updateBlockchainData(_blockchainName, _ethState);
    return Promise.resolve(); // Succesfully completed initialisation
}

// PRIVATE LISTENER FUNCTIONS //
/*
* The functions below retrieve Ethereum blockchain data, then the blocks and then for each
* block the transactions. To assure the data is retrieved in a controlled and sequential
* manner, promises are used. When one block has succesfully been processed, the next
* block will be processed. If an error occurs while retrieving a block, the block
* will be retrieved again until successfully processed. To optimize retrieval of data,
* transactions for a single block will be retrieved in a batch, based on the batch number
* configuration parameter.
*/

/**
 * Schedules next block retrieval iteration
 * @private
 */
function scheduleBlockIteration() {
    log.trace(_blockchainName, `Scheduling block retrieval iteration ${(_iterationCount + 1)} in ${_blockInterval} ms`);
    setTimeout(executeBlockIteration, _blockInterval);
}

/**
 * Executes block retrieval iteration and re-schedules itself when completed
 * @private
 */
function executeBlockIteration() {
    _iterationCount += 1;
    log.trace(_blockchainName, `Starting block retrieval iteration ${_iterationCount}`);

    // Get the actual Ethereum blockchain height
    ethRpc.getHighestBlock()
    .then(highestBlock => {
        _ethState.status.highestBlock = highestBlock;

        // Check if highest block is already processed, and schedule next iteration
        if (highestBlock === _blockCursor) {
            log.trace(_blockchainName, `Highest block ${highestBlock} has already been processed`);
            return Promise.reject(); // Stop this iteration without error
        }
        // Current block may be higher than highest block when node is resyncing
        if (_blockCursor > highestBlock) {
            log.debug(_blockchainName, `Current block ${_blockCursor} is higher than highest block ${highestBlock} on node`);
            return Promise.reject(); // Stop this iteration withour error
        }
        // Check if one more new block exists
        if (_blockRetrievalEnd === 0 && highestBlock !== _discoveredBlock) {
            _discoveredBlock = highestBlock;
            log.trace(_blockchainName, `New highest block discovered on node: ${_discoveredBlock}`);
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
        log.info(_blockchainName, `Reached configured block retrieval end: ${_blockCursor}`);
        _blockRetrievalEnd = 0;

        // Dtermine from where to proceed
        _blockCursor = determineStartingBlock(_ethState.status.highestBlock, _blockCursor, _blockRetrievalEnd, _blockRetrievalRestart);
        logStartingBlock(_blockchainName, _blockCursor, _ethState.status.highestBlock);
        return Promise.resolve();
    })
    .then(() => {
        // Continue with next iteration almost immediately
        return setTimeout(executeBlockIteration, BLOCKITERATIONDELAY);
    })
    .catch(err => {
        if (err) {
            // Schedule next iteration shortly to retry
            log.warn(_blockchainName, `Could not complete retrieval of block ${_blockCursor} in iteration ${_iterationCount}: ${err.message}`);
            return setTimeout(executeBlockIteration, BLOCKRETRYDELAY);
        }
        // Schedule next iteration based on configured block time
        return scheduleBlockIteration();
    });
}

/**
 * Processes multiple Ethereum blocks
 * @private
 * @param {number} startBlock the block after which the next blocks are processed
 * @param {number} endBlock the block up to which blocks should be processed
 * @returns {Promise} resolves to Error or null when completed
 */
async function processBlocks(startBlock, endBlock) {
    // Stack callbacks to a maximum of 100
    _blockStackSize += 1;
    if (_blockStackSize > BLOCKSTACKSIZE) {
        log.trace(_blockchainName, `Reached maximum block processing stack size: ${_blockStackSize}`);
        return Promise.resolve(); // Completed for now
    }
    // If current block is last block, then there is no new block to retrieve
    if (startBlock === endBlock) {
        log.trace(_blockchainName, 'No new block to retrieve');
        return Promise.resolve(); // Completed for now
    }
    // Block to be processed is the next block after starting block and skipped blocks
    if (_skippedBlocks > 0) log.trace(_blockchainName, `Skipped ${_skippedBlocks} blocks since block ${startBlock}`);
    let thisBlock = startBlock + _skippedBlocks + 1;

    // Skip this block if the block has been retried too often
    if (_blockMaxRetries > 0 && _blockRetryCount > _blockMaxRetries) {
        log.warn(_blockchainName, `Skipping block ${thisBlock} after ${_blockMaxRetries} retries`);
        thisBlock += 1;
        _blockRetryCount = 0;
        _skippedBlocks += 1;
    }
    // Log where we are with blocks
    if (_blockRetryCount !== 0) log.info(_blockchainName, `Retry ${_blockRetryCount} to process block: ${thisBlock}`);
    log.trace(_blockchainName, `Retrieving block ${_blockStackSize} of iteration ${_iterationCount}: ${thisBlock}`);

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
    _ethState.status.currentBlock = _blockCursor;
    wfState.updateBlockchainData(_blockchainName, _ethState);

    // Get next block if not yet at last block
    if (thisBlock < endBlock) return processBlocks(_blockCursor, endBlock); // Process next block
    return Promise.resolve(); // Completed all blocks
}

/**
 * Processes a single Ethereum block
 * @private
 * @param {number} blockNumber the block to be processed
 * @returns {Promise} resolves if the block is succesfully processed
 */
async function processBlock(blockNumber) {
    // Get block from node
    let block;
    try {
        block = await ethRpc.getBlockByNumber(blockNumber);
    } catch(err) {
        return Promise.reject(new Error(`Could not retrieve block ${blockNumber}: ${err.message}`));
    }
    // Check transactions in block
    let transactionCount = block.transactions.length;
    if (!block || transactionCount < 1) {
        // Rare case, but in certain instances there could be no transactions in the block
        log.info(_blockchainName, `No transactions in block: ${blockNumber}`);
        return Promise.resolve(); // Completed this block
    }
    // Retrieve transactions from block
    log.trace(_blockchainName, `Transactions discovered in block ${blockNumber}: ${transactionCount}`);
    return processTransactions(0, block.transactions, block.timestamp)
    .then(() => {
        log.info(_blockchainName, `Transactions processed from block ${blockNumber}: ${transactionCount} `);
        return Promise.resolve(); // Completed this block
    })
    .catch(err => {
        if (!err) return Promise.reject(new Error(`Could not process block ${blockNumber}`));
        return Promise.reject(new Error(`Could not process block ${blockNumber}: ${err.message}`));
    });
}

/**
 * Processes the transactions of an Ethereum block
 * @private
 * @param {number} index the transaction in the array to process
 * @param {Array} transactions the transactions to process
 * @param {number} timestamp the block timestamp
 * @returns {Promise} resolves if all transactions are successfully processed
 */
 function processTransactions(index, transactions, timestamp) {
    // Get transaction batch of Promises in an array
    let transactionBatch = createTransactionBatch(index, transactions, timestamp);
    if (transactionBatch.length < 1) return Promise.resolve();

    // Resolve all transaction promises in the batch
    return Promise.all(transactionBatch)
    .then(data => {
        ignore(data); // All extracted Whiteflag messages are already put on the rx event chain

        // Next batch
        let nextIndex = index + _transactionBatchSize;
        if (nextIndex >= transactions.length) return Promise.resolve();
        return processTransactions(nextIndex, transactions, timestamp);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Combines multiple transactions from an Ethereum block as promises in an array for batch processing
 * @private
 * @param {number} index the first transaction in the array to process
 * @param {Array} transactions the transactions to process
 * @param {number} timestamp the block timestamp
 * @return {Array} Array with transaction Promises
 */
function createTransactionBatch(index, transactions, timestamp) {
    let transactionBatch = [];
    for (
        let i = index;
        i < Math.min(index + _transactionBatchSize, transactions.length);
        i++
    ) {
        // Get a promise for the next transaction
        let transactionHash = transactions[i];
        transactionBatch.push(
            // Whiteflag message is extracted by resolving the promise
            ethRpc.getRawTransaction(transactionHash)
            .then(transaction => {
                if (!transaction) return log.warn(_blockchainName, `No data received for transaction: ${transactionHash}`);
                return ethTransactions.extractMessage(transaction, timestamp);
            })
            .then(wfMessage => {
                log.trace(_blockchainName, `Received Whiteflag message: ${JSON.stringify(wfMessage.MetaHeader)}`);
                wfRxEvent.emit('messageReceived', wfMessage);
            })
            .catch(err => {
                if (err instanceof ProcessingError) return Promise.resolve(); // No Whiteflag message in transaction
                return Promise.reject(new Error(`Could not process transaction ${transactionHash}: ${err.message}`)); // Other error
            })
        );
    }
    return transactionBatch;
}
