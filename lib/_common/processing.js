'use strict';
/**
 * @module lib/_common/processing
 * @summary Whiteflag API common processing functions module
 * @description Module with processing functions making life easier
 * @tutorial modules
 */
module.exports = {
    ignore,
    timeoutPromise,
    retryPromise,
    delayPromise
};

/* MAIN MODULE FUNCTIONS */
/**
 * Ignores its arguments and returns nothing
 * @function ignore
 * @alias module:lib/_common/processing.ignore
 */
function ignore() {}

/**
 * Executes a promise under a timeout
 * @function timeoutPromise
 * @alias module:lib/_common/processing.timeoutPromise
 * @param {Promise} promise the promise to be executed under a timeout
 * @param {number} timeout time in ms
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

/**
 * Executes a promsie with retries
 * @function retryPromise
 * @alias module:lib/_common/processing.retryPromise
 * @param {Promise} promise the promise to be retried
 * @param {number} retries the number of retries
 * @param {number} timeout time to wait between retires in ms
 * @returns {Promise}
 */
function retryPromise(promise, retries = 2, delay = 1000) {
    return promise.catch(err => {
        if (retries > 0) {
            // Retry after delay
            return retryPromise(
                delayPromise(promise, delay),
                (retries - 1),
                delay
            );
        }
        throw err;
    });
}

/**
 * Exectures a promise with a delay
 * @function delayPromise
 * @alias module:lib/_common/processing.delayPromise
 * @param {*} promise the promise to be delayed
 * @param {*} delay time to delay in ms
 * @returns {Promise}
 */
function delayPromise(promise, delay = 1000) {
    return new Promise((resolve, reject) => {
        setTimeout(function delayPromiseCb() {
            // Execute original promise
            promise.then(function delayPromiseResolve(data) {
                resolve(data);
            }).catch(function delayPromiseError(err) {
                reject(err);
            });
        }, delay);
    });
}
