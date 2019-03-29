'use strict';
/**
 * @module lib/common/processing
 * @summary Whiteflag API common processing functions module
 * @description Module with processing functions making life easier
 */
module.exports = {
    // Processing functions
    timeoutPromise
};

// MAIN MODULE FUNCTIONS //
/**
 * Execute promise under a timeout
 * @function timeoutPromise
 * @alias module:lib/common/processing.timeoutPromise
 * @param {Promise} promise the promise to be executed under a timeout
 * @param {number} timeout time in milliseconds
 * @returns {Promise}
 */
function timeoutPromise(promise, time = 1000) {
    return new Promise((resolve, reject) => {
        // Get block data
        promise.then(function ethTimeoutResolve(data) {
            resolve(data);
        }).catch(function ethTimeoutError(err) {
            reject(err);
        });
        // Start timer and reject if timer finishes before promise
        setTimeout(function ethTimeoutReject() {
            reject(new Error(`Timeout after ${time} ms`));
        }, time);
    });
}
