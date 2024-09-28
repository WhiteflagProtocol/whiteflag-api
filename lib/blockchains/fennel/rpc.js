'use strict';
/**
 * @module lib/blockchains/fennel/rpc
 * @summary Whiteflag API Fennel / Substrate RPC module
 * @description Module to connect to the Fennel network through a Fennel parachain node
 */
module.exports = {
    init: initRpc,
    getSystemName,
    getSystemVersion,
    getNodeRoles,
    getChainType,
    getRuntimeVersion,
    getSystemHealth,
    getPeerCount,
    getSyncState,
    isSyncing,
    getHighestBlock,
    getBlockHash,
    getBlockByNumber,
    getBlockByHash,
    getBlock,
    getBlockHeader,
    getFullBlock
};

// External modules //
const { ApiPromise, WsProvider } = require('@polkadot/api');

// Whiteflag common functions and classes //
const log = require('../../common/logger');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Whiteflag common blockchain functions //
const { rpcCall, getNodeURL } = require('../common/rpc');

// Module constants //
const STATUSINTERVAL = 60000; // Every minute
const INFOINTERVAL = 3600000; // Every hour

// Module variables //
let _blockchainName;
let _fennelState;
let _fennelApi;
let _websocket = false;
let _rpcTimeout = 10000;
let _rpcURL;
let _rpcUser;
let _rpcPass;

/**
 * Initialises Fennel RPC
 * @function initRpc
 * @alias module:lib/blockchains/fennel/rpc.init
 * @param {Object} fennelConfig the Fennel blockchain configuration
 * @param {Object} fennelState the Fennel blockchain state
 * @returns {Promise} resolve if succesfully initialised
 */
function initRpc(fennelConfig, fennelState) {
    _blockchainName = fennelConfig.name;
    _fennelState = fennelState;

    // Get Node URL and credentials
    _rpcURL = getNodeURL(fennelConfig, true); // no credentials
    _fennelState.parameters.rpcURL = _rpcURL;
    _rpcUser = fennelConfig.username;
    _rpcPass = fennelConfig.password;

    // Connect to Fennel node
    return new Promise((resolve, reject) => {
        // Connect using websocket
        if (_rpcURL.substring(0, 2) === 'ws') {
            _websocket = true;
            log.trace(_blockchainName, `Initialising Fennel RPC connection via web socket to: ${_rpcURL}`);
            const wsProvider = new WsProvider(_rpcURL);
            ApiPromise.create({ wsProvider })
            .then(api => {
                _fennelApi = api;
                log.info(_blockchainName, `Connected to ${_fennelApi.runtimeVersion.specName} through node: ${_rpcURL}`);
                return resolve(_fennelApi);
            })
            .catch(err => reject(new Error(`Could not connect to Fennel node: ${err.message}`), _blockchainName));
        }
        // CCnnect via http
        if (_rpcURL.substring(0, 4) === 'http') {
            log.trace(_blockchainName, `Initialising Fennel RPC connection via web to: ${_rpcURL}`);
            getRuntimeVersion()
            .then(fennelRuntime => {
                // We have a connection
                log.info(_blockchainName, `Connected to ${fennelRuntime.specName} through node: ${_rpcURL}`);

                // RPC timeout period
                if (fennelConfig.rpcTimeout && fennelConfig.rpcTimeout > 500) {
                    _rpcTimeout = fennelConfig.rpcTimeout;
                }
                log.info(_blockchainName, `Timeout for remote calls to the Fennel node: ${_rpcTimeout} ms`);

                // Initialise node status monitoring
                updateNodeInfo(); setInterval(updateNodeInfo, INFOINTERVAL);
                updateNodeStatus(); setInterval(updateNodeStatus, STATUSINTERVAL);

                // Succesfully completed initialisation
                return resolve();
            })
            .catch(err => reject(new Error(`Could not connect to Fennel node: ${err.message}`), _blockchainName));
        }
    });
}

// RPC CALL WRAPPER FUNCTIONS //
/**
 * Gets the system name
 * @function getSystemName
 * @alias module:lib/blockchains/fennel/rpc.getSystemName
 * @returns {Promise} resolves to system name
 */
function getSystemName() {
    if (_websocket) return Promise.resolve(_fennelApi.rpc.system.name);
    return rpc('system_name');
}

