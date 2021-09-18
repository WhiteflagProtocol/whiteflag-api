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
    getRawTransaction,
    sendSignedTransaction
};

// Node.js core and external modules //
const request = require('request');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { timeoutPromise, ignore } = require('../../common/processing');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Module constants //
const STATUSINTERVAL = 60000;
const INFOINTERVAL = 3600000;

// Module variables //
let _blockchainName;
let _bcState;
let _rpcProtocol;
let _rpcHost;
let _rpcPort;
let _rpcUser;
let _rpcPass;
let _rpcTimeout = 2000;

/**
 * Intitialises Bitcoin RPC connection
 * @function initRpc
 * @alias module:lib/blockchains/bitcoin/rpc.init
 * @param {Object} bcConfig the Bitcoin blockchain configuration
 * @param {Object} bcState the Bitcoin blockchain state
 */
function initRpc(bcConfig, bcState) {
    _blockchainName = bcConfig.name;
    _bcState = bcState;
    log.trace(_blockchainName, 'Initialising Bitcoin RPC connection...');

    // Get Node URL and credentials
    _rpcProtocol = bcConfig.rpcProtocol;
    _rpcHost = bcConfig.rpcHost;
    _rpcPort = bcConfig.rpcPort;
    _rpcUser = bcConfig.username;
    _rpcPass = bcConfig.password;

    // Connect to node
    return new Promise((resolve, reject) => {

        // TODO: Make initial connection

        // RPC timeout period
        if (bcConfig.rpcTimeout && bcConfig.rpcTimeout > 500) {
            _rpcTimeout = bcConfig.rpcTimeout;
        }
        log.info(_blockchainName, `Timeout of RPC calls to Bitcoin node is set to ${_rpcTimeout} ms`);

        // Initialise node status monitoring
        updateNodeInfo();
        setInterval(updateNodeInfo, INFOINTERVAL);
        updateNodeStatus();
        setInterval(updateNodeStatus, STATUSINTERVAL);

        // All done
        resolve();
        ignore(reject);
    });
}

// RPC CALL WRAPPER FUNCTIONS //
/**
 * Get number of connections of the node to other nodes
 * @returns {Promise} resolves to connection count
 */
 function getConnectionCount() {
    return rpcCall('getconnectioncount');
}

/**
 * Gets various information from the node regarding blockchain processing
 * @returns {Promise} resolves to object with blockchain info
 */
 function getBlockChainInfo() {
    return rpcCall('getblockchaininfo');
}

/**
 * Gets the current block count of the longest chains
 * @returns {Object} resolves to block count
 */
 function getBlockCount() {
    return rpcCall('getblockcount');
}

/**
 * Gets the hash of the block specified by its block number
 * @param {Object} blockNumber
 * @returns {Promise} resolves to block hash
 */
 function getBlockHash(blockNumber) {
    return rpcCall('getblockhash', [blockNumber]);
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
        log.warn(_blockchainName, `RPC request returned error: ${err.message}`);
        return Promise.reject(err);
    });
}

/**
 * Gets a block by its hash
 * @param {Object} blockHash
 * @param {Boolean} full get the full block including all transactions
 * @returns {Promise} resolves to a JOSN representation of the block
 */
function getBlockByHash(blockHash, full = false) {
    let verbosity = 1;
    if (full) verbosity = 2;
    return rpcCall('getblock', [blockHash, verbosity]);
}


/**
 * Gets raw transaction data
 * @param {string} transactionHash the transaction hash, aka txid
 * @returns {Object} resolves to raw transaction data
 */
 function getRawTransaction(transactionHash) {
    return rpcCall('getrawtransaction', [transactionHash, true]);
}

/**
 * Send a raw signed transaction
 * @param {Object} rawTransaction raw transaction
 * @returns {Promise} resolves to the transaction hash, aka txid
 */
function sendSignedTransaction(rawTransaction) {
    return rpcCall('sendrawtransaction', rawTransaction);
}

// PRIVATE NODE STATUS FUNCTIONS //
/**
 * Requests some Bitcoin node information
 * @private
 */
 function updateNodeInfo() {
    // Get basic blockchain info
    getBlockChainInfo()
    .then(result => (_bcState.parameters.chain = result.chain))
    .catch(err => log.warn(_blockchainName, `Could not get network: ${err.message}`));

    // Log node information
    setTimeout(function ethNodeInfo() {
        log.info(_blockchainName, `Node status: {${JSON.stringify(_bcState.parameters)}, ${JSON.stringify(_bcState.status)}}`);
    }, _rpcTimeout);
}

/**
 * Requests some Bitcoin blockchain status information
 * @private
 */
function updateNodeStatus() {
    _bcState.status.updated = new Date().toISOString();

    // Get number of peers
    getConnectionCount()
    .then(status => (_bcState.status.peers = status))
    .catch(err => log.warn(_blockchainName, `Could not get peer status: ${err.message}`));

    // Save node status to state
    wfState.updateBlockchainData(_blockchainName, _bcState);
}

// PRIVATE GENERIC RPC CALL FUNCTIONS //
/**
 * Makes a connection with a node
 * @function rpcCall
 * @private
 * @param {string} method the rpc method
 * @param {string} params the parameters for the rpc method
 * @returns {Promise}
 */
function rpcCall(method, params) {
    // Prepare request
    let rpcOptions = {
        url: _rpcProtocol + '://' + _rpcHost + ':' + _rpcPort,
        auth: {
            user: _rpcUser,
            password: _rpcPass
        },
        method: 'post',
        headers:
        {
            'content-type': 'text/plain'
        },
        body: JSON.stringify({
            'jsonrpc': '2.0',
            'method': method,
            'params': params
        })
    };
    // Send request with a timeout
    log.trace(_blockchainName, `Making remote procedure call: ${JSON.stringify(rpcOptions.body)}`);
    return timeoutPromise(
        new Promise((resolve, reject) => {
            request(rpcOptions, function rpcRequestCb(err, response, body) {
                if (err) return reject(err);
                ignore(response);
                try {
                    if (JSON.parse(body).error !== null) {
                        return reject(new Error(JSON.stringify(JSON.parse(body).error)));
                    }
                    resolve(JSON.parse(body).result);
                } catch(jsonErr) {
                    reject(jsonErr);
                }
            });
        }),
        _rpcTimeout
    );
}
