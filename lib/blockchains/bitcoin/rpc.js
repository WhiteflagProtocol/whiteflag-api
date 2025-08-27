'use strict';
/**
 * @module lib/blockchains/bitcoin/rpc
 * @summary Whiteflag API Bitcoin RPC module
 * @description Module to connect to the Bitcoin network through a Bitcoin node
 */
module.exports = {
    init: initRpc,
    getConnectionCount,
    getBlockChainInfo,
    getBlockCount,
    getBlockHash,
    getBlockByNumber,
    getBlockByHash,
    getFeeRate,
    getRawTransaction,
    sendRawTransaction
};

// Whiteflag common functions and classes //
const log = require('../../common/logger');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Whiteflag common blockchain functions //
const { rpcCall, getFullURL, getCleanURL } = require('../common/rpc');

// Module constants //
const STATUSINTERVAL = 1200000; // Every two minutes
const INFOINTERVAL = 3600000; // Every hour

// Module variables //
let _blockchainName;
let _btcState;
let _chain;
let _rpcTimeout = 10000;
let _rpcAuthURL;
let _rpcUser;
let _rpcPass;

/**
 * Intitialises Bitcoin RPC connection
 * @function initRpc
 * @alias module:lib/blockchains/bitcoin/rpc.init
 * @param {Object} btcConfig the Bitcoin blockchain configuration
 * @param {Object} btcState the Bitcoin blockchain state
 */
function initRpc(btcConfig, btcState) {
    _blockchainName = btcConfig.name;
    _btcState = btcState;

    // RPC timeout period
    if (btcConfig.rpcTimeout && btcConfig.rpcTimeout > 500) {
        _rpcTimeout = btcConfig.rpcTimeout;
    }
    log.info(_blockchainName, `Timeout for remote calls to the Bitcoin node: ${_rpcTimeout} ms`);

    // Get Node URL and credentials
    _btcState.parameters.rpcURL = getFullURL(btcConfig, true);   // no credentials
    _rpcAuthURL = getFullURL(btcConfig, false);                  // include credentials
    _rpcUser = btcConfig.rpcUsername;
    _rpcPass = btcConfig.rpcPassword;
    log.trace(_blockchainName, `Initialising Bitcoin RPC connection with: ${_btcState.parameters.rpcURL}`);

    // Connect to Bitcoin node
    return new Promise((resolve, reject) => {
        // Check Bitcoin chain
        getBlockChainInfo()
        .then(btcInfo => {
            // Check for correct chain configuration
            const chain = btcInfo.chain;
            if (btcConfig.testnet && chain !== 'test') {
                return reject(new Error(`Configured to use the Bitcoin test network but the node is on the ${chain} chain`));
            }
            if (!btcConfig.testnet && chain === 'test') {
                return reject(new Error(`Configured to use the Bitcoin main network but the node is on the ${chain} chain`));
            }
            // We have a connection
            _chain = chain;
            _btcState.parameters.chain = chain;
            log.info(_blockchainName, `Connected to Bitcoin ${chain} chain through node: ${_btcState.parameters.rpcURL}`);

            // Initialise node status monitoring
            updateNodeInfo(); setInterval(updateNodeInfo, INFOINTERVAL);
            updateNodeStatus(); setInterval(updateNodeStatus, STATUSINTERVAL);

            // Succesfully completed initialisation
            return resolve();
        })
        .catch(err => reject(new Error(`Could not connect to Bitcoin node: ${err.message}`), _blockchainName));
    });
}

// RPC CALL WRAPPER FUNCTIONS //
/**
 * Get number of connections of the node to other nodes
 * @returns {Promise} resolves to connection count
 */
 function getConnectionCount() {
    return rpc('getconnectioncount');
}

/**
 * Gets various information from the node regarding blockchain processing
 * @returns {Promise} resolves to object with blockchain info
 */
 function getBlockChainInfo() {
    return rpc('getblockchaininfo');
}

