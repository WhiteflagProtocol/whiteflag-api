'use strict';
/**
 * @module lib/blockchains/common
 * @summary Whiteflag API common blockchains module
 * @description Module for common blockchain functions
 */
module.exports = {
    getEmptyState,
    determineStartingBlock,
    logStartingBlock
};

// Whiteflag common functions and classes //
const log = require('../common/logger');

/**
 * Returns an empty blockchain state
 * @function getEmptyState
 * @returns {Object} An empty blockchain state
 */
function getEmptyState() {
    return {
        parameters: {},
        status: {},
        accounts: []
    };
}

/**
 * Determines the starting block for a blockchain listener
 * @function determineStartingBlock
 * @alias module:lib/blockchains/common.determineStartingBlock
 * @param {number} highestBlock the highest known block of the blockchain
 * @param {number} currentBlock the block currently being the latest processed
 * @param {number} startingBlock the block  where the listener should start
 * @param {number} rewindBlocks the number of blocks to look back from highest block
 * @returns {number} the starting block
 */
function determineStartingBlock(highestBlock = 0, currentBlock = 0, startingBlock = 0, rewindBlocks = 0) {
    if (startingBlock > 0) return (startingBlock - 1);
    if ((highestBlock - rewindBlocks) > (currentBlock + 1)) {
        return (highestBlock - rewindBlocks - 1);
    }
    if (currentBlock > 0) return (currentBlock);
    if (highestBlock > 0) return (highestBlock - 1);
    return 1;
}

/**
 * Logs where the listener will start next
 * @function logStartingBlock
 * @alias module:lib/blockchains/common.logStartingBlock
 * @param {number} blockCursor block pointer
 * @param {number} highestBlock the highest known block
 */
 function logStartingBlock(blockchainName, blockCursor, highestBlock) {
    let nextBlock = blockCursor + 1;
    let arrearBlocks = highestBlock - nextBlock;
    if (arrearBlocks < 0) {
        log.info(blockchainName, `Resuming with next block: ${nextBlock} (when node catches up from its current highest block ${highestBlock})`);
    } else {
        log.info(blockchainName, `Resuming with next block: ${nextBlock} (${arrearBlocks} blocks behind the highest known block ${highestBlock})`);
    }
}
