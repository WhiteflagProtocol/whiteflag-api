'use strict';
/**
 * @module lib/blockchains/fennel/listener
 * @summary Whiteflag API Fennel listener module
 * @description Module to connect to the Fennel parachain and crawl/listen for transactions
 * @todo Improve performance
 */
module.exports = {
    init: initListener,
    scanBlocks
};

// Common internal functions and classes //
const log = require('../../_common/logger');
const arr = require('../../_common/arrays');
const { noHexPrefix } = require('../../_common/format');

// Whiteflag modules //
const wfRxEvent = require('../../protocol/events').rxEvent;
const wfState = require('../../protocol/state');

// Common blockchain functions //
const { determineStartingBlock,
        logStartingBlock } = require('../_common/state');

// Fennel sub-modules //
const fnlRpc = require('./rpc');
const fnlTransactions = require('./transactions');

// Module constants //
const MODULELOG = 'fennel';
const BATCHDELAY = 50;
const MAXBATCHSIZE = 100;
const BLOCKRETRYDELAY = 10000;
const TIMESECTION = 'timestamp';
const TIMEMETHOD = 'set';
const WFMSGSECTION = 'signal';
const WFMSGMETHOD = 'sendSignal';

// Module variables //
let _fnlChain;
let _fnlState;
let _traceRaw = false;
let _iterationCount = 0;
let _blockCursor = 0;
let _endBlock = 0;
let _blockInterval = 6000;
let _blockRetrievalRestart = 100;
let _blockRetrievalStart = 0;
let _blockRetrievalEnd = 0;
let _blockMaxRetries = 0;
let _blockBatchSize = 3;
let _batchRetryCount = 0;

/**
 * Initiates the listener for Fennel blockchain transactions
 * @function initListener
 * @alias module:lib/blockchains/fennel/listener.init
 * @param {Object} fnlConfig the Fennel blockchain configuration
 * @param {Object} fnlState the Fennel blockchain state
 * @param {Object} [fnlApi] the Fennel API
 * @returns {Promise} resolve if succesfully initialised
 */
