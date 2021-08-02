'use strict';
/**
 * @module lib/blockchains/bitcoin/common
 * @summary Whiteflag API Bitcoin common module
 * @description Module defining common Bitcoin functions and data
 */
module.exports = {
    UTXOSTATUS
};

// Module constants //
const UTXOSTATUS = {
    SPENT: 'SPENT',
    NEEDSVERIFICATION: 'NEEDSVERIFICATION',
    UNSPENT: 'UNSPENT',
    SPENTVERIFIED: 'SPENTVERIFIED'
};
