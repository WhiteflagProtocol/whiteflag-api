'use strict';
/**
 * @module lib/_common/response
 * @summary Whiteflag API common http response handler module
 * @description Module with common http response functions
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    getURL,
    createBody,
    addMessageData,
    addRelatedResource,
    sendIndicative,
    sendImperative
};

/* Common internal functions and classes */
const arr = require('../../_common/arrays');
const msg = require('../../protocol/_common/messages');
const { ProcessingError,
        ProtocolError } = require('../../_common/errors');

/* Whiteflag modules */
const apiConfigData = require('../../config').getConfig();

/* MAIN MODULE FUNCTIONS */
/**
 * Returns the URL without path of the request
 * @function getURL
 * @alias module:lib/_common/response.getURL
 * @param {Object} req the http request
 * @returns {string} the url without path
 */
function getURL(req) {
    const reqProtocol = req.protocol || apiConfigData.server?.protocol;
    const reqHost = req.hostname || apiConfigData.server?.hostname || 'localhost';
    let reqPort = '';
    if (apiConfigData.http?.trustProxy) {
        reqPort = req.headers['x-forwarded-port'] || '';
    } else {
        reqPort = req.socket.localPort || apiConfigData.server?.port || '';
    }
    if (reqPort) reqPort = `:${reqPort}`;
    return `${reqProtocol}://${reqHost}${reqPort}`;
}

/**
 * Creates and returns response body object
 * @function createBody
 * @alias module:lib/_common/response.createBody
 * @param {Object} req the http request
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {string} [resourceType] the type of resource returned by the operation
 * @param {string} [query] the query performed by the operation
 * @returns {Object} the response body
 */
function createBody(req, operationId = null, resourceType = null, query = null) {
    let resBody = {};
    resBody.meta = {
        operationId: operationId,
        version: apiConfigData.version,
        request: {
            client: req.ip,
            method: req.method,
            url: getURL(req) + req.originalUrl.replace(/\/$/, '')
        }
    }
    if (query) {
        resBody.meta.query = query;
    }
    if (resourceType) {
        resBody.meta.resource = {
            type: resourceType,
        }
    }
    return resBody;
}

/**
 * Adds Whiteflag message inforamtion to meta data
 * @function addMessageData
 * @alias module:lib/_common/response.addMessageData
 * @param {@wfMessage} wfMessage a Whiteflag message
 * @param {Object} [resMeta] the meta data object to add message details to
 * @returns {Object} the updated meta data object
 */
function addMessageData(wfMessage, resMeta = {}) {
    if (!Object.hasOwn(resMeta, 'resource')) {
        resMeta.resource = { type: 'message' };
    }
    resMeta.resource.code = msg.type(wfMessage);
    resMeta.resource.class = msg.title(wfMessage);
    resMeta.info = arr.addItem(resMeta.info, msg.descr(wfMessage));
    if (wfMessage.MetaHeader.formatValid) {
        resMeta.info = arr.addItem(resMeta.info, 'Message format is valid');
    }
    if (wfMessage.MetaHeader.referenceValid) {
        resMeta.info = arr.addItem(resMeta.info, 'Message reference is valid');
    }
    if (wfMessage.MetaHeader.originatorValid) {
        resMeta.info = arr.addItem(resMeta.info, 'Message originator has been authenticated');
    }
    return resMeta;
}

/**
 * Adds related resources to meta data
 * @function addRelatedResource
 * @alias module:lib/_common/response.addRelatedResource
 * @param {*} [blockchain] the name of the related blcockahin
 * @param {*} [account] the address of the related account
 * @param {*} [originator] the address of the related originator
 * @param {*} [resMeta] the meta data object to add related resources to
 * @returns {Object} the updated meta data object
 */
function addRelatedResource(blockchain = null, account = null, originator = null, resMeta = {}) {
    // Check meta data object
    if (!blockchain && !account && !originator) return resMeta;
    if (!Object.hasOwn(resMeta, 'resource')) return resMeta;
    if (!Object.hasOwn(resMeta.resource, 'related')) resMeta.resource.related = {};
    const resource = resMeta.resource;

    // Add related resources and return meta data
    if (blockchain && resource?.type !== 'blockchain') resource.related.blockchain = blockchain;
    if (account && resource?.type !== 'account') resource.related.account = account;
    if (originator && resource?.type !== 'originator') resource.related.originator = originator;
    return resMeta;
}

/**
 * Sends informative response based on available data and errors
 * @function sendIndicative
 * @alias module:lib/_common/response.sendIndicative
 * @param {Object} res the http response object
 * @param {Error} err any error
 * @param {Object} resBody the response body
 * @param {Object} resData the response data
 * @param {logEndpointEventCb} callback
 */
function sendIndicative(res, err, resBody, resData, callback) {
    let resMeta = resBody.meta;

    // Processing errors
    if (err && err instanceof ProcessingError) {
        if (err.causes) resMeta.errors = arr.addArray(resMeta.errors, err.causes);
        domainErrorResponse(res, err, resBody);
        return callback(null, resMeta.request.client, err.code, `${err.message}: ` + JSON.stringify(resMeta));
    }
    // Generic errors
    if (err && !(err instanceof ProtocolError)) {
        if (err.causes) resMeta.errors = arr.addArray(resMeta.errors, err.causes);
        genericErrorResponse(res, err, resBody);
        return callback(null, resMeta.request.client, 'ERROR', `${err.message}: ` + JSON.stringify(resMeta));
    }
    // Protocol errors: will cause a warning but request is considered successful
    if (err && err instanceof ProtocolError) {
        resMeta.warnings = arr.addItem(resMeta.warnings, err.message);
        if (err.causes) resMeta.warnings = arr.addArray(resMeta.warnings, err.causes);
    }
    // Number of data items returned
    resMeta = addItemCount(resData, resMeta);

    // Return successful response
    successResponse(res, resData, resBody);
    return callback(null, resMeta.request.client, 'SUCCESS', 'Processed request: ' + JSON.stringify(resMeta));
}

