'use strict';
/**
 * @module lib/blockchains/fennel/listener
 * @summary Whiteflag API Fennel listener module
 * @description Module to connect to the Fennel parachain and crawl/listen for transactions
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
const { noHexPrefix } = require('../_common/format');
const { determineStartingBlock,
        logStartingBlock } = require('../_common/state');

// Fennel sub-modules //
const fnlRpc = require('./rpc');
const fnlTransactions = require('./transactions');

// Module constants //
const MODULELOG = 'fennel';
const BLOCKSTACKSIZE = 100;
const BLOCKRETRYDELAY = 10000;
const BLOCKITERATIONDELAY = 50;
const TIMESECTION = 'timestamp';
const TIMEMETHOD = 'set';
const WFMSGSECTION = 'signal';
const WFMSGMETHOD = 'sendSignal';

// Module variables //
let _fnlChain;
let _fnlState;
let _traceRaw = false;
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

/**
 * Initiates the listener for Fennel blockchain transactions
 * @function initListener
 * @alias module:lib/blockchains/fennel/listener.init
 * @param {Object} fnlConfig the Fennel blockchain configuration
 * @param {Object} fnlState the Fennel blockchain state
 * @returns {Promise} resolve if succesfully initialised
 */
async function initListener(fnlConfig, fnlState) {
    log.trace(MODULELOG, 'Initialising listener for Fennel blockchain transactions');
    _fnlChain = fnlConfig.name;
    _fnlState = fnlState;

    // Trace all transactions if configured
    if (fnlConfig.traceRawTransaction) _traceRaw = fnlConfig.traceRawTransaction;

    // Block processing parameters
    if (fnlConfig.blockMaxRetries) _blockMaxRetries = fnlConfig.blockMaxRetries;
    if (_blockMaxRetries > 0) log.debug(MODULELOG, `Maximum retries for processing a block is set to ${_blockMaxRetries} for each block`);

    // Block interval time
    if (fnlConfig.blockRetrievalInterval && fnlConfig.blockRetrievalInterval > 500) {
        _blockInterval = fnlConfig.blockRetrievalInterval;
    }
    log.info(MODULELOG, `Block retrieval interval is set to ${_blockInterval} ms`);

    // Determine block retrieval range
    if (fnlConfig.blockRetrievalRestart) _blockRetrievalRestart = fnlConfig.blockRetrievalRestart;
    if (fnlConfig.blockRetrievalStart && fnlConfig.blockRetrievalStart > 0) {
        log.info(MODULELOG, `Starting block specified in configuration: ${fnlConfig.blockRetrievalStart}`);
        _blockRetrievalStart = fnlConfig.blockRetrievalStart;
    }
    if (fnlConfig.blockRetrievalEnd && fnlConfig.blockRetrievalEnd > 0) {
        log.info(MODULELOG, `Ending block specified in configuration: ${fnlConfig.blockRetrievalEnd}`);
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
        logStartingBlock(MODULELOG, _blockCursor, _fnlState.status.highestBlock);
    } catch(err) {
        if (err) return Promise.reject(err);
        return Promise.reject(new Error(`Could not connect to ${_fnlChain} node and determine starting block`));
    }
    // Schedule iterative block retrieval
    scheduleBlockIteration();
    wfState.updateBlockchainData(_fnlChain, _fnlState);
    return Promise.resolve();
}

