'use strict';
/**
 * @module lib/blockchains/_common/state
 * @summary Whiteflag API blockchains common state module
 * @description Module for common blockchain state functions
 */
module.exports = {
    getEmptyState,
    determineStartingBlock,
    logStartingBlock
};

/* Common internal functions and classes */
const log = require('../../_common/logger');

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
 * @param {number} currentBlock the current block that has been processed
 * @param {number} startingBlock the configured block where the listener should start
 * @param {number} rewindBlocks the configured number of blocks to look back from the highest block
 * @returns {number} the starting block
 */
function determineStartingBlock(highestBlock = 0, currentBlock = 0, startingBlock = 0, rewindBlocks = 0) {
    if (startingBlock > 0) return Number(startingBlock);
    if (rewindBlocks > 0) return Math.max((highestBlock - rewindBlocks), currentBlock);
    if (currentBlock > 0) return Number(currentBlock);
    if (highestBlock > 0) return Number(highestBlock - 1);
    return 1;
}

/**
 * Logs where the listener will start next
 * @function logStartingBlock
 * @alias module:lib/blockchains/common.logStartingBlock
 * @param {string} module the name of the blockchain moduel for logging
 * @param {number} startingBlock the current block that has been processed
 * @param {number} highestBlock the highest known block
 */
function logStartingBlock(module, startingBlock, highestBlock) {
    let arrearBlocks = highestBlock - startingBlock;
    if (arrearBlocks < 0) {
        log.info(module, `Resuming with next block: ${startingBlock} (when node catches up from its current highest block ${highestBlock})`);
    } else {
        log.info(module, `Resuming with next block: ${startingBlock} (${arrearBlocks} blocks behind the highest known block ${highestBlock})`);
    }
}
