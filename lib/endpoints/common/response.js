'use strict';
/**
 * @module lib/endpoints/common/response
 * @summary Whiteflag API common endpoint response handler module
 * @description Module with common http response functions for endpoints
 */
module.exports = {
    // HTTP response functions
    createBody,
    getURL,
    sendIndicative,
    sendImperative
};

// Whiteflag common functions and classes //
const array = require('../../common/arrays');
const { ProcessingError, ProtocolError } = require('../../common/errors');

// Whiteflag modules //
const apiConfigData = require('../../config').getConfig();

// MAIN MODULE FUNCTIONS //
/**
 * Returns the URL without path of the request
 * @function getURL
 * @alias module:lib/endpoints/common/response.getURL
 * @param {object} req the http request
 * @returns {string} the url without path
 */
function getURL(req) {
    const reqProtocol = req.protocol || apiConfigData.server.protocol;
    const reqHost = req.hostname || apiConfigData.server.hostname || 'localhost';
    return `${reqProtocol}://${reqHost}`;
}

/**
 * Creates and returns response body object
 * @function createBody
 * @alias module:lib/endpoints/common/response.createBody
 * @param {object} req the http request
 * @param {string} operationId the operation id as defined in the openapi definition
 * @returns {object} the response body
 */
function createBody(req, operationId = null) {
    let resBody = {};
    resBody.meta = {};
    if (operationId) resBody.meta.operationId = operationId;
    resBody.meta.request = {};
    resBody.meta.request.client = req.ip;
    resBody.meta.request.method = req.method;
    resBody.meta.request.url = getURL(req) + req.originalUrl;
    return resBody;
}

/**
 * Sends informative response based on available data and errors
 * @function sendIndicative
 * @alias module:lib/endpoints/common/response.sendIndicative
 * @param {object} res the http response object
 * @param {object} err error object if any errors
 * @param {object} resBody the response body
 * @param {object} resData the response data
 * @param {logEndpointEventCb} callback
 * @returns
 */
function sendIndicative(res, err, resBody, resData, callback) {
    // Processing errors
    if (err && err instanceof ProcessingError) {
        if (err.causes) resBody.meta.errors = array.addArray(resBody.meta.errors, err.causes);
        domainErrorResponse(res, err, resBody);
        return callback(null, resBody.meta.request.client, err.code, `${err.message}: ` + JSON.stringify(resBody.meta));
    }
    // Generic errors
    if (err && !(err instanceof ProtocolError)) {
        if (err.causes) resBody.meta.errors = array.addArray(resBody.meta.errors, err.causes);
        genericErrorResponse(res, err, resBody);
        return callback(null, resBody.meta.request.client, 'ERROR', `${err.message}: ` + JSON.stringify(resBody.meta));
    }
    // Protocol errors: will cause a warning but request is considered successful
    if (err && err instanceof ProtocolError) {
        resBody.meta.warnings = array.addItem(resBody.meta.warnings, err.message);
        if (err.causes) resBody.meta.warnings = array.addArray(resBody.meta.warnings, err.causes);
    }
    // Return successful response
    if (Array.isArray(resData)) resBody.meta.info = array.addItem(resBody.meta.info, `Returning ${resData.length} items`);
    successResponse(res, resData, resBody);
    return callback(null, resBody.meta.request.client, 'SUCCESS', 'Processed request: ' + JSON.stringify(resBody.meta));
}

/**
 * Sends imperative response based on available data and errors
 * @function sendImperative
 * @alias module:lib/endpoints/common/response.sendImperative
 * @param {object} res the http response object
 * @param {object} err error object if any errors
 * @param {object} resBody the response body
 * @param {object} resData the response data
 * @param {logEndpointEventCb} callback
 * @returns
 */
function sendImperative(res, err, resBody, resData, callback) {
    // Check data
    if (!err && typeof resData === 'undefined') err = new Error('Could not retrieve any data');
    if (!err && !resData) err = new ProcessingError('No data available', null, 'WF_API_NO_DATA');

    // Add underlying causes to response body
    if (err && err.causes) resBody.meta.errors = array.addArray(resBody.meta.errors, err.causes);

    // Processing errors
    if (err && err instanceof ProcessingError) {
        domainErrorResponse(res, err, resBody);
        return callback(null, resBody.meta.request.client, err.code, `${err.message}: ` + JSON.stringify(resBody.meta));
    }
    // Protocol errors
    if (err && err instanceof ProtocolError) {
        domainErrorResponse(res, err, resBody);
        return callback(null, resBody.meta.request.client, err.code, `${err.message}: ` + JSON.stringify(resBody.meta));
    }
    // Generic errors
    if (err) {
        genericErrorResponse(res, err, resBody);
        return callback(null, resBody.meta.request.client, 'ERROR', `${err.message}: ` + JSON.stringify(resBody.meta));
    }
    // Return successful response
    if (Array.isArray(resData)) resBody.meta.info = array.addItem(resBody.meta.info, `Returning ${resData.length} items`);
    successResponse(res, resData, resBody);
    return callback(null, resBody.meta.request.client, 'SUCCESS', 'Processed request: ' + JSON.stringify(resBody.meta));
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Sends successful http repsonse
 * @private
 * @param {object} res the http response
 * @param {object} resData the response data
 * @param {object} resBody the response body
 */
function successResponse(res, resData, resBody) {
    resBody.data = resData || {};

    /* For operations that effectively created a new resource,
     * the response code should be 201.
     * Operations that are not directly completed, should return 202.
     * Other succesfull operations return 200.
     */
    switch (resBody.meta.operationId) {
        case 'storeMainPreSharedKey':
        case 'deleteMainPreSharedKey':
        case 'storePreSharedKey':
        case 'deletePreSharedKey': {
            // Async operations: request accepted
            return res.status(202).send(resBody);
        }
        case 'createAccount': {
            // Resource created with pointer to the new resources
            res.set('Location', resBody.meta.resource);
            return res.status(201).send(resBody);
        }
        default: {
            // Normal success
            return res.status(200).send(resBody);
        }
    }
}

/**
 * Sends domain error http response
 * @private
 * @param {object} res the http response
 * @param {object} err the error
 * @param {object} resBody the response body
 */
function domainErrorResponse(res, err, resBody) {
    // Sends domain error responses

    // Not implemented error
    if (err.code === 'WF_API_NOT_IMPLEMENTED') {
        resBody.errors = array.addItem(resBody.errors, `${err.code}: ${err.message}`);
        return res.status(501).send(resBody);
    }
    // Not available error
    if (err.code === 'WF_API_NOT_AVAILABLE') {
        resBody.errors = array.addItem(resBody.errors, `${err.code}: ${err.message}`);
        return res.status(503).send(resBody);
    }
    // Resource not found or no data error
    if (err.code === 'WF_API_NO_RESOURCE' || err.code === 'WF_API_NO_DATA') {
        resBody.errors = array.addItem(resBody.errors, `${err.code}: ${err.message}`);
        return res.status(404).send(resBody);
    }
    // Other client request errors
    resBody.errors = array.addItem(resBody.errors, `${err.code}: ${err.message}`);
    return res.status(400).send(resBody);
}

/**
 * Sends generic error http response
 * @private
 * @param {object} res the http response
 * @param {object} err the error
 * @param {object} resBody the response body
 */
function genericErrorResponse(res, err, resBody) {
    // Sends generic error response
    resBody.errors = array.addItem(resBody.errors, `Internal server error: ${err.message}`);
    return res.status(500).send(resBody);
}
