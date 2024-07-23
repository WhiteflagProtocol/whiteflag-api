'use strict';
/**
 * @module lib/blockchains/fennel/rpc
 * @summary Whiteflag API Fennel / Substrate RPC module
 * @description Module to connect to the Fennel network through a Fennel parachain node
 */
module.exports = {
    init: initRpc,
    getRuntimeVersion,
    getSystemVersion,
    getSyncState
};

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
    log.trace(_blockchainName, 'Initialising Fennel RPC connection...');

    // Get Node URL and credentials
    _rpcURL = getNodeURL(fennelConfig, true); // no credentials
    _fennelState.parameters.rpcURL = _rpcURL;
    _rpcUser = fennelConfig.username;
    _rpcPass = fennelConfig.password;

    // Connect to Fennel node
    return new Promise((resolve, reject) => {
        // Check Fennel chain
        getRuntimeVersion()
        .then(fennelRuntime => {
            // We have a connection
            const specName = fennelRuntime.specName;
            _fennelState.parameters.specName = specName;
            log.info(_blockchainName, `Connected to ${specName} through node: ${_rpcURL}`);

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
    });
}

// RPC CALL WRAPPER FUNCTIONS //
/**
 * Get the runtime version information
 * @returns {Promise} resolves to connection count
 */
function getRuntimeVersion() {
    return rpc('chain_getRuntimeVersion');
}

/**
 * Get the system version
 * @returns {Promise} resolves to connection count
 */
function getSystemVersion() {
    return rpc('system_version');
}

/**
 * Get the system synchronisation state
 * @returns {Promise} resolves to connection count
 */
function getSyncState() {
    return rpc('system_syncState');
}

// PRIVATE BLOCKCHAIN STATUS FUNCTIONS //
/**
 * Requests some semi-static Fennel parachain information
 * @private
 */
async function updateNodeInfo() {
    // Get system version info
    await getSystemVersion()
    .then(systemVersion => (_fennelState.parameters.systemVersion = systemVersion))
    .catch(err => log.warn(_blockchainName, `Could not get system version from node: ${err.message}`));

    // Get chain runtime info
    await getRuntimeVersion()
    .then(fennelRuntime => (_fennelState.parameters.specName = fennelRuntime.specName))
    .catch(err => log.warn(_blockchainName, `Could not get chain runtime information from node: ${err.message}`));
}

/**
 * Requests some dynamic Fennel parachain node status information
 * @private
 */
async function updateNodeStatus() {
    _fennelState.status.updated = new Date().toISOString();

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
