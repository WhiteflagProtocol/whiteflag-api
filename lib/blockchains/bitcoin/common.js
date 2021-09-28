'use strict';
/**
 * @module lib/blockchains/bitcoin/common
 * @summary Whiteflag API Bitcoin common module
 * @description Module defining common Bitcoin functions and data
 */
 module.exports = {
    getUxtoStatuses
};

// Module constants //
const UTXOSTATUS = {
    SPENT: 'SPENT',
    NEEDSVERIFICATION: 'NEEDSVERIFICATION',
    UNSPENT: 'UNSPENT',
    SPENTVERIFIED: 'SPENTVERIFIED'
};

/**
 * Returns UXTO status values
 * @function getUxtoStatuses
 * @returns {Object} UXTO status values
 */
function getUxtoStatuses() {
    return UTXOSTATUS;
}
