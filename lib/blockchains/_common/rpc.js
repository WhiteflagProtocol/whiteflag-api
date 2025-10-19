'use strict';
/**
 * @module lib/blockchains/_common/rpc
 * @summary Whiteflag API blockchains common RPC module
 * @description Module for common blockchain node RPC functions
 * @todo Replace depricated 'request' module
 */
module.exports = {
    rpcCall,
    getNodeURL,
};

/* Common internal functions and classes */
const log = require('../../_common/logger');
const req = require('../../_common/request');

/* Module constants */
const MODULELOG = 'rpc';

/**
 * Makes an HTTP remote procedure call to a blockchain node
 * @todo Refactor to replace 'request'
 * @function rpcCall
 * @private
 * @param {string} rpcMethod the rpc method
 * @param {string} rpcParams the parameters for the rpc method
 * @param {string} rpcURL the rpc URL
 * @param {string} rpcUser the rpc user
 * @param {string} rpcPass the rpc password
 * @param {string} rpcTimeout the timeout for the rpc
 * @returns {Promise} resolves to the result of the RPC
 */
function rpcCall(rpcMethod, rpcParams, rpcURL, rpcUser, rpcPass, rpcTimeout = 10000) {
    // Use http, even if web socket URL provided
    let rpcHttpURL = rpcURL.replace(/^ws/, 'http');
    const reqURL = new URL(rpcHttpURL);
    
    // Prepare request
    let rpcRequest = {
        'id': 1,
        'jsonrpc': '2.0',
        'method': rpcMethod,
        'params': rpcParams
    };
    // Send request with a timeout
    log.trace(MODULELOG, `Sending RPC request to ${reqURL.origin}: ${JSON.stringify(rpcRequest)}`);
    return req.httpRequest(reqURL, rpcRequest, rpcUser, rpcPass, rpcTimeout)
    .then(data => {
        log.trace(MODULELOG, `Received RPC response from ${reqURL.origin}: ${JSON.stringify(data)}`);
        if (data.error) {
            return Promise.reject(new Error(`Received an RPC error for '${rpcMethod}' method: ${JSON.stringify(data)}`));
        }
        return Promise.resolve(data.result);
    })
    .catch(err => {
        return Promise.reject(new Error(`RPC failed: ${err.message}`));
    });
}

/**
 * Gets URL of the blockchain node from the configuration
 * @private
 * @param {Object} bcConfig blockchain configuration parameters
 * @param {boolean} hideCredentials whether to inlude rpcUsername and password in url
 * @param {string} defaultPort the default port
 * @returns {string} the url of the Fennel node
 */
function getNodeURL(bcConfig, hideCredentials = false, defaultPort = '') {
    const rpcProtocol = (bcConfig.rpcProtocol || 'http') + '://';
    const rpcHost = bcConfig.rpcHost || 'localhost';
    const rpcPath = bcConfig.rpcPath || '';
    let rpcPort = bcConfig.rpcPort || defaultPort;
    if (rpcPort !== '') rpcPort = ':' + rpcPort;
    let rpcAuth = '';
    if (bcConfig.rpcUsername && bcConfig.rpcPassword && !hideCredentials) {
        rpcAuth = bcConfig.rpcUsername + ':' + bcConfig.rpcPassword + '@';
    }
    return (rpcProtocol + rpcAuth + rpcHost + rpcPort + rpcPath);
}