/**
 * Sends imperative response based on available data and errors
 * @function sendImperative
 * @alias module:lib/_common/response.sendImperative
 * @param {Object} res the http response object
 * @param {Error} err any error
 * @param {Object} resBody the response body
 * @param {Object} resData the response data
 * @param {logEndpointEventCb} callback
 */
function sendImperative(res, err, resBody, resData, callback) {
    let resMeta = resBody.meta;

    // Check data
    if (!err && typeof resData === 'undefined') err = new Error('Could not retrieve any data');
    if (!err && !resData) err = new ProcessingError('No data available', null, 'WF_API_NO_DATA');

    // Add underlying causes to response body
    if (err?.causes) resMeta.errors = arr.addArray(resMeta.errors, err.causes);

    // Processing errors
    if (err && err instanceof ProcessingError) {
        domainErrorResponse(res, err, resBody);
        return callback(null, resMeta.request.client, err.code, `${err.message}: ` + JSON.stringify(resMeta));
    }
    // Protocol errors
    if (err && err instanceof ProtocolError) {
        domainErrorResponse(res, err, resBody);
        return callback(null, resMeta.request.client, err.code, `${err.message}: ` + JSON.stringify(resMeta));
    }
    // Generic errors
    if (err) {
        genericErrorResponse(res, err, resBody);
        return callback(null, resMeta.request.client, 'ERROR', `${err.message}: ` + JSON.stringify(resMeta));
    }
    // Number of data items returned
    resMeta = addItemCount(resData, resMeta);

    // Return successful response
    successResponse(res, resData, resBody);
    return callback(null, resMeta.request.client, 'SUCCESS', 'Processed request: ' + JSON.stringify(resMeta));
}

/* PRIVATE MODULE FUNCTIONS */
/**
 * Sends successful http repsonse
 * @private
 * @param {Object} res the http response
 * @param {Object} resData the response data
 * @param {Object} resBody the response body
 */
function successResponse(res, resData, resBody) {
    resBody.data = resData || {};

    /* 
     * Operations that are not directly completed, should return 202.
     * For operations that effectively created a new resource, the response code should be 201.
     * Other succesfull operations return 200.
     */
    switch (resBody.meta.operationId) {
        case 'sendMessage':
        case 'transferFunds':
        case 'updateOriginator':
        case 'deleteOriginator':
        case 'storePreSharedKey':
        case 'deletePreSharedKey':
        case 'deleteAuthToken': {
            // Async operations: request accepted
            return res.status(202).send(resBody);
        }
        case 'createAccount': 
        case 'storeAuthToken': {
            // Resource created with pointer to the new resources
            if (resBody.meta?.resource?.location) res.set('Location', resBody.meta.resource.location);
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
 * @param {Object} res the http response
 * @param {Error} err any error
 * @param {Object} resBody the response body
 */
function domainErrorResponse(res, err, resBody) {
    // Not implemented error
    if (err.code === 'WF_API_NOT_IMPLEMENTED') {
        resBody.errors = arr.addItem(resBody.errors, `${err.code}: ${err.message}`);
        return res.status(501).send(resBody);
    }
    // Not available error
    if (err.code === 'WF_API_NOT_AVAILABLE') {
        resBody.errors = arr.addItem(resBody.errors, `${err.code}: ${err.message}`);
        return res.status(503).send(resBody);
    }
    // Not allowed error
    if (err.code === 'WF_API_NOT_ALLOWED') {
        resBody.errors = arr.addItem(resBody.errors, `${err.code}: ${err.message}`);
        return res.status(403).send(resBody);
    }
    // Resource not found or no data error
    if (err.code === 'WF_API_NO_RESOURCE' || err.code === 'WF_API_NO_DATA') {
        resBody.errors = arr.addItem(resBody.errors, `${err.code}: ${err.message}`);
        return res.status(404).send(resBody);
    }
    // Resource conflict
    if (err.code === 'WF_API_RESOURCE_CONFLICT') {
        resBody.errors = arr.addItem(resBody.errors, `${err.code}: ${err.message}`);
        if (resBody.meta.resource) res.set('Location', resBody.meta.resource);
        return res.status(409).send(resBody);
    }
    // Other client request errors
    resBody.errors = arr.addItem(resBody.errors, `${err.code}: ${err.message}`);
    return res.status(400).send(resBody);
}

/**
 * Sends generic error http response
 * @private
 * @param {Object} res the http response
 * @param {Error} err any error
 * @param {Object} resBody the response body
 */
function genericErrorResponse(res, err, resBody) {
    // Sends generic error response
    resBody.errors = arr.addItem(resBody.errors, `Internal server error: ${err.message}`);
    return res.status(500).send(resBody);
}

/**
 * Adds number of data items to meta data
 * @private
 * @param {Array} resData the data items in the response
 * @param {Object} [meta] the meta data to add the data item count to
 * @returns {Object} the updated meta data object
 */
function addItemCount(resData, meta = {}) {
    if (Array.isArray(resData)) {
        if (meta.resource) {
            meta.resource.count = resData.length;
        } else {
            meta.items = resData.length;
        }
    }
    return meta;
}
