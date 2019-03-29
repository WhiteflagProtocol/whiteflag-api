'use strict';
/**
 * @module lib/endpoints/queue
 * @summary Whiteflag API queue endpoints handler module
 * @description Module with api queue endpoint handlers
 */
module.exports = {
    // Endpoint handler functions
    getQueue
};

// Whiteflag common functions and classes //
const response = require('./common/response');
const array = require('../common/arrays');

// Whiteflag modules //
const wfState = require('../protocol/state');

// MAIN MODULE FUNCTIONS //
/**
 * Returns current queue from state module
 * @function getQueue
 * @alias module:lib/endpoints/queue.getQueue
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getQueue(req, res, operationId, callback) {
    const queue = req.params.queue;
    wfState.getQueue(queue, function endpointGetQueueCb(err, queueState = null) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err) resBody.meta.queue = queue;
        if (!err && !queueState) err = new Error('Could not retrieve queue from state');
        if (queueState) resBody.meta.info = array.addItem(resBody.meta.info, `Current ${queue} queue from state`);
        return response.sendIndicative(res, err, resBody, queueState, callback);
    });
}
