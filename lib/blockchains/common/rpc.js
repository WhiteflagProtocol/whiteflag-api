'use strict';
/**
 * @module lib/blockchains/common/rpc
 * @summary Whiteflag API blockchains common RPC module
 * @description Module for common blockchain node RPC functions
 */
module.exports = {
    rpcCall,
    getFullURL,
    getCleanURL
};

// Node.js core and external modules //
// TODO: replace depricated 'request' module
const request = require('request');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { timeoutPromise } = require('../../common/processing');

// Module constants //
const MODULELOG = 'rpc';

/**
 * Makes an HTTP remote procedure call to a blockchain node
 * @function rpcCall
 * @private
 * @param {string} rpcMethod the rpc method
 * @param {string} rpcParams the parameters for the rpc method
 * @param {string} rpcURL the rpc URL
 * @param {string} rpcUser the rpc user
 * @param {string} rpcPass the rpc password
 * @param {string} rpcTimeout the timeout for the rpc
 * @returns {Promise}
 */
function rpcCall(rpcMethod, rpcParams, rpcURL, rpcUser, rpcPass, rpcTimeout = 10000) {
    // Use http, even if web socket URL provided
    let rpcHttpURL = rpcURL.replace(/^ws/, 'http');

    // Use clean URL for logging
    let rpcCleanURL = getCleanURL(rpcHttpURL)
    
    // Prepare request
    let rpcOptions = {
        url: rpcHttpURL,
        method: 'post',
        headers:
        {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'id': 1,
            'jsonrpc': '2.0',
            'method': rpcMethod,
            'params': rpcParams
        })
    };
    // Check authentication
    if (rpcUser && rpcPass) {
        rpcOptions.auth = {
            user: rpcUser,
            password: rpcPass,
            sendImmediately: true
        };
    }
    // Send request with a timeout
    log.trace(MODULELOG, `Making remote procedure call to ${rpcCleanURL}: ${JSON.stringify(rpcOptions.body)}`);
    return timeoutPromise(
        new Promise((resolve, reject) => {
            request(rpcOptions, function rpcRequestCb(err, response, body) {
                // Check for errors
                if (err) {
                    if (!err.message) err.message = `Unknown error occurred during remote procedure call to ${rpcCleanURL}`;
                    return reject(err);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`Node returned status code: ${response.statusCode}`));
                }
                // Parse data
                let data = {};
                try {
                    data = JSON.parse(body);
                } catch(jsonErr) {
                    reject(new Error(`Could not parse JSON response: ${jsonErr}`));
                }
                if (data.error) {
                    return reject(new Error(`RPC method '${rpcMethod}' returned an error: ${JSON.stringify(data.error)}`));
                }
                resolve(data.result);
            });
        }),
        rpcTimeout
    );
}

/**
 * Gets URL of the blockchain node from the configuration
 * @private
 * @param {Object} bcConfig blockchain configuration parameters
 * @param {boolean} hideCredentials whether to inlude rpcUsername and password in url
 * @param {string} defaultPort the default port
 * @returns {string} the url of the Fennel node
 */
function getFullURL(bcConfig, hideCredentials = false, defaultPort = '') {
    const rpcProtocol = (bcConfig.rpcProtocol || 'http') + '://';
    const rpcHost = bcConfig.rpcHost || 'localhost';
    const rpcPort = ':' + (bcConfig.rpcPort || defaultPort);
    const rpcPath = bcConfig.rpcPath || '';
    let rpcAuth = '';
    if (bcConfig.rpcUsername && bcConfig.rpcPassword && !hideCredentials) {
        rpcAuth = bcConfig.rpcUsername + ':' + bcConfig.rpcPassword + '@';
    }
    return (rpcProtocol + rpcAuth + rpcHost + rpcPort + rpcPath);
}

/**
 * Gives a clean URL stripped from sensitive data
 * @param {string} url the URL string to be stripped from sensitive data
 * @returns {string} a clean URL
 */
function getCleanURL(url) {
    return url.replace(/(?<=\/{2}).+?(?:@)/, '');
}