async function initListener(fnlConfig, fnlState, fnlApi = null) {
    log.trace(MODULELOG, 'Initialising listener for Fennel blockchain transactions');
    _fnlChain = fnlConfig.name;
    _fnlState = fnlState;

    // Trace all transactions if configured
    if (fnlConfig.traceRawTransaction) _traceRaw = fnlConfig.traceRawTransaction;

    // Block processing parameters
    if (Object.hasOwn(fnlConfig, 'blockBatchSize')) _blockBatchSize = fnlConfig.blockBatchSize;
    if (_blockBatchSize > MAXBATCHSIZE) _blockBatchSize = MAXBATCHSIZE;
    log.debug(MODULELOG, `Maximum number of blocks that can be processed in parallel is set to ${_blockBatchSize}`);
    if (Object.hasOwn(fnlConfig, 'blockMaxRetries')) _blockMaxRetries = fnlConfig.blockMaxRetries;
    if (_blockMaxRetries > 0) log.debug(MODULELOG, `Maximum retries for processing a block is set to ${_blockMaxRetries} for each block`);

    // Block interval time
    if (Object.hasOwn(fnlConfig, 'blockRetrievalInterval') && fnlConfig.blockRetrievalInterval > 500) {
        _blockInterval = fnlConfig.blockRetrievalInterval;
    }
    log.info(MODULELOG, `Block retrieval interval is set to ${_blockInterval} ms`);

    // Determine block retrieval range
    if (Object.hasOwn(fnlConfig, 'blockRetrievalRestart')) {
        log.debug(MODULELOG, `Number of blocks to look back specified in configuration: ${fnlConfig.blockRetrievalRestart}`);
        _blockRetrievalRestart = fnlConfig.blockRetrievalRestart;
    }
    if (Object.hasOwn(fnlConfig, 'blockRetrievalStart') && fnlConfig.blockRetrievalStart > 0) {
        log.info(MODULELOG, `Starting block specified in configuration: ${fnlConfig.blockRetrievalStart}`);
        _blockRetrievalStart = fnlConfig.blockRetrievalStart;
    }
    if (Object.hasOwn(fnlConfig, 'blockRetrievalEnd') && fnlConfig.blockRetrievalEnd > 0) {
        log.info(MODULELOG, `Ending block specified in configuration: ${fnlConfig.blockRetrievalEnd}`);
        _blockRetrievalEnd = fnlConfig.blockRetrievalEnd;
    }
    // Check if connected via RPC or API
    if (!fnlApi) {
        log.warn(MODULELOG, 'Cannot start block listener because only limited web RPC functions available');
        return Promise.resolve();
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
    scheduleNextIteration();
    return Promise.resolve();
}

/**
 * Scans a block for Whiteflag messages, and triggers to scan next block
 * @function scanBlocks
 * @alias module:lib/blockchains/fennel/listener.scanBlocks
 * @param {number} cursor the block to scan
 * @param {number} endBlock the last block to scan block
 * @param {wfMessages[]} [wfMessages] Whiteflag messages processed in an earlier block
 * @returns {Promise} resolves if all blocks are successfully processed
 */
function scanBlocks(cursor, endBlock, wfMessages = []) {
    return processBlock(cursor)
    .then(messages => {
        wfMessages = arr.addArray(wfMessages, messages);
        let nextBlock = ++cursor;
        if (nextBlock > endBlock) return Promise.resolve(wfMessages);
        return scanBlocks(nextBlock, endBlock, wfMessages);
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
function scheduleNextIteration() {
    wfState.updateBlockchainData(_fnlChain, _fnlState);
    log.trace(MODULELOG, `Scheduling block iteration ${(_iterationCount + 1)} in ${_blockInterval} ms`)
    setTimeout(executeBlockIteration, _blockInterval);
}

/**
 * Schedules next block iteration for retry
 * @private
 */
function scheduleImmediateRetry() {
    wfState.updateBlockchainData(_fnlChain, _fnlState);
    log.trace(MODULELOG, `Scheduling block iteration ${(_iterationCount + 1)} in ${BLOCKRETRYDELAY} ms`)
    setTimeout(executeBlockIteration, BLOCKRETRYDELAY, true);
}

/**
 * Schedules next block iteration for retry
 * @private
 */
function scheduleImmediateIteration() {
    wfState.updateBlockchainData(_fnlChain, _fnlState);
    log.trace(MODULELOG, `Scheduling block iteration ${(_iterationCount + 1)} in ${BATCHDELAY} ms`)
    setTimeout(executeBlockIteration, BATCHDELAY, true);
}

/**
 * Executes block retrieval iteration and re-schedules itself when completed
 * @param {boolean} [immediate] proces next block batch immediately
 */
function executeBlockIteration(immediate = false) {
    _iterationCount += 1;
    return nextBlockIteration(immediate)
    .then((immediate) => {
        // Prcesses next batch immediately
        if (immediate) {
            return scheduleImmediateIteration(immediate);
        }
        // Done processing blocks, continue with the next
        if (_blockRetrievalEnd === 0 || _blockCursor < _blockRetrievalEnd) {
            return scheduleNextIteration();
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
        return scheduleNextIteration();
    })
    .catch(err => {
        if (err) {
            log.warn(MODULELOG, `Iteration ${_iterationCount}: ${err.message}`)
            return scheduleImmediateRetry();
        }
        return scheduleNextIteration();
    });
}

/**
 * Performs the block iteration by starting the batch processing of blocks
 * @param {boolean} [immediate] proces next block batch immediately
 * @private
 */
function nextBlockIteration(immediate = false) {
    // Prcesses batch immediately
    if (immediate) {
        return processBlocks(_blockCursor, _endBlock);
    }
    // Get the actual Fennel blockchain height
    return fnlRpc.getHighestBlock()
    .then(highestBlock => {
        // Check if one more new block exists
        if (highestBlock >  _fnlState.status.highestBlock) {
            log.trace(MODULELOG, `Iteration ${_iterationCount}: New highest block discovered on node is ${highestBlock}`);
            _fnlState.status.highestBlock = highestBlock;
        }
        // Current block may be higher than highest block when node is resyncing
        if (_blockCursor >= highestBlock) {
            log.trace(MODULELOG, `Iteration ${_iterationCount}: Waiting for new highest block`);
            return Promise.reject();
        }
        // Retrieve until highest block or, if provided, end block
        if (_blockRetrievalEnd > 0 && _blockRetrievalEnd < highestBlock) {
            _endBlock = _blockRetrievalEnd;
        } else {
            _endBlock = highestBlock - 1;
        }
        // Process new block batch
        return processBlocks(_blockCursor, _endBlock);
    })
    .catch(err => {
        return Promise.reject(err);
    })
}

/**
 * Processes multiple Fennel blocks
 * @private
 * @returns {Promise} resolves when batch is completed
 */
function processBlocks() {
    // Check start and end block for this batch
    if (_blockCursor > _endBlock) return Promise.reject();

    // Get batch exact batch
    const batchStart = _blockCursor;
    const batchEnd = Math.min(batchStart + _blockBatchSize - 1, _endBlock); 
    const batchSize = (batchEnd - batchStart + 1);

    // Create and execute batch
    let blockBatch = [];
    for (let b = batchStart; b <= batchEnd; b++) {
        blockBatch.push(processBlock(b));
    }
    return Promise.all(blockBatch)
    .then(() => {
        if (batchSize === 1) {
            log.debug(MODULELOG, `Iteration ${_iterationCount}: Processed ${batchSize} block: ${batchEnd}`);
        } else {
            log.debug(MODULELOG, `Iteration ${_iterationCount}: Processed ${batchSize} blocks: ${batchStart} through ${batchEnd}`);
        }
        // Update state
        _fnlState.status.currentBlock = _blockCursor;
        _blockCursor = batchEnd + 1;
        return Promise.resolve(true); // Process next batch immediately
    })
    .catch(err => {
        if (_blockMaxRetries > 0 && _batchRetryCount > _blockMaxRetries) {
            log.warn(MODULELOG, `Iteration ${_iterationCount}: Skipping blocks ${batchStart} through ${batchEnd} after ${_blockMaxRetries} retries`);
            _batchRetryCount = 0;
            _blockCursor = batchEnd + 1;
            return Promise.resolve(true); // Process next batch immediately
        }
        _batchRetryCount += 1;
        return Promise.reject(new Error(`Error processing blocks ${batchStart} through ${batchEnd}: ${err.message}`));
    });
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
            transactionBatch.push(extractTransaction(ex, [], index, blockNumber, blockTime));
        }
    });
    if (transactionBatch.length < 1) return Promise.resolve([]);
    return Promise.all(transactionBatch);
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
            // exEvents = Array
            //    .from(new Set([...events].map(JSON.stringify)))
            //    .map(JSON.parse)
            //    .filter(event => event.phase.applyExtrinsic === index)
            //    .map(event => {return event.event});
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