/**
 * Scans a block for Whiteflag messages, and triggers to scan next block
 * @function scanBlocks
 * @alias module:lib/blockchains/fennel/listener.scanBlocks
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

    // Get the actual Fennel blockchain height
    fnlRpc.getHighestBlock()
    .then(highestBlock => {
        // Check if one more new block exists
        if (highestBlock >  _fnlState.status.highestBlock) {
            _discoveredBlock = highestBlock;
            _fnlState.status.highestBlock = highestBlock;
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
        // Do not immediately process highest block 
        if ((highestBlock - 1) === _blockCursor) {
            log.trace(MODULELOG, `Iteration ${_iterationCount}: Waiting for new block before processing current highest block ${highestBlock}`);
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
        log.info(MODULELOG, `Iteration ${_iterationCount}: Reached configured block retrieval end: ${_blockCursor}`);
        _blockRetrievalEnd = 0;

        // Dtermine from where to proceed
        _blockCursor = determineStartingBlock(
            _fnlState.status.highestBlock,
            _blockCursor,
            _blockRetrievalEnd,
            _blockRetrievalRestart
        );
        logStartingBlock(MODULELOG, _blockCursor, _fnlState.status.highestBlock);
        return Promise.resolve();
    })
    .then(() => {
        // Continue with next iteration
        return setTimeout(executeBlockIteration, BLOCKITERATIONDELAY);
    })
    .catch(err => {
        if (err) {
            // Schedule next iteration shortly to retry
            log.warn(MODULELOG, `Iteration ${_iterationCount}: Could not complete retrieval of block ${_blockCursor}: ${err.message}`);
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
    _fnlState.status.currentBlock = _blockCursor;
    wfState.updateBlockchainData(_fnlChain, _fnlState);

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
        block = await fnlRpc.getBlockByNumber(blockNumber, true); // Get full block including extrinsics
    } catch(err) {
        return Promise.reject(new Error(`Could not retrieve block ${blockNumber}: ${err.message}`));
    }
    // Check extrinsics in block
    let extrinsicCount = block?.extrinsics?.length;
    if (!block || extrinsicCount < 1) {
        // Rare case, but a block may be empty
        log.info(MODULELOG, `No extrinsics in block: ${blockNumber}`);
        return Promise.resolve(); // Completed this block
    }
    log.trace(MODULELOG, `Extrinsics discovered in block ${blockNumber}: ${extrinsicCount}`);

    // Process transactions from block
    return processTransactions(blockNumber, block)
    .then((wfMessages) => {
        return Promise.resolve(wfMessages.filter(message => {
            return message !== null && 
                   message !== '' &&
                   message !== undefined;
            }
        ));
    })
    .then((wfMessages) => {
        log.info(MODULELOG, `Found ${wfMessages.length} Whiteflag messages in ${extrinsicCount} extrinsics in block ${blockNumber}`);
        return Promise.resolve(wfMessages); // Completed this block
    })
    .catch(err => {
        if (!err) return Promise.reject(new Error(`Could not process block ${blockNumber}`));
        return Promise.reject(new Error(`Could not process block ${blockNumber}: ${err.message}`));
    });
}

/**
 * Processes all transactions of a Fennel block
 * @private
 * @param {number} blockNumber the block number
 * @param {Object} block the full block including extrinsics
 * @returns {Promise} resolves if all extrinsics are successfully processed
 */
function processTransactions(blockNumber, block) {
    return fnlRpc.getEvents(blockNumber)
    .then(events => {
        let blockTime;
        let transactionBatch = [];
        block.extrinsics.forEach(( ex, index ) => {
            if (_traceRaw) log.trace(MODULELOG, `Processing extrinsic ${blockNumber}/${index}: ${JSON.stringify(ex.toHuman())}`)
            if (ex.method.method === TIMEMETHOD && ex.method.section === TIMESECTION) {
                blockTime = new Date(ex.method.args[0].unwrap().toNumber());
                if (_traceRaw) log.trace(MODULELOG, `Found timestamp in extrinsic ${blockNumber}/${index}: ${blockTime}`);
            }
            if (ex.method.method == WFMSGMETHOD && ex.method.section == WFMSGSECTION) {
                if (_traceRaw) log.trace(MODULELOG, `Found signal in extrinsic ${blockNumber}/${index}`);
                transactionBatch.push(extractTransaction(ex, events, index, blockNumber, blockTime));
            }
        });
        if (transactionBatch.length < 1) return Promise.resolve([]);
        return Promise.all(transactionBatch);
    })
    .catch(err => {
        return Promise.reject(err);
    });;
}

/**
 * Creates transaction from extrinsic and events
 * @private
 * @param {Object} ex the extrinsic
 * @param {Array} events the events related to the block
 * @param {number} index the index of the extrinsic in the block
 * @param {number} blockNumber the block number of the transaction
 * @param {Date} blockTime the timestamp of the block
 * @returns {Promise} transaction details from extrinsic and events
 */
function extractTransaction(ex, events, index, blockNumber, blockTime) {
    return new Promise((resolve, reject) => {
        let exHash, exData, exEvents;
        try {
            exHash = ex.hash.toHex();
            exData = JSON.parse(ex);
            exEvents = Array
                .from(new Set([...events].map(JSON.stringify)))
                .map(JSON.parse)
                .filter(event => event.phase.applyExtrinsic === index)
                .map(event => {return event.event});
        } catch(err) {
            return reject(new Error(`Could not get transaction data from extrinsic: ${err.message}`))
        }
        fnlTransactions.extractMessage({
            hash: noHexPrefix(exHash),
            block: blockNumber,
            index: index,
            timestamp: blockTime.toISOString(),
            originator: exData.signature.signer.id,
            signal: noHexPrefix(exData.method.args.signal),
            events: exEvents
        })
        .then(wfMessage => {
            log.trace(MODULELOG, `Received Whiteflag message: ${JSON.stringify(wfMessage.MetaHeader)}`);
            wfRxEvent.emit('messageReceived', wfMessage);
            return resolve(wfMessage);
        })
        .catch(err => {
            if (err.code === 'WF_API_NO_DATA') return resolve();  // No Whiteflag message in transaction
            return reject(new Error(`Could not process extrinsic ${blockNumber}/${index}: ${err.message}`)); // Other error
        });
    });
}
