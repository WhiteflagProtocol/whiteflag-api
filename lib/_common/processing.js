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
        promise
        .then(function timeoutPromiseResolve(data) {
            return resolve(data);
        })
        .catch(function timeoutPromiseError(err) {
            return reject(err);
        });
        // Start timer and reject if timer finishes before original promise
        setTimeout(function timeoutPromiseReject() {
            return reject(new Error(`Timeout after ${timeout} ms`));
        }, timeout);
    });
}

/**
 * Executes a promise with retries
 * @function retryPromise
 * @alias module:lib/_common/processing.retryPromise
 * @param {Promise} promise the promise to be retried
 * @param {number} retries the number of retries
 * @param {number} timeout time to wait between retires in ms
 * @returns {Promise}
 */
function retryPromise(promise, retries = 2, delay = 1000) {
    return new Promise((resolve, reject) => {
        // Execute original promise
        promise
        .then(function retryPromiseResolve(data) {
            return resolve(data);
        })
        .catch(function retryPromiseError(err) {
            if (retries > 0) {
                // Retry after delay
                return wait(delay)
                .then(retryPromise.bind(null, promise, (retries - 1), delay))
                .then(resolve)
                .catch(reject);
            }
            return reject(err);
        });
    });
}

/**
 * Exectures a promise with a delay
 * @function delayPromise
 * @alias module:lib/_common/processing.delayPromise
 * @param {Promise} promise the promise to be delayed
 * @param {number} delay time to delay in ms
 * @returns {Promise}
 */
function delayPromise(promise, delay = 1000) {
    return new Promise((resolve, reject) => {
        setTimeout(function delayPromiseCb() {
            // Execute original promise
            promise
            .then(function delayPromiseResolve(data) {
                return resolve(data);
            })
            .catch(function delayPromiseError(err) {
                return reject(err);
            });
        }, delay);
    });
}

/**
 * Resolves after a delay
 * @function wait
 * @alias module:lib/_common/processing.wait
 * @param {number} delay time to delay in ms
 * @returns {Promise} that resolves after the delay
 */
function wait(delay = 1000) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}
