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

// Common internal functions and classes //
const log = require('../../_common/logger');
const { ProcessingError } = require('../../_common/errors');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Common blockchain functions //
const { rpcCall, getFullURL } = require('../_common/rpc');

// Module constants //
const MODULELOG = 'bitcoin';
const DEFAULTPORT = '8332';
const STATUSINTERVAL = 1200000; // Every two minutes
const INFOINTERVAL = 3600000; // Every hour

// Module variables //
let _btcChain;
let _btcState;
let _btcChainID;
let _rpcInit = false;
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
    _btcChain = btcConfig.name;
    _btcState = btcState;

    // RPC timeout period
    if (btcConfig.rpcTimeout && btcConfig.rpcTimeout > 500) {
        _rpcTimeout = btcConfig.rpcTimeout;
    }
    log.info(MODULELOG, `Timeout for remote calls to the ${_btcChain} node: ${_rpcTimeout} ms`);

    // Get Node URL and credentials
    const rpcCleanURL = getFullURL(btcConfig, true, DEFAULTPORT);   // no credentials
    _rpcAuthURL = getFullURL(btcConfig, false), DEFAULTPORT;        // include credentials
    _btcState.parameters.rpcURL = rpcCleanURL;
    _rpcUser = btcConfig.rpcUsername;
    _rpcPass = btcConfig.rpcPassword;

    // Connect to Bitcoin node
    log.trace(MODULELOG, `Setting up connection with ${_btcChain} node: ${rpcCleanURL}`);
    _rpcInit = true;
    return new Promise((resolve, reject) => {
        getBlockChainInfo()
        .then(btcInfo => {
            // Check for correct chain configuration
            const chain = btcInfo.chain;
            if (btcConfig.testnet && chain !== 'test') {
                return reject(new Error(`Configured to use the ${_btcChain} (test) network but the node is on the ${chain} chain`));
            }
            if (!btcConfig.testnet && chain === 'test') {
                return reject(new Error(`Configured to use the ${_btcChain} (main) network but the node is on the ${chain} chain`));
            }
            // We have a connection
            _btcChainID = chain;
            _btcState.parameters.chain = chain;
            log.info(MODULELOG, `Connected to ${_btcChain} ${chain} chain through node: ${_btcState.parameters.rpcURL}`);

            // Initialise node status monitoring
            updateNodeInfo(); setInterval(updateNodeInfo, INFOINTERVAL);
            updateNodeStatus(); setInterval(updateNodeStatus, STATUSINTERVAL);

            // Succesfully completed initialisation
            return resolve();
        })
        .catch(err => {
            _rpcInit = false;
            reject(new Error(`Could not connect to ${_btcChain} node: ${err.message}`), _btcChain)
        });
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
        if (btcInfo.chain !== _btcChainID) {
            log.warn(MODULELOG, `The ${_btcChain} node changed from the ${_btcChainID} chain to the ${btcInfo.chain} chain`);
        }
        _btcState.parameters.chain = btcInfo.chain;
    })
    .catch(err => log.warn(MODULELOG, `Could not get network: ${err.message}`));
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
    .catch(err => log.warn(MODULELOG, `Could not get peer connection count: ${err.message}`));

    // Get fee rate
    await getFeeRate(1)
    .then(estimate => (_btcState.status.feerate = estimate.feerate))
    .catch(err => log.warn(MODULELOG, `Could not get transaction fee rate estimate: ${err.message}`));

    // Save and log node status
    saveNodeStatus();
}

/**
 * Logs the Bitcoin node status information
 * @private
 */
function saveNodeStatus() {
    wfState.updateBlockchainData(_btcChain, _btcState);
    log.info(MODULELOG, `Status: {${JSON.stringify(_btcState.parameters)}, ${JSON.stringify(_btcState.status)}}`);
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
    if (!_rpcInit) return Promise.reject(notInitialized());
    return rpcCall(method, params, _rpcAuthURL, _rpcUser, _rpcPass, _rpcTimeout);
}

/**
 * Returns an error that the connextion has not been initializes
 * @private
 * @returns {ProtocolError}
 */
function notInitialized() {
    return new ProcessingError('No connection to a Bitcoin node has been initialized', null, 'WF_API_NOT_AVAILABLE');
}
