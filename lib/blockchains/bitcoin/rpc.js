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
let _rpcCredentials = {};
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
    _rpcCredentials = {
        host: bcConfig.rpcHost,
        port: bcConfig.rpcPort,
        user: bcConfig.username,
        password: bcConfig.password
    };
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
    log.trace(_blockchainName, 'Node RPC connection initialized.');
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
function getBlockByNumber(blockNumber) {
    return getBlockHash(blockNumber)
    .then(function getBlockHashResolve(blockHash) {
        return getBlockByHash(blockHash);
    }, function getBlockHashReject(err) {
        log.warn(_blockchainName, `RPC request returned error: ${err.message}`);
        return Promise.reject(err);
    });
}

/**
 * Get block by its hash inlcuding transactions
 * @param {Object} blockHash
 * @returns {Promise} resolves to block inlcuding transactions
 */
function getBlockByHash(blockHash) {
    return rpcCall('getblock', [blockHash, 2]);
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
    log.trace(_blockchainName, 'Retrieving node info');

    // Get basic blockchain info
    getBlockChainInfo().then(result => {
        _bcState.parameters.chain = result.chain;
    }).catch(err => {
        log.warn(_blockchainName, `Could not get network: ${err.message}`);
    });
}

/**
 * Requests some Bitcoin blockchain status information
 * @private
 */
function updateNodeStatus() {
    log.trace(_blockchainName, 'Updating node status');
    _bcState.status.updated = new Date().toISOString();

    // Get number of peers
    getConnectionCount().then(result => {
        _bcState.status.peers = result;
    }).catch(err => {
        log.warn(_blockchainName, `Could not retrieve number of peers: ${err.message}`);
    });

    // Save node status to state
    wfState.updateBlockchainData(_blockchainName, _bcState);
    log.debug(_blockchainName, `Node status: { ${JSON.stringify(_bcState.parameters)}, ${JSON.stringify(_bcState.status)} }`);
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
    log.trace(_blockchainName, `RPC Method: ${method} Params: ${params}`);

    // Prepare request
    let rpcOptions = {
        url: 'http://' + _rpcCredentials.host + ':' + _rpcCredentials.port,
        auth: {
            user: _rpcCredentials.user,
            password: _rpcCredentials.password
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
    return timeoutPromise(
        new Promise((resolve, reject) => {
            request(rpcOptions, function rpcRequestCb(err, response, body) {
                if (err) return reject(err);
                ignore(response);
                try {
                    if (JSON.parse(body).error !== null) {
                        reject(new Error(JSON.stringify(JSON.parse(body).error)));
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
