'use strict';
/**
 * @module lib/blockchains/fennel/rpc
 * @summary Whiteflag API Fennel / Substrate RPC module
 * @description Module to connect to the Fennel network through a Fennel parachain node
 */
module.exports = {
    init: initRpc,
    getBalance,
    getBlock,
    getBlockByNumber,
    getBlockByHash,
    getBlockHash,
    getBlockHeader,
    getChainType,
    getFullBlock,
    getHighestBlock,
    getNodeRoles,
    getPeerCount,
    getRuntimeVersion,
    getSyncState,
    getSystemHealth,
    getSystemName,
    getSystemVersion,
    getTransactionCount,
    isSyncing,
};

// External modules //
const { ApiPromise, WsProvider } = require('@polkadot/api');

// Common internal functions and classes //
const log = require('../../_common/logger');
const { ignore } = require('../../_common/processing')
const { timeoutPromise } = require('../../_common/processing');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Common blockchain functions //
const { rpcCall, getFullURL } = require('../_common/rpc');
const { ProcessingError } = require('../../_common/errors');

// Module constants //
const MODULELOG = 'fennel';
const DEFAULTPORT = '8844';
const STATUSINTERVAL = 60000; // Every minute
const INFOINTERVAL = 3600000; // Every hour

// Module variables //
let _fnlChain = 'fennel';
let _fnlState;
let _fnlApi;
let _websocket = false;
let _rpcTimeout = 10000;
let _rpcAuthURL;
let _rpcUser;
let _rpcPass;

/**
 * Initialises Fennel RPC
 * @function initRpc
 * @alias module:lib/blockchains/fennel/rpc.init
 * @param {Object} fnlConfig the Fennel blockchain configuration
 * @param {Object} fnlState the Fennel blockchain state
 * @returns {Promise} resolve if succesfully initialised
 */
function initRpc(fnlConfig, fnlState) {
    _fnlChain = fnlConfig.name;
    _fnlState = fnlState;

    // RPC timeout period
    if (fnlConfig.rpcTimeout && fnlConfig.rpcTimeout > 500) {
        _rpcTimeout = fnlConfig.rpcTimeout;
    }
    log.info(MODULELOG, `Timeout for remote calls to the ${_fnlChain} node: ${_rpcTimeout} ms`);

    // Get Node URL and credentials
    const rpcCleanURL = getFullURL(fnlConfig, true, DEFAULTPORT);   // no credentials
    _rpcAuthURL = getFullURL(fnlConfig, false, DEFAULTPORT);        // include credentials
    _fnlState.parameters.rpcURL = rpcCleanURL;
    _rpcUser = fnlConfig.rpcUsername;
    _rpcPass = fnlConfig.rpcPassword;

    // Connect to Fennel node
    return new Promise((resolve, reject) => {
        switch (fnlConfig.rpcProtocol) {
            // Connect using websocket
            case 'ws':
            case 'wss': {
                log.trace(MODULELOG, `Setting up web socket connection with ${_fnlChain} node: ${rpcCleanURL}`);
                _websocket = true;

                const wsProvider = new WsProvider(_rpcAuthURL);
                timeoutPromise(ApiPromise.create({ provider: wsProvider }), _rpcTimeout)
                .then(api => {
                    // We have a connection
                    _fnlApi = api;
                    log.info(MODULELOG, `Connected to ${_fnlApi.runtimeVersion.specName} through ${_fnlChain} node: ${rpcCleanURL}`);

                    // Initialise node status monitoring
                    updateNodeInfo(); setInterval(updateNodeInfo, INFOINTERVAL);
                    updateNodeStatus(); setInterval(updateNodeStatus, STATUSINTERVAL);

                    // Succesfully completed initialisation
                    return resolve(_fnlApi);
                })
                .catch(err => {
                    wsProvider.disconnect();
                    return reject(new Error(`Could not make a web socket connection with ${_fnlChain} node: ${err.message}`), _fnlChain);
                });
                break;
            }
            // Connect via http
            case 'http':
            case 'https': {
                log.trace(MODULELOG, `Setting up web connection with ${_fnlChain} node: ${rpcCleanURL}`);
                
                getRuntimeVersion()
                .then(fnlRuntime => {
                    // We have a connection
                    log.info(MODULELOG, `Connected to ${fnlRuntime.specName} through ${_fnlChain} node: ${rpcCleanURL}`);

                    // RPC timeout period
                    if (fnlConfig.rpcTimeout && fnlConfig.rpcTimeout > 500) {
                        _rpcTimeout = fnlConfig.rpcTimeout;
                    }
                    log.info(MODULELOG, `Timeout for remote calls to the ${_fnlChain} node: ${_rpcTimeout} ms`);

                    // Initialise node status monitoring
                    updateNodeInfo(); setInterval(updateNodeInfo, INFOINTERVAL);
                    updateNodeStatus(); setInterval(updateNodeStatus, STATUSINTERVAL);

                    // Succesfully completed initialisation
                    return resolve();
                })
                .catch(err => reject(new Error(`Could not make web connection with ${_fnlChain} node: ${err.message}`), _fnlChain));
                break;
            }
            // Unknown protocol
            default: {
                return reject(new Error(`Unknown protocol to connect with ${_fnlChain} node: ${fnlConfig.rpcProtocol}`), _fnlChain);
            }
        }
    });
}