/**
 * Gets the system version
 * @function getSystemVersion
 * @alias module:lib/blockchains/fennel/rpc.getSystemVersion
 * @returns {Promise} resolves to connection count
 */
function getSystemVersion() {
    if (_websocket) return Promise.resolve(_fennelApi.rpc.system.version);
    return rpc('system_version');
}

/**
 * Gets the node roles
 * @function getNodeRoles
 * @alias module:lib/blockchains/fennel/rpc.getNodeRoles
 * @returns {Promise} resolves to array with node roles
 */
function getNodeRoles() {
    if (_websocket) return Promise.resolve(_fennelApi.rpc.system.nodeRoles);
    return rpc('system_nodeRoles');
}

/**
* Gets the chain type
* @function getChainType
* @alias module:lib/blockchains/fennel/rpc.getChainType
* @returns {Promise} resolves to chain type
*/
function getChainType() {
    if (_websocket) return Promise.resolve(_fennelApi.rpc.system.chainType);
    return rpc('system_chainType');
 }

/**
* Gets the runtime version information
* @function getRuntimeVersion
* @alias module:lib/blockchains/fennel/rpc.getRuntimeVersion
* @returns {Promise} resolves to version ino
*/
function getRuntimeVersion() {
   if (_websocket) return Promise.resolve(_fennelApi.rpc.state.getRuntimeVersion);
   return rpc('state_getRuntimeVersion');
}

/**
 * Gets the node health
 * @function getSystemHealth
 * @alias module:lib/blockchains/fennel/rpc.getPeerCount
 * @returns {Promise} resolves to the node's system health
 */
function getSystemHealth() {
    if (_websocket) return Promise.resolve(_fennelApi.rpc.system.health);
    return rpc('system_health');
}

/**
 * Gets the number of peers
 * @function getPeerCount
 * @alias module:lib/blockchains/fennel/rpc.getPeerCount
 * @returns {Promise} resolves to the number of peers
 */
