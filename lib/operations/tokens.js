'use strict';
/**
 * @module lib/operations/tokens
 * @summary Whiteflag API tokens endpoints handler module
 * @description Module with api tokens endpoint handlers
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    get: getAuthToken,
    store: storeAuthToken,
    delete: deleteAuthToken
};

/* Common internal functions and classes */
const arr = require('../_common/arrays');
const { hash } = require('../_common/crypto');
const { ProcessingError } = require('../_common/errors');
const { createBody,
        sendImperative } = require('./_common/response');

/* Whiteflag modules */
const wfState = require('../protocol/state');

/* Module constants */
const RSC_TOKEN = 'token';
const KEYIDLENGTH = 12;

/* MAIN MODULE FUNCTIONS */
/**
 * Checks for an authentication token of an originator
 * @function getAuthToken
 * @alias module:lib/operations/tokens.get
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getAuthToken(req, res, operationId, callback) {
    const authTokenId = req.params.authTokenId;
    let resBody = createBody(req, operationId, RSC_TOKEN);

    // Get authentication token
    wfState.getKey('authTokens', authTokenId, function getAuthTokenGetKeyCb(err, authToken) {
        if (!err && !authToken) {
            err = new ProcessingError(`No authentication token with token id ${authTokenId}`, null, 'WF_API_NO_RESOURCE');
            return sendImperative(res, err, resBody, null, callback);
        }
        authToken = null;
        resBody.meta.related = {}
        resBody.meta.resource.id = authTokenId;
        resBody.meta.info = arr.addItem(resBody.meta.info, 'Authentication token exists');

        // Get originator data and send response
        wfState.getOriginatorAuthToken(authTokenId, function getOriginatorAuthTokenCb(err, originatorData) {
            if (!err && !originatorData) {
                err = new ProcessingError(`No originator found for token id ${authTokenId}`, null, 'WF_API_NO_DATA');
            }
            if (!err) {
                if (originatorData.blockchain) resBody.meta.related.blockchain = originatorData.blockchain;
                if (originatorData.address) resBody.meta.related.originator = originatorData.address;
                resBody.meta.info = arr.addItem(resBody.meta.info, 'Returning originator data for authentication token');
            }
            return sendImperative(res, err, resBody, originatorData, callback);
        });
    });
}

/**
 * Stores an authentication token for an originator
 * @function storeAuthToken
 * @alias module:lib/operations/tokens.store
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function storeAuthToken(req, res, operationId, callback) {
    let authToken = req.body.secret || null;
    req.body.secret = null;
    let originatorData = {};
    let resBody = createBody(req, operationId, RSC_TOKEN);

    // Check for errors
    let errors = [];
    if (!authToken) errors.push('No authentication token provided');
    if (!req.body.name) errors.push('No originator name provided');
    if (!req.body.blockchain) errors.push('No blockchain provided');
    if (errors.length > 0) {
        let err = new ProcessingError('Invalid authentication token data', errors, 'WF_API_BAD_REQUEST');
        return sendImperative(res, err, resBody, originatorData, callback);
    }
    // Check for existing authentication token
    const authTokenId = hash(originatorData.blockchain + authToken, KEYIDLENGTH);

    wfState.getKey('authTokens', authTokenId, function storeAuthTokenGetKeyCb(err, existingAuthToken) {
        // Metadata for response
        resBody.meta.related = {}
        resBody.meta.related.blockchain = req.body.blockchain;
        resBody.meta.resource.id = authTokenId;

        // Check for errors and existing authentication token
        if (err || existingAuthToken) {
            existingAuthToken = null;
            if (!err) err = new ProcessingError('Authentication token already exists', null, 'WF_API_RESOURCE_CONFLICT');
            return sendImperative(res, err, resBody, originatorData, callback);
        }
        // Store token
        resBody.meta.info = arr.addItem(resBody.meta.info, 'Accepted request to store authentication token');
        wfState.upsertKey('authTokens', authTokenId, authToken);
        authToken = null;

        // Store originator data
        originatorData.name = req.body.name;
        originatorData.blockchain = req.body.blockchain;
        if (req.body.address) {
            originatorData.address = req.body.address;
            resBody.meta.related.originator = originatorData.address;
        }
        originatorData.authTokenId = authTokenId;
        wfState.upsertOriginatorData(originatorData);

        // Send response
        return sendImperative(res, err, resBody, originatorData, callback);
    });
}

/**
 * Deletes an authentication token of an originator
 * @function deleteAuthToken
 * @alias module:lib/operations/tokens.delete
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function deleteAuthToken(req, res, operationId, callback) {
    const authTokenId = req.params.authTokenId;
    let resBody = createBody(req, operationId, RSC_TOKEN);

    // Check if key exists before deleting
    wfState.getKey('authTokens', authTokenId, function getAuthTokenGetKeyCb(err, existingAuthToken) {
        if (!err && !existingAuthToken) {
            err = new ProcessingError(`No authentication token with token id ${authTokenId}`, null, 'WF_API_NO_RESOURCE');
            return sendImperative(res, err, resBody, null, callback);
        }
        resBody.meta.related = {}
        resBody.meta.resource.id = authTokenId;
        existingAuthToken = null;

        // Get originator data before deleting
        wfState.getOriginatorAuthToken(authTokenId, function getOriginatorAuthTokenCb(err, originatorData) {
            if (!originatorData) originatorData = {};
            if (!err) {
                if (originatorData.blockchain) resBody.meta.related.blockchain = originatorData.blockchain;
                if (originatorData.address) resBody.meta.related.originator = originatorData.address;
                resBody.meta.info = arr.addItem(resBody.meta.info, 'Accepted request to delete authentication token');
                wfState.removeOriginatorAuthToken(authTokenId);
            }
            return sendImperative(res, err, resBody, originatorData, callback);
        });
    });
}