// RPC CALL WRAPPER FUNCTIONS //
/**
 * Gets the balance of the specified Fennel blockchain account
 * @function getBalance
 * @alias module:lib/blockchains/fennel/rpc.getBalance
 * @param {string} address
 * @returns {Promise}
 */
function getBalance(address) {
    ignore(address);
    return Promise.reject(new ProcessingError('No method implemented to get balance' ,null , 'WF_API_NOT_IMPLEMENTED'));
}

/**
 * Gets a block by its hash
 * @function getBlock
 * @alias module:lib/blockchains/fennel/rpc.getBlock
 * @param {string} blockHash
 * @returns {Promise} resolves to a JOSN representation of the block
 */
function getBlock(blockHash) {
    return getFullBlock(blockHash)
    .then(result => {
        if (result instanceof Map) return Promise.resolve(result.get('block'));
        return Promise.resolve(result.block);
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
    if (_websocket) return _fnlApi.rpc.chain.getBlockHash(blockNumber);
    return rpc('chain_getBlockHash', [ blockNumber ]);
}

/**
 * Gets a block by its hash
 * @function getBlockByHash
 * @alias module:lib/blockchains/fennel/rpc.getBlockByHash
 * @param {string} blockHash
 * @param {boolean} extrinsics get the block including all extrinsics
 * @returns {Promise} resolves to a JSON representation of the block
 */
function getBlockByHash(blockHash, extrinsics = false) {
    if (extrinsics) return getBlock(blockHash);
    return getBlockHeader(blockHash);
}

/**
 * Gets a block by its number including transaction data
 * @function getBlockByNumber
 * @alias module:lib/blockchains/fennel/rpc.getBlockByNumber
 * @param {Object} blockNumber
 * @param {boolean} extrinsics get the block including all extrinsics
 * @returns {Promise} resolves to block including extrinsics
 */
function getBlockByNumber(blockNumber, extrinsics = false) {
    return getBlockHash(blockNumber)
    .then(blockHash => {
        return getBlockByHash(blockHash, extrinsics);
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
    if (_websocket) return _fnlApi.rpc.chain.getHeader(blockHash);
    return rpc('chain_getHeader', [ blockHash ]);
}

/**
* Gets the chain type
* @function getChainType
* @alias module:lib/blockchains/fennel/rpc.getChainType
* @returns {Promise} resolves to chain type
*/
function getChainType() {
    // WORKORUND: websocket does not return does not return correct value
    // if (_websocket) return _fnlApi.rpc.system.chainType();
    return rpc('system_chainType');
}

/**
 * Gets a full block by its hash
 * @function getFullBlock
 * @alias module:lib/blockchains/fennel/rpc.getFullBlock
 * @param {string} blockHash
 * @returns {Promise} resolves to a JOSN representation of the block
 */
function getFullBlock(blockHash) {
    if (_websocket) return _fnlApi.rpc.chain.getBlock(blockHash);
    return rpc('chain_getBlock', [ blockHash ]);
}

/**
 * Gets the highest block, i.e. the current block count of the longest chains
 * @function getHighestBlock
 * @alias module:lib/blockchains/fennel/rpc.getHighestBlock
 * @returns {Promise} resolves to highest known block number
 */
function getHighestBlock() {
    return getSyncState()
    .then(result => {
        if (result instanceof Map) return Promise.resolve(result.get('highestBlock'));
        return Promise.resolve(result.highestBlock);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Gets the node roles
 * @function getNodeRoles
 * @alias module:lib/blockchains/fennel/rpc.getNodeRoles
 * @returns {Promise} resolves to array with node roles
 */
function getNodeRoles() {
    // WORKORUND: websocket does not return does not return correct value
    // if (_websocket) return _fnlApi.rpc.system.nodeRoles();
    return rpc('system_nodeRoles');
}

/**
 * Gets the number of peers
 * @function getPeerCount
 * @alias module:lib/blockchains/fennel/rpc.getPeerCount
 * @returns {Promise} resolves to the number of peers
 */
function getPeerCount() {
    return getSystemHealth()
    .then(result => {
        if (result instanceof Map) return Promise.resolve(result.get('peers'));
        return Promise.resolve(result.peers);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
* Gets the runtime version information
* @function getRuntimeVersion
* @alias module:lib/blockchains/fennel/rpc.getRuntimeVersion
* @returns {Promise} resolves to version info
*/
function getRuntimeVersion() {
    if (_websocket) return _fnlApi.rpc.state.getRuntimeVersion();
    return rpc('state_getRuntimeVersion');
}

/**
 * Gets the system synchronisation state
 * @function getSyncState
 * @alias module:lib/blockchains/fennel/rpc.getSyncState
 * @returns {Promise} resolves to connection count
 */
function getSyncState() {
    if (_websocket) return _fnlApi.rpc.system.syncState();
    return rpc('system_syncState');
}

/**
 * Gets the node health
 * @function getSystemHealth
 * @alias module:lib/blockchains/fennel/rpc.getPeerCount
 * @returns {Promise} resolves to the node's system health
 */
function getSystemHealth() {
    if (_websocket) return _fnlApi.rpc.system.health();
    return rpc('system_health');
}

/**
 * Gets the system name
 * @function getSystemName
 * @alias module:lib/blockchains/fennel/rpc.getSystemName
 * @returns {Promise} resolves to system name
 */
function getSystemName() {
    if (_websocket) return _fnlApi.rpc.system.name();
    return rpc('system_name');
}

/**
 * Gets the system version
 * @function getSystemVersion
 * @alias module:lib/blockchains/fennel/rpc.getSystemVersion
 * @returns {Promise} resolves to connection count
 */
function getSystemVersion() {
    if (_websocket) return _fnlApi.rpc.system.version();
    return rpc('system_version');
}

/**
 * Gets the transaction count of the specified Fennel blockchain account
 * @function getTransactionCount
 * @alias module:lib/blockchains/fennel/rpc.getTransactionCount
 * @param {string} address
 * @returns {Promise}
 */
function getTransactionCount(address) {
    if (_websocket) {
        return _fnlApi.query.system.account(address)
        .then(({ nonce, data: balance }) => { 
            ignore(balance);
            return Promise.resolve(nonce);
        });
    } else {
        return rpc('system_accountNextIndex', [ address ]);
    }
}

/**
 * Checks if the node is syncing
 * @function isSyncing
 * @alias module:lib/blockchains/fennel/rpc.isSyncing
 * @returns {Promise} resolves to syncing infomration
 */
function isSyncing() {
    return getSystemHealth()
    .then(result => {
        if (result instanceof Map) return Promise.resolve(result.get('isSyncing'));
        return Promise.resolve(result.isSyncing);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

// PRIVATE BLOCKCHAIN STATUS FUNCTIONS //
/**
 * Requests some semi-static Fennel parachain information
 * @private
 */
async function updateNodeInfo() {
    // Get system name
    await getSystemName()
    .then(systemName => (_fnlState.parameters.systemName = systemName  || ''))
    .catch(err => log.warn(MODULELOG, `Could not get system name from node: ${err.message}`));

    // Get system version info
    await getSystemVersion()
    .then(systemVersion => (_fnlState.parameters.systemVersion = systemVersion  || ''))
    .catch(err => log.warn(MODULELOG, `Could not get system version from node: ${err.message}`));

    // Get chain runtime info
    await getRuntimeVersion()
    .then(fnlRuntime => {
        _fnlState.parameters.specName = fnlRuntime.specName || '';
        _fnlState.parameters.specVersion = fnlRuntime.specVersion || '';
        _fnlState.parameters.implName = fnlRuntime.implName || '';
        _fnlState.parameters.implVersion = fnlRuntime.implVersion || '';
    })
    .catch(err => log.warn(MODULELOG, `Could not get chain runtime information from node: ${err.message}`));

    // Get node roles
    await getChainType()
    .then(chainType => (_fnlState.parameters.chainType = chainType || ''))
    .catch(err => log.warn(MODULELOG, `Could not get chain type from node: ${err.message}`));

    // Get node roles
    await getNodeRoles()
    .then(nodeRoles => (_fnlState.parameters.nodeRoles = nodeRoles || ''))
    .catch(err => log.warn(MODULELOG, `Could not get roles from node: ${err.message}`));
}

/**
 * Requests some dynamic Fennel parachain node status information
 * @private
 */
async function updateNodeStatus() {
    _fnlState.status.updated = new Date().toISOString();

    // Get peer status
    await getPeerCount()
    .then(peers => (_fnlState.status.peers = peers  || ''))
    .catch(err => log.warn(MODULELOG, `Could not get peer status: ${err.message}`));

    // Get synchronisation status
    await isSyncing()
    .then(syncing => (_fnlState.status.syncing = syncing  || ''))
    .catch(err => log.warn(MODULELOG, `Could not get synchronisation status: ${err.message}`));

    // Get synchronisation status
    await getSyncState()
    .then(syncState => {
        _fnlState.status.startingBlock = syncState.startingBlock || '';
        _fnlState.status.currentBlock = syncState.currentBlock || '';
        _fnlState.status.highestBlock = syncState.highestBlock || '';
    })
    .catch(err => log.warn(MODULELOG, `Could not get synchronisation status: ${err.message}`));

    // Log node status
    saveNodeStatus();
}

/**
 * Logs the Fennel node status information
 * @private
 */
function saveNodeStatus() {
    wfState.updateBlockchainData(_fnlChain, _fnlState);
    log.info(MODULELOG, `Status: {${JSON.stringify(_fnlState.parameters)}, ${JSON.stringify(_fnlState.status)}}`);
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
