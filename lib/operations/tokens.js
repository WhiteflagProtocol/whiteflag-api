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
        addRelatedResource,
        sendImperative } = require('./_common/response');

/* Whiteflag modules */
const wfState = require('../protocol/state');

/* Module constants */
const R_TOKEN = 'token';
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
    let resBody = createBody(req, operationId, R_TOKEN);

    // Get authentication token
    wfState.getKey('authTokens', authTokenId, function getAuthTokenGetKeyCb(err, authToken) {
        if (!err && !authToken) {
            err = new ProcessingError(`No authentication token with token id ${authTokenId}`, null, 'WF_API_NO_RESOURCE');
            return sendImperative(res, err, resBody, null, callback);
        }
        authToken = null;
        resBody.meta.resource.id = authTokenId;
        resBody.meta.resource.location = `${resBody.meta.request.url}`;

        // Get originator data and send response
        wfState.getOriginatorAuthToken(authTokenId, function getOriginatorAuthTokenCb(err, originatorData) {
            if (!err && !originatorData) {
                resBody.meta.warnings = arr.addItem(resBody.meta.info, 'Authentication token exists but not related to an originator');
                err = new ProcessingError(`No originator found for token id ${authTokenId}`, null, 'WF_API_RESOURCE_CONFLICT');
            }
            if (!err) {
                resBody.meta.info = arr.addItem(resBody.meta.info, 'Authentication token exists');
                resBody.meta = addRelatedResource(originatorData.blockchain, null, originatorData.address, resBody.meta);
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
    let resBody = createBody(req, operationId, R_TOKEN);
    req.body.secret = null;

    // Check for errors
    let errors = [];
    if (!authToken) errors.push('No authentication token provided');
    if (!req.body.name) errors.push('No originator name provided');
    if (!req.body.blockchain) errors.push('No blockchain provided');
    if (errors.length > 0) {
        let err = new ProcessingError('Invalid authentication token data', errors, 'WF_API_BAD_REQUEST');
        return sendImperative(res, err, resBody, null, callback);
    }
    // Check for existing authentication token
    const authTokenId = hash(req.body.blockchain + authToken, KEYIDLENGTH);
    wfState.getKey('authTokens', authTokenId, function storeAuthTokenGetKeyCb(err, existingAuthToken) {
        // Metadata for response
        resBody.meta.resource.id = authTokenId;
        resBody.meta.resource.location = `${resBody.meta.request.url}/${resBody.meta.resource.id}`;
        resBody.meta = addRelatedResource(req.body.blockchain, null, null, resBody.meta);

        // Check for errors and existing authentication token
        if (err) return sendImperative(res, err, resBody, null, callback);
        if (existingAuthToken) {
            existingAuthToken = null;
            return wfState.getOriginatorAuthToken(authTokenId, function getOriginatorAuthTokenCb(err, originatorData) {
                err = new ProcessingError('Authentication token already exists', null, 'WF_API_RESOURCE_CONFLICT');
                if (originatorData) {
                    resBody.meta = addRelatedResource(originatorData.blockchain, null, originatorData.address, resBody.meta);
                }
                return sendImperative(res, err, resBody, originatorData, callback);
            });
        }
        // Store token
        resBody.meta.info = arr.addItem(resBody.meta.info, 'Accepted request to store authentication token');
        wfState.upsertKey('authTokens', authTokenId, authToken);
        authToken = null;

        // Store originator data
        let originatorData = {
            name: req.body.name,
            blockchain: req.body.blockchain,
            authTokenId: authTokenId
        };
        if (req.body.address) originatorData.address = req.body.address;
        resBody.meta.info = arr.addItem(resBody.meta.info, 'Updating originators state with authentication token');
        wfState.upsertOriginatorData(originatorData);

        // Add related resources and send response
        resBody.meta = addRelatedResource(originatorData.blockchain, null, originatorData.address, resBody.meta);
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
    let resBody = createBody(req, operationId, R_TOKEN);

    // Check if key exists before deleting
    wfState.getKey('authTokens', authTokenId, function getAuthTokenGetKeyCb(err, existingAuthToken) {
        if (!err && !existingAuthToken) {
            err = new ProcessingError(`No authentication token with token id ${authTokenId}`, null, 'WF_API_NO_RESOURCE');
            return sendImperative(res, err, resBody, null, callback);
        }
        resBody.meta.resource.id = authTokenId;
        existingAuthToken = null;

        // Get originator data before deleting
        wfState.getOriginatorAuthToken(authTokenId, function getOriginatorAuthTokenCb(err, originatorData) {
            if (!originatorData) originatorData = {};
            if (!err) {
                resBody.meta = addRelatedResource(originatorData.blockchain, null, originatorData.address, resBody.meta);
                resBody.meta.info = arr.addItem(resBody.meta.info, 'Accepted request to delete authentication token');
                wfState.removeOriginatorAuthToken(authTokenId);
            }
            return sendImperative(res, err, resBody, originatorData, callback);
        });
    });
}
