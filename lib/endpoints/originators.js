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
    updateOriginator,
    deleteOriginator,
    getPreSharedKey,
    storePreSharedKey,
    deletePreSharedKey,
    getAuthToken,
    storeAuthToken,
    deleteAuthToken
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
    wfState.getOriginatorData(originatorAddress, function endpointGetOriginatorCb(err, originatorData = null) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err && !originatorData) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) {
            resBody.meta.originator = originatorAddress;
            resBody.meta.info = array.addItem(resBody.meta.info, 'Current originator state');
        }
        return response.sendIndicative(res, err, resBody, originatorData, callback);
    });
}

/**
 * Updates originator state data
 * @function updateOriginator
 * @alias module:lib/endpoints/originators.updateOriginator
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function updateOriginator(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    const originatorData = req.body;

    // Check if originator exists
    wfState.getOriginatorData(originatorAddress, function endpointUpdateOriginatorCb(err, data = null) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);

        // Check orginator data
        if (!err) {
            if (!data) {
                err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
            } else {
                resBody.meta.originator = originatorAddress;
            }
            // Add and check address for correct update
            if (!originatorData.address) originatorData.address = originatorAddress;
            if (originatorData.address !== originatorAddress) {
                err = new ProcessingError(`Different originator address in request body: ${originatorData.address}`, null, 'WF_API_BAD_REQUEST');
            }
        }
        // Upsert originator data
        if (!err) {
            resBody.meta.resource = `/originators/${originatorAddress}`;
            resBody.meta.info = array.addItem(resBody.meta.info, 'Accepted request to update originator');
            wfState.upsertOriginatorData(originatorData);
        }
        return response.sendIndicative(res, err, resBody, originatorData, callback);
    });
}

/**
 * Updates originator state data
 * @function deleteOriginator
 * @alias module:lib/endpoints/originators.deleteOriginator
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function deleteOriginator(req, res, operationId, callback) {
    const originatorAddress = req.params.address;

    // Check if originator exists
    wfState.getOriginatorData(originatorAddress, function endpointUpdateOriginatorCb(err, data = {}) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);

        // Check orginator data
        if (!err && !data) {
            err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        } else {
            resBody.meta.originator = originatorAddress;
        }
        // Delete originator data
        if (!err) {
            resBody.meta.info = array.addItem(resBody.meta.info, 'Accepted request to delete originator');
            wfState.removeOriginatorData(originatorAddress);
        }
        return response.sendIndicative(res, err, resBody, data, callback);
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
    wfState.getOriginatorData(originatorAddress, function endpointGetOriginatorCb(err, originatorData = null) {
        if (!err && !originatorData) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.originator = originatorAddress;
        if (!err && !originatorData.blockchain) err = new Error('Cannot determine blockchain for originator');
        if (err) return response.sendImperative(res, err, resBody, originatorData, callback);

        if (!err) {
            // Add metadata to response
            resBody.meta.blockchain = originatorData.blockchain;
            resBody.meta.account = accountAddress;

            // Get pre-shared key
            const keyId = hash(originatorData.blockchain + originatorAddress + accountAddress, KEYIDLENGTH);
            wfState.getKey('presharedKeys', keyId, function endpointGetOriginatorKeyCb(err, key) {
                if (!err && !key) err = new ProcessingError(`No pre-shared key with this originator available for use with blockchain account ${accountAddress}`, null, 'WF_API_NO_RESOURCE');
                if (key) {
                    resBody.meta.keyId = keyId;
                    if (!err) {
                        resBody.meta.info = array.addItem(resBody.meta.info, 'Pre-shared key exists for this account and originator');
                        resBody.meta.info = array.addItem(resBody.meta.info, 'Returning originator data related to pre-shared key');
                    }
                }
                key = undefined;
                return response.sendImperative(res, err, resBody, originatorData, callback);
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
    req.body.preSharedKey = undefined;
    let resBody = response.createBody(req, operationId);

    // Get originator and check for errors
    wfState.getOriginatorData(originatorAddress, function endpointGetOriginatorCb(err, originatorData = null) {
        if (!err && !originatorData) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.originator = originatorAddress;
        if (!err && !psk) err = new ProcessingError('No pre-shared key provided', null, 'WF_API_BAD_REQUEST');
        if (!err && !originatorData.blockchain) err = new Error('Cannot determine blockchain for originator');
        if (err) return response.sendImperative(res, err, resBody, originatorData, callback);

        // Check blockchain account
        wfState.getBlockchainData(originatorData.blockchain, function endpointGetBlockchainCb(err, blockchainState) {
            if (!err && !blockchainState) err = new Error(`Blockchain ${originatorData.blockchain} does not exist in state`);
            if (!err) {
                const index = blockchainState.accounts.findIndex(account => account.address.toLowerCase() === accountAddress.toLowerCase());
                if (index < 0) err = new ProcessingError(`Blockchain account ${accountAddress} does not exist`, null, 'WF_API_NO_RESOURCE');
            }
            // If no errors, store the pre-shared key (async)
            if (!err) {
                // Add metadata to response
                resBody.meta.blockchain = originatorData.blockchain;
                resBody.meta.account = accountAddress;
                resBody.meta.resource = `/originators/${originatorAddress}/psk/${accountAddress}`;

                // Store pre-shared key
                const keyId = hash(originatorData.blockchain + originatorAddress + accountAddress, KEYIDLENGTH);
                resBody.meta.keyId = keyId;
                resBody.meta.info = array.addItem(resBody.meta.info, 'Accepted request to store pre-shared key');
                wfState.upsertKey('presharedKeys', keyId, psk);
                psk = undefined;
            }
            return response.sendImperative(res, err, resBody, originatorData, callback);
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
    wfState.getOriginatorData(originatorAddress, function endpointGetOriginatorCb(err, originatorData = null) {
        if (!err && !originatorData) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.originator = originatorAddress;
        if (!err && !originatorData.blockchain) err = new Error('Unknown blockchain for originator');
        if (!err) {
            // Add metadata to response
            resBody.meta.blockchain = originatorData.blockchain;
            resBody.meta.account = accountAddress;

            // Determine key id and remove key
            const keyId = hash(originatorData.blockchain + originatorAddress + accountAddress, KEYIDLENGTH);
            resBody.meta.keyId = keyId;
            resBody.meta.info = array.addItem(resBody.meta.info, 'Accepted request to delete pre-shared key');
            wfState.removeKey('presharedKeys', keyId);
        }
        return response.sendImperative(res, err, resBody, originatorData, callback);
    });
}

/**
 * Checks for an authentication token of an originator
 * @function getAuthToken
 * @alias module:lib/endpoints/originators.getAuthToken
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getAuthToken(req, res, operationId, callback) {
    const authTokenId = req.params.authTokenId;
    let resBody = response.createBody(req, operationId);

    // Get authentication token
    wfState.getKey('authTokens', authTokenId, function getAuthTokenGetKeyCb(err, existingAuthToken) {
        if (!err && !existingAuthToken) {
            err = new ProcessingError(`No authentication token with token id ${authTokenId}`, null, 'WF_API_NO_RESOURCE');
            return response.sendImperative(res, err, resBody, null, callback);
        }
        existingAuthToken = undefined;
        resBody.meta.authTokenId = authTokenId;
        resBody.meta.info = array.addItem(resBody.meta.info, 'Authentication token exists');

        // Get originator data and send response
        wfState.getOriginatorAuthToken(authTokenId, function getOriginatorAuthTokenCb(err, originatorData) {
            if (!err && !originatorData) {
                err = new ProcessingError(`No originator found for token id ${authTokenId}`, null, 'WF_API_NO_DATA');
            }
            if (!err) resBody.meta.info = array.addItem(resBody.meta.info, 'Returning originator data for authentication token');
            return response.sendImperative(res, err, resBody, originatorData, callback);
        });
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
function storeAuthToken(req, res, operationId, callback) {
    let authToken = req.body.authToken || null;
    req.body.authToken = undefined;
    let originatorData = {};
    let resBody = response.createBody(req, operationId);

    // Check for errors
    let errors = [];
    if (!authToken) errors.push('No authentication token provided');
    if (!req.body.name) errors.push('No originator name provided');
    if (!req.body.blockchain) errors.push('No blockchain provided');
    if (errors.length > 0) {
        let err = new ProcessingError('Invalid authentication token data', errors, 'WF_API_BAD_REQUEST');
        return response.sendImperative(res, err, resBody, originatorData, callback);
    }
    // Check for existing authentication token
    const authTokenId = hash(originatorData.blockchain + authToken, KEYIDLENGTH);
    resBody.meta.authTokenId = authTokenId;
    resBody.meta.resource = `/originators/tokens/${authTokenId}`;
    wfState.getKey('authTokens', authTokenId, function storeAuthTokenGetKeyCb(err, existingAuthToken) {
        // Check for errors and existing authentication token
        if (err || existingAuthToken) {
            existingAuthToken = undefined;
            if (!err) err = new ProcessingError('Authentication token already exists', null, 'WF_API_RESOURCE_CONFLICT');
            return response.sendImperative(res, err, resBody, originatorData, callback);
        }
        // Store token
        resBody.meta.info = array.addItem(resBody.meta.info, 'Accepted request to store authentication token');
        wfState.upsertKey('authTokens', authTokenId, authToken);
        authToken = undefined;

        // Store originator data
        originatorData.name = req.body.name;
        originatorData.blockchain = req.body.blockchain;
        if (req.body.address) originatorData.address = req.body.address;
        originatorData.authTokenId = authTokenId;
        wfState.upsertOriginatorData(originatorData);

        // Send response
        return response.sendImperative(res, err, resBody, originatorData, callback);
    });
}

/**
 * Deletes an authentication token of an originator
 * @function deleteAuthToken
 * @alias module:lib/endpoints/originators.deleteAuthToken
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function deleteAuthToken(req, res, operationId, callback) {
    const authTokenId = req.params.authTokenId;
    let resBody = response.createBody(req, operationId);

    // Check if key exists before deleting
    wfState.getKey('authTokens', authTokenId, function getAuthTokenGetKeyCb(err, existingAuthToken) {
        if (!err && !existingAuthToken) {
            err = new ProcessingError(`No authentication token with token id ${authTokenId}`, null, 'WF_API_NO_RESOURCE');
            return response.sendImperative(res, err, resBody, null, callback);
        }
        existingAuthToken = undefined;
        resBody.meta.authTokenId = authTokenId;

        // Get originator data before deleting
        wfState.getOriginatorAuthToken(authTokenId, function getOriginatorAuthTokenCb(err, originatorData) {
            if (!originatorData) originatorData = {};
            if (!err) {
                resBody.meta.info = array.addItem(resBody.meta.info, 'Accepted request to delete authentication token');
                wfState.removeOriginatorAuthToken(authTokenId);
            }
            return response.sendImperative(res, err, resBody, originatorData, callback);
        });
    });
}
