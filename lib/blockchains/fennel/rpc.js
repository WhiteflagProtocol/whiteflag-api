'use strict';
/**
 * @module lib/blockchains/fennel/rpc
 * @summary Whiteflag API Fennel / Substrate RPC module
 * @description Module to connect to the Fennel network through a Fennel parachain node
 */
module.exports = {
    init: initRpc
};

// Node.js core and external modules //
const { ApiPromise, WsProvider } = require('@polkadot/api');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { timeoutPromise } = require('../../common/processing');
const { getNodeURL } = require('../common');

// Whiteflag modules //
const wfState = require('../../protocol/state');
const { ProcessingError } = require('../../common/errors');

// Module constants //
const STATUSINTERVAL = 60000; // Every minute
const INFOINTERVAL = 3600000; // Every hour

// Module variables //
let _blockchainName;
let _fennelState;
let _fennelNode;
let _fennelApi;
let _rpcTimeout = 10000;

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
    const rpcURL = getNodeURL(fennelConfig, true); // no credentials
    const rpcAuthHeader = 'Basic ' + Buffer.from(fennelConfig.username + ':' + fennelConfig.password).toString('base64');
    _fennelState.parameters.rpcURL = rpcURL;

    // Set configured timeout
    if (fennelConfig.rpcTimeout && fennelConfig.rpcTimeout > 500) {
        _rpcTimeout = fennelConfig.rpcTimeout;
    }
    log.debug(_blockchainName, `Timeout for remote calls to the Fennel node set to ${_rpcTimeout} ms`);

    // Connect to node
    _fennelNode = new WsProvider(rpcURL, false, { Authorization: rpcAuthHeader }, _rpcTimeout);
    _fennelNode.on('error', (err) => {
        log.error(_blockchainName, `Connection error with Fennel node: ${err.message}`);
    });

    // Promise to create api
    log.trace(_blockchainName, `Connecting to Fennel node: ${rpcURL}`);
    return ApiPromise.create({
        provider: _fennelNode,
        throwOnConnect: true,
        throwOnUnknown: true
    }).then((api) => {
        // We have a connection
        log.info(_blockchainName, `Connected to Fennel parachain through node: ${rpcURL}`);
        _fennelApi = api;

        // TODO: Initialise periodic state updates
    });
}

// PRIVATE BLOCKCHAIN STATUS FUNCTIONS //
/**
 * Requests some semi-static Fennel parachain information
 * @private
 */
function updateNodeInfo() {}

/**
 * Requests some dynamic Fennel parachain node status information
 * @private
 */
function updateNodeStatus() {}


/**
 * Logs the Fennel node status information
 * @private
 */
function saveNodeStatus() {
    wfState.updateBlockchainData(_blockchainName, _fennelState);
    log.info(_blockchainName, `Status: {${JSON.stringify(_fennelState.parameters)}, ${JSON.stringify(_fennelState.status)}}`);
}