/**
 * Gets the current block count of the longest chains
 * @returns {Object} resolves to block count
 */
 function getBlockCount() {
    return rpc('getblockcount');
}

/**
 * Gets the hash of the block specified by its block number
 * @param {Object} blockNumber
 * @returns {Promise} resolves to block hash
 */
 function getBlockHash(blockNumber) {
    return rpc('getblockhash', [blockNumber]);
}

/**
 * Gets a block by its number including transaction data
 * @param {Object} blockNumber
 * @returns {Promise} resolves to block including transactions
 */
function getBlockByNumber(blockNumber, full = false) {
    return getBlockHash(blockNumber)
    .then(blockHash => {
        return getBlockByHash(blockHash, full);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Gets a block by its hash
 * @param {string} blockHash
 * @param {boolean} transactions get the full block including all transactions
 * @returns {Promise} resolves to a JSON representation of the block
 */
function getBlockByHash(blockHash, transactions = false) {
    let verbosity = 1;
    if (transactions) verbosity = 2;
    return rpc('getblock', [blockHash, verbosity]);
}

/**
 * Gets an estimate of the fee rate in BTC/kB
 * @param {number} blocks the number of blocks
 * @returns {Promise} resolves to a JSON representation of the block
 */
function getFeeRate(blocks) {
    return rpc('estimatesmartfee', [blocks]);
}


/**
 * Gets raw transaction data
 * @param {string} transactionHash the transaction hash, aka txid
 * @returns {Object} resolves to raw transaction data
 */
 function getRawTransaction(transactionHash) {
    return rpc('getrawtransaction', [transactionHash, true]);
}

/**
 * Send a raw signed transaction
 * @param {Object} rawTransaction raw transaction
 * @returns {Promise} resolves to the transaction hash, aka txid
 */
function sendRawTransaction(rawTransaction) {
    return rpc('sendrawtransaction', [rawTransaction]);
}

// PRIVATE NODE STATUS FUNCTIONS //
/**
 * Requests some Bitcoin node information
 * @private
 */
async function updateNodeInfo() {
    // Get basic blockchain info
    await getBlockChainInfo()
    .then(btcInfo => {
        if (btcInfo.chain !== _chain) {
            log.warn(_blockchainName, `The node's chain has changed to ${btcInfo.chain} and does not correspond with the configured chain ${_chain}`);
        }
        _btcState.parameters.chain = btcInfo.chain;
    })
    .catch(err => log.warn(_blockchainName, `Could not get network: ${err.message}`));
}

/**
 * Requests some Bitcoin blockchain status information
 * @private
 */
async function updateNodeStatus() {
    _btcState.status.updated = new Date().toISOString();

    // Get number of peers
    await getConnectionCount()
    .then(peers => (_btcState.status.peers = peers))
    .catch(err => log.warn(_blockchainName, `Could not get peer connection count: ${err.message}`));

    // Get fee rate
    await getFeeRate(1)
    .then(estimate => (_btcState.status.feerate = estimate.feerate))
    .catch(err => log.warn(_blockchainName, `Could not get transaction fee rate estimate: ${err.message}`));

    // Save and log node status
    saveNodeStatus();
}

/**
 * Logs the Bitcoin node status information
 * @private
 */
function saveNodeStatus() {
    wfState.updateBlockchainData(_blockchainName, _btcState);
    log.info(_blockchainName, `Status: {${JSON.stringify(_btcState.parameters)}, ${JSON.stringify(_btcState.status)}}`);
}

// PRIVATE RPC FUNCTIONS //
/**
 * Calls the common RPC function
 * @function rpc
 * @private
 * @param {string} method the rpc method
 * @param {array} params the parameters for the rpc method
 * @returns {Promise}
 */
function rpc(method, params = []) {
    return rpcCall(method, params, _rpcAuthURL, _rpcUser, _rpcPass, _rpcTimeout);
}
