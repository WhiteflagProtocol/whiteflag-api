'use strict';
/**
 * @module lib/endpoints/originators
 * @summary Whiteflag API originators endpoints handler module
 * @description Module with api originators endpoint handlers
 */
module.exports = {
    // Endpoint handler functions
    getOriginators,
    getOriginator,
    getPreSharedKey,
    storePreSharedKey,
    deletePreSharedKey,
    storeAuthToken
};

// Whiteflag common functions and classes //
const response = require('./common/response');
const array = require('../common/arrays');
const { hash } = require('../common/crypto');
const { ProcessingError } = require('../common/errors');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Module constants //
const KEYIDLENGTH = 12;

// MAIN MODULE FUNCTIONS //
/**
 * Provides current state of all originators from state module
 * @function getOriginators
 * @alias module:lib/endpoints/originators.getOriginators
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getOriginators(req, res, operationId, callback) {
    wfState.getOriginators(function endpointGetOriginatorsCb(err, originatorsState = null) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err && !originatorsState) err = new Error('Could not retrieve known originators from state');
        if (originatorsState) resBody.meta.info = array.addItem(resBody.meta.info, 'Currently known originators from state');
        return response.sendIndicative(res, err, resBody, originatorsState, callback);
    });
}

/**
 * Provides current originator state from state module
 * @function getOriginator
 * @alias module:lib/endpoints/originators.getOriginator
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getOriginator(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    wfState.getOriginatorData(originatorAddress, function endpointGetOriginatorCb(err, originatorState = null) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err && !originatorState) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) {
            resBody.meta.originator = originatorAddress;
            resBody.meta.info = array.addItem(resBody.meta.info, 'Current originator state');
        }
        return response.sendIndicative(res, err, resBody, originatorState, callback);
    });
}

/**
 * Checks for pre-shared key for an originator
 * @function getPreSharedKey
 * @alias module:lib/endpoints/originators.getPreSharedKey
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getPreSharedKey(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    const accountAddress = req.params.account;
    let resBody = response.createBody(req, operationId);

    // Get originator and check for errors
    wfState.getOriginatorData(originatorAddress, function endpointGetOriginatorCb(err, originatorState = null) {
        if (!err && !originatorState) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.originator = originatorAddress;
        if (!err && !originatorState.blockchain) err = new Error('Cannot determine blockchain for originator');
        if (err) return response.sendImperative(res, err, resBody, originatorState, callback);

        if (!err) {
            // Add metadata to response
            resBody.meta.blockchain = originatorState.blockchain;
            resBody.meta.account = accountAddress;

            // Get pre-shared key
            const keyId = hash(originatorState.blockchain + originatorAddress + accountAddress, KEYIDLENGTH);
            wfState.getKey('presharedKeys', keyId, function endpointGetOriginatorKeyCb(err, key) {
                if (!err && !key) err = new ProcessingError(`No pre-shared key with this originator avaliable for use with blockchain account ${accountAddress}`, null, 'WF_API_NO_RESOURCE');
                if (key) resBody.meta.keyId = keyId;
                key = undefined;
                return response.sendImperative(res, err, resBody, originatorState, callback);
            });
        }
    });
}

/**
 * Stores or updates pre-shared key for an originator
 * @function storePreSharedKey
 * @alias module:lib/endpoints/originators.storePreSharedKey
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function storePreSharedKey(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    const accountAddress = req.params.account;
    let psk = req.body.preSharedKey || null;
    let resBody = response.createBody(req, operationId);

    // Get originator and check for errors
    wfState.getOriginatorData(originatorAddress, function endpointGetOriginatorCb(err, originatorState = null) {
        if (!err && !originatorState) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.originator = originatorAddress;
        if (!err && !psk) err = new ProcessingError('No pre-shared key provided', null, 'WF_API_BAD_REQUEST');
        if (!err && !originatorState.blockchain) err = new Error('Cannot determine blockchain for originator');
        if (err) return response.sendImperative(res, err, resBody, originatorState, callback);

        // Check blockchain account
        wfState.getBlockchainData(originatorState.blockchain, function endpointGetBlockchainCb(err, blockchainState) {
            if (!err && !blockchainState) err = new Error(`Blockchain ${originatorState.blockchain} does not exist in state`);
            if (!err) {
                const index = blockchainState.accounts.findIndex(account => account.address.toLowerCase() === accountAddress.toLowerCase());
                if (index < 0) err = new ProcessingError(`Blockchain account ${accountAddress} does not exist`, null, 'WF_API_NO_RESOURCE');
            }
            // If no errors, store the pre-shared key (async)
            if (!err) {
                // Add metadata to response
                resBody.meta.blockchain = originatorState.blockchain;
                resBody.meta.account = accountAddress;

                // Store pre-shared key
                const keyId = hash(originatorState.blockchain + originatorAddress + accountAddress, KEYIDLENGTH);
                resBody.meta.keyId = keyId;
                wfState.storeKey('presharedKeys', keyId, psk);
                psk = undefined;
            }
            return response.sendImperative(res, err, resBody, originatorState, callback);
        });
    });
}

/**
 * Deletes pre-shared key for an originator
 * @function deletePreSharedKey
 * @alias module:lib/endpoints/originators.deletePreSharedKey
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function deletePreSharedKey(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    const accountAddress = req.params.account;
    let resBody = response.createBody(req, operationId);

    // Get originator and delete pre-shared key (async)
    wfState.getOriginatorData(originatorAddress, function endpointGetOriginatorCb(err, originatorState = null) {
        if (!err && !originatorState) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.originator = originatorAddress;
        if (!err && !originatorState.blockchain) err = new Error('Unknown blockchain for originator');
        if (!err) {
            // Add metadata to response
            resBody.meta.blockchain = originatorState.blockchain;
            resBody.meta.account = accountAddress;

            const keyId = hash(originatorState.blockchain + originatorAddress + accountAddress, KEYIDLENGTH);
            resBody.meta.keyId = keyId;
            wfState.removeKey('presharedKeys', keyId);
        }
        return response.sendImperative(res, err, resBody, originatorState, callback);
    });
}

/**
 * Stores an authentication token for an originator
 * @function storeAuthToken
 * @alias module:lib/endpoints/originators.storeAuthToken
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
// TODO: Add endpoint
// TODO: Update API definition
function storeAuthToken(req, res, operationId, callback) {
    let resBody = response.createBody(req, operationId);
    let errors = [];

    // Check token data
    let token = req.body.authToken;
    if (!token) errors.push('No authentication token provided');

    // Check and preserve originator data
    let originatorData = {};
    if (req.body.name) {
        originatorData.name = req.body.name;
    } else {
        errors.push('No originator name provided');
    }
    if (req.body.blockchain) {
        originatorData.blockchain = req.body.blockchain;
    } else {
        errors.push('No blockchain provided');
    }
    // Check for errors
    if (errors.length > 0) {
        let err = new ProcessingError('Incomplete data to store authentication token', errors, 'WF_API_BAD_REQUEST');
        return response.sendImperative(res, err, resBody, originatorData, callback);
    }
    // Store originator data and token
    const keyId = hash(originatorData.name + originatorData.blockchain + JSON.stringify(Date.now()), KEYIDLENGTH);
    originatorData.authTokenId = keyId;
    originatorData.authenticationValid = false;
    wfState.updateOriginatorData(originatorData);
    wfState.storeKey('authTokens', keyId, token);
    token = undefined;

    // Add metadata and send response
    resBody.meta.resource = `/originators/tokens/${keyId}`;
    response.sendImperative(res, null, resBody, originatorData, callback);
}
