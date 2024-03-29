'use strict';
/**
 * @module lib/common/processing
 * @summary Whiteflag API common processing functions module
 * @description Module with processing functions making life easier
 * @tutorial modules
 */
module.exports = {
    // Processing functions
    ignore,
    timeoutPromise
};

// MAIN MODULE FUNCTIONS //
/**
 * Ignores its arguments and returns nothing
 * @function ignore
 * @alias module:lib/common/processing.ignore
 */
 function ignore() {}

/**
 * Execute promise under a timeout
 * @function timeoutPromise
 * @alias module:lib/common/processing.timeoutPromise
 * @param {Promise} promise the promise to be executed under a timeout
 * @param {number} timeout time in milliseconds
 * @returns {Promise}
 */
function timeoutPromise(promise, timeout = 1000) {
    return new Promise((resolve, reject) => {
        // Execute original promise
        promise.then(function timeoutPromiseResolve(data) {
            resolve(data);
        }).catch(function timeoutPromiseError(err) {
            reject(err);
        });
        // Start timer and reject if timer finishes before original promise
        setTimeout(function timeoutPromiseReject() {
            reject(new Error(`Timeout after ${timeout} ms`));
        }, timeout);
    });
}
