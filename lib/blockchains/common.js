'use strict';
/**
 * @module lib/blockchains/common
 * @summary Whiteflag API common blockchains module
 * @description Module for common blockchain functions
 */
module.exports = {
    getEmptyState,
    determineStartingBlock
};

/**
 * Returns an empty blockchain state
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
 */
function determineStartingBlock(highestBlock = 0, currentBlock = 0, startingBlock = 0, rewindBlocks = 0) {
    return new Promise((resolve, reject) => {
        if (startingBlock > 0) {
            return resolve((startingBlock - 1));
        }
        if ((highestBlock - rewindBlocks) > (currentBlock + 1)) {
            return resolve(highestBlock - rewindBlocks - 1);
        }
        if (currentBlock > 0) {
            return resolve(currentBlock);
        }
        if (highestBlock > 0) {
            return resolve(highestBlock - 1);
        }
        reject(new Error(`Cannot determine starting block (Current block: ${currentBlock}, Highest known block: ${highestBlock})`));
    });
}
