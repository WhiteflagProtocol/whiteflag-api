'use strict';
/**
 * @module lib/blockchains/common/rpc
 * @summary Whiteflag API blockchain common RPC module
 * @description Module for RPC calls over http to a blcokchain node
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
        auth: {
            user: rpcUser,
            password: rpcPass
        },
        method: 'post',
        headers:
        {
            'content-type': 'text/plain'
        },
        body: JSON.stringify({
            'jsonrpc': '2.0',
            'method': rpcMethod,
            'params': rpcParams
        })
    };
    // Send request with a timeout
    log.trace(MODULELOG, `Making remote procedure call to ${rpcURL}: ${JSON.stringify(rpcOptions.body)}`);
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
        rpcTimeout
    );
}

/**
 * Gets URL of the node from the blockchain configuration
 * @private
 * @param {Object} bcConfig blockchain configuration parameters
 * @returns {string} the url of the blockchain node
 */
 function getNodeURL(bcConfig) {
    const rpcProtocol = (bcConfig.rpcProtocol || 'http') + '://';
    const rpcHost = bcConfig.rpcHost || 'localhost';
    const rpcPort = ':' + (bcConfig.rpcPort || '8545');
    const rpcPath = bcConfig.rpcPath || '';
    return (rpcProtocol + rpcHost + rpcPort + rpcPath);
}
