'use strict';
/**
 * @module lib/blockchains/common/rpc
 * @summary Whiteflag API blockchains common RPC module
 * @description Module for common blockchain node RPC functions
 */
module.exports = {
    rpcCall,
    getNodeURL
};

// Node.js core and external modules //
const request = require('request');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { timeoutPromise, ignore } = require('../../common/processing');

// Module constants //
const MODULELOG = 'rpc';

/**
 * Makes an remote procedure call to a blockchain node
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
    // Prepare request
    let rpcOptions = {
        url: rpcURL,
        method: 'post',
        headers:
        {
            'content-type': 'application/json'
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
        rpcOptions.authorization = {
            user: rpcUser,
            password: rpcPass
        };
    }
    // Send request with a timeout
    log.trace(MODULELOG, `Making remote procedure call to ${rpcURL}: ${JSON.stringify(rpcOptions.body)}`);
    return timeoutPromise(
        new Promise((resolve, reject) => {
            request(rpcOptions, function rpcRequestCb(err, header, body) {
                if (err) {
                    if (!err.message) err.message = `Request not accepted by ${rpcURL}`;
                    return reject(err);
                }
                ignore(header);
                let response = {};
                try {
                    response = JSON.parse(body);
                } catch(jsonErr) {
                    reject(jsonErr);
                }
                if (response.error) {
                    return reject(new Error(JSON.stringify(response.error)));
                }
                resolve(response.result);
            });
        }),
        rpcTimeout
    );
}

/**
 * Gets URL of the blockchain node from the configuration
 * @private
 * @param {Object} blockchainConfig blockchain configuration parameters
 * @param {boolean} hideCredentials whether to inlude username and password in url
 * @returns {string} the url of the Fennel node
 */
function getNodeURL(blockchainConfig, hideCredentials = false) {
    const rpcProtocol = (blockchainConfig.rpcProtocol || 'http') + '://';
    const rpcHost = blockchainConfig.rpcHost || 'localhost';
    const rpcPort = blockchainConfig.rpcPort ? ':' + blockchainConfig.rpcPort : '';
    const rpcPath = blockchainConfig.rpcPath || '';
    let rpcAuth = '';
    if (blockchainConfig.username && blockchainConfig.password && !hideCredentials) {
        rpcAuth = blockchainConfig.username + ':' + blockchainConfig.password + '@';
    }
    return (rpcProtocol + rpcAuth + rpcHost + rpcPort + rpcPath);
}
