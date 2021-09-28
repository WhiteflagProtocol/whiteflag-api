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
const STATUSINTERVAL = 1200000; // Every two minutes
const INFOINTERVAL = 3600000; // Every hour

// Module variables //
let _blockchainName;
let _bcState;
let _chain;
let _rpcURL;
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
    _rpcURL = getNodeURL(bcConfig);
    _bcState.parameters.rpcURL = _rpcURL;
    _rpcUser = bcConfig.username;
    _rpcPass = bcConfig.password;

    // Connect to Bitcoin node
    return new Promise((resolve, reject) => {
        // Check Bitcoin chain
        getBlockChainInfo()
        .then(bcInfo => {
            // Check for correct chain configuration
            const chain = bcInfo.chain;
            if (bcConfig.testnet && chain !== 'test') {
                return reject(new Error(`Configured to use the Bitcoin test network but the node is on the ${chain} chain`));
            }
            if (!bcConfig.testnet && chain === 'test') {
                return reject(new Error(`Configured to use the Bitcoin main network but the node is on the ${chain} chain`));
            }
            // We have a connection
            _chain = chain;
            _bcState.parameters.chain = chain;
            log.info(_blockchainName, `Connected to Bitcoin ${chain} chain through node: ${_rpcURL}`);

            // RPC timeout period
            if (bcConfig.rpcTimeout && bcConfig.rpcTimeout > 500) {
                _rpcTimeout = bcConfig.rpcTimeout;
            }
            log.info(_blockchainName, `Timeout for remote calls to the Bitcoin node: ${_rpcTimeout} ms`);

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
async function updateNodeInfo() {
    // Get basic blockchain info
    await getBlockChainInfo()
    .then(bcInfo => {
        if (bcInfo.chain !== _chain) {
            log.warn(_blockchainName, `The node's chain has changed to ${bcInfo.chain} and does not correspond with the configured chain ${_chain}`);
        }
        _bcState.parameters.chain = bcInfo.chain;
    })
    .catch(err => log.warn(_blockchainName, `Could not get network: ${err.message}`));
}

/**
 * Requests some Bitcoin blockchain status information
 * @private
 */
async function updateNodeStatus() {
    _bcState.status.updated = new Date().toISOString();

    // Get number of peers
    await getConnectionCount()
    .then(peers => (_bcState.status.peers = peers))
    .catch(err => log.warn(_blockchainName, `Could not get peer connection count: ${err.message}`));

    // Save and log node status
    saveNodeStatus();
}

/**
 * Logs the Bitcoin node status information
 * @private
 */
function saveNodeStatus() {
    wfState.updateBlockchainData(_blockchainName, _bcState);
    log.info(_blockchainName, `Node status: {${JSON.stringify(_bcState.parameters)}, ${JSON.stringify(_bcState.status)}}`);
}

// PRIVATE RPC FUNCTIONS //
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
        url: _rpcURL,
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
    // log.trace(_blockchainName, `Making remote procedure call: ${JSON.stringify(rpcOptions.body)}`);
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

/**
 * Gets URL of the Bitcoin blockchain node from the configuration
 * @private
 * @param {Object} bcConfig blockchain configuration parameters
 * @returns {string} the url of the Bitcoin node
 */
 function getNodeURL(bcConfig) {
    const rpcProtocol = (bcConfig.rpcProtocol || 'http') + '://';
    const rpcHost = bcConfig.rpcHost || 'localhost';
    const rpcPort = ':' + (bcConfig.rpcPort || '8545');
    const rpcPath = bcConfig.rpcPath || '';
    return (rpcProtocol + rpcHost + rpcPort + rpcPath);
}