function getPeerCount() {
    getSystemHealth()
    .then(result => {
        return Promise.resolve(result.peers);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Checks if the node is syncing
 * @function isSyncing
 * @alias module:lib/blockchains/fennel/rpc.isSyncing
 * @returns {Promise} resolves to syncing infomration
 */
function isSyncing() {
    getSystemHealth()
    .then(result => {
        return Promise.resolve(result.isSyncing);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Gets the system synchronisation state
 * @function getSyncState
 * @alias module:lib/blockchains/fennel/rpc.getSyncState
 * @returns {Promise} resolves to connection count
 */
function getSyncState() {
    if (_websocket) return Promise.resolve(_fennelApi.rpc.system.syncState);
    return rpc('system_syncState');
}

/**
 * Gets the highest block, i.e. the current block count of the longest chains
 * @function getHighestBlock
 * @alias module:lib/blockchains/fennel/rpc.getHighestBlock
 * @returns {Promise} resolves to highest known block number
 */
function getHighestBlock() {
    getSyncState()
    .then(result => {
        return Promise.resolve(result.highestBlock);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Gets the hash of the block specified by its block number
 * @function getBlockHash
 * @alias module:lib/blockchains/fennel/rpc.getBlockHash
 * @param {Object} blockNumber
 * @returns {Promise} resolves to block hash
 */
function getBlockHash(blockNumber) {
    if (_websocket) return Promise.resolve(_fennelApi.rpc.chain.getBlockHash(blockNumber));
    return rpc('chain_getBlockHash', [ blockNumber ]);
}

/**
 * Gets a block by its number including transaction data
 * @function getBlockByNumber
 * @alias module:lib/blockchains/fennel/rpc.getBlockByNumber
 * @param {Object} blockNumber
 * @param {boolean} transactions get the block including all transactions
 * @returns {Promise} resolves to block including transactions
 */
function getBlockByNumber(blockNumber, transactions = false) {
    getBlockHash(blockNumber)
    .then(blockHash => {
        return getBlockByHash(blockHash, transactions);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Gets a block by its hash
 * @function getBlockByHash
 * @alias module:lib/blockchains/fennel/rpc.getBlockByHash
 * @param {string} blockHash
 * @param {boolean} transactions get the block including all transactions
 * @returns {Promise} resolves to a JSON representation of the block
 */
function getBlockByHash(blockHash, transactions = false) {
    if (transactions) return getBlock(blockHash);
    return getBlockHeader(blockHash);
}

/**
 * Gets a block by its hash
 * @function getBlock
 * @alias module:lib/blockchains/fennel/rpc.getBlock
 * @param {string} blockHash
 * @returns {Promise} resolves to a JOSN representation of the block
 */
function getBlock(blockHash) {
    getFullBlock(blockHash)
    .then(result => {
        return Promise.resolve(result.block);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Gets a block header by its hash
 * @function getBlockHeader
 * @alias module:lib/blockchains/fennel/rpc.getBlockHeader
 * @param {string} blockHash
 * @returns {Promise} resolves to a JOSN representation of the block header
 */
function getBlockHeader(blockHash) {
    if (_websocket) return Promise.resolve(_fennelApi.rpc.chain.getHeader(blockHash));
    return rpc('chain_getHeader', [ blockHash ]);
}

/**
 * Gets a full block by its hash
 * @function getFullBlock
 * @alias module:lib/blockchains/fennel/rpc.getFullBlock
 * @param {string} blockHash
 * @returns {Promise} resolves to a JOSN representation of the block
 */
function getFullBlock(blockHash) {
    if (_websocket) return Promise.resolve(_fennelApi.rpc.chain.getBlock(blockHash));
    return rpc('chain_getBlock', [ blockHash ]);
}

// PRIVATE BLOCKCHAIN STATUS FUNCTIONS //
/**
 * Requests some semi-static Fennel parachain information
 * @private
 */
async function updateNodeInfo() {
    // Get system name
    await getSystemName()
    .then(systemName => (_fennelState.parameters.systemName = systemName))
    .catch(err => log.warn(_blockchainName, `Could not get system name from node: ${err.message}`));

    // Get system version info
    await getSystemVersion()
    .then(systemVersion => (_fennelState.parameters.systemVersion = systemVersion))
    .catch(err => log.warn(_blockchainName, `Could not get system version from node: ${err.message}`));

    // Get chain runtime info
    await getRuntimeVersion()
    .then(fennelRuntime => (_fennelState.parameters.specName = fennelRuntime.specName))
    .catch(err => log.warn(_blockchainName, `Could not get chain runtime information from node: ${err.message}`));

    // Get node roles
    await getChainType()
    .then(chainType => (_fennelState.parameters.chainType = chainType))
    .catch(err => log.warn(_blockchainName, `Could not get chain type from node: ${err.message}`));

    // Get node roles
    await getNodeRoles()
    .then(nodeRoles => (_fennelState.parameters.nodeRoles = nodeRoles))
    .catch(err => log.warn(_blockchainName, `Could not get roles from node: ${err.message}`));
}

/**
 * Requests some dynamic Fennel parachain node status information
 * @private
 */
async function updateNodeStatus() {
    _fennelState.status.updated = new Date().toISOString();

    // Get peer status
    await getPeerCount()
    .then(peers => (_fennelState.status.peers = peers))
    .catch(err => log.warn(_blockchainName, `Could not get peer status: ${err.message}`));

    // Get synchronisation status
    await isSyncing()
    .then(syncing => (_fennelState.status.syncing = syncing))
    .catch(err => log.warn(_blockchainName, `Could not get synchronisation status: ${err.message}`));

    // Get synchronisation status
    await getSyncState()
    .then(syncState => {
        _fennelState.status.startingBlock = syncState.startingBlock;
        _fennelState.status.currentBlock = syncState.currentBlock;
        _fennelState.status.highestBlock = syncState.highestBlock;
    })
    .catch(err => log.warn(_blockchainName, `Could not get synchronisation status: ${err.message}`));

    // Log node status
    saveNodeStatus();
}

/**
 * Logs the Fennel node status information
 * @private
 */
function saveNodeStatus() {
    wfState.updateBlockchainData(_blockchainName, _fennelState);
    log.info(_blockchainName, `Status: {${JSON.stringify(_fennelState.parameters)}, ${JSON.stringify(_fennelState.status)}}`);
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
    return rpcCall(method, params, _rpcURL, _rpcUser, _rpcPass, _rpcTimeout);
}
