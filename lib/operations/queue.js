'use strict';
/**
 * @module lib/operations/queue
 * @summary Whiteflag API queue endpoints handler module
 * @description Module with api queue endpoint handlers
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    getQueue
};

// Common internal functions and classes //
const arr = require('../_common/arrays');
const { createBody,
        sendIndicative } = require('./_common/response');


// Whiteflag modules //
const wfState = require('../protocol/state');

// MAIN MODULE FUNCTIONS //
/**
 * Returns current queue from state module
 * @function getQueue
 * @alias module:lib/operations/queue.getQueue
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getQueue(req, res, operationId, callback) {
    const queue = req.params.queue;
    wfState.getQueue(queue, function opsGetQueueCb(err, queueState = null) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err) resBody.meta.queue = queue;
        if (!err && !queueState) err = new Error('Could not retrieve queue from state');
        if (queueState) resBody.meta.info = arr.addItem(resBody.meta.info, `Current ${queue} queue from state`);
        return sendIndicative(res, err, resBody, queueState, callback);
    });
}
