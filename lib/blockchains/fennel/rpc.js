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
    const rpcAuthURL = getNodeURL(fennelConfig, false);
    const rpcCleanURL = getNodeURL(fennelConfig, true); // no credentials
    _fennelState.parameters.rpcURL = rpcCleanURL;

    // Create the API and wait until ready (optional provider passed through)
    return timeoutPromise(new Promise((resolve, reject) => {
        // Connect to node
        try {
            _fennelNode = new WsProvider(rpcAuthURL);
        } catch(err) {
            reject(new Error(`Could not connect to Fennel node: ${err.message}`));
        }
        ApiPromise.create({ _fennelNode })
        .then((api) => {
            // We have a connection
            _fennelApi = api;
            log.info(_blockchainName, `Connected to Fennel parachain through node: ${rpcCleanURL}`);

            // Set configured timeout
            if (fennelConfig.rpcTimeout && fennelConfig.rpcTimeout > 500) {
                _rpcTimeout = fennelConfig.rpcTimeout;
            }
            log.info(_blockchainName, `Timeout for remote calls to the Fennel node: ${_rpcTimeout} ms`);

            // TODO: Initialise periodic state updates

            // Succesfully completed initialisation
            return resolve(_fennelApi);
        })
        .catch(err => reject(new Error(`Could not connect to Fennel node: ${err.message}`)));
    }), _rpcTimeout);
}

// PRIVATE RPC FUNCTIONS //
/**
 * Gets URL of the Fennel blockchain node from the configuration
 * @private
 * @param {Object} fennelConfig blockchain configuration parameters
 * @param {boolean} hideCredentials whether to inlude username and password in url
 * @returns {string} the url of the Fennel node
 */
 function getNodeURL(fennelConfig, hideCredentials = false) {
    const rpcProtocol = (fennelConfig.rpcProtocol || 'ws') + '://';
    const rpcHost = fennelConfig.rpcHost || 'localhost';
    const rpcPort = ':' + (fennelConfig.rpcPort || '9944');
    const rpcPath = fennelConfig.rpcPath || '';
    let rpcAuth = '';
    if (fennelConfig.username && fennelConfig.password && !hideCredentials) {
        rpcAuth = fennelConfig.username + ':' + fennelConfig.password + '@';
    }
    return (rpcProtocol + rpcAuth + rpcHost + rpcPort + rpcPath);
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
