'use strict';
/**
 * @module lib/operations/originators
 * @summary Whiteflag API originators endpoints handler module
 * @description Module with api originators endpoint handlers
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    getAllOriginators,
    getOriginator,
    updateOriginator,
    deleteOriginator,
    getPreSharedKey,
    storePreSharedKey,
    deletePreSharedKey
};

/* Common internal functions and classes */
const arr = require('../_common/arrays');
const { hash } = require('../_common/crypto');
const { ProcessingError } = require('../_common/errors');
const { createBody,
        sendImperative,
        sendIndicative } = require('./_common/response');

/* Whiteflag modules */
const wfState = require('../protocol/state');

/* Module constants */
const RSC_ORIGINATOR = 'originator';
const RSC_PSK = 'psk';
const KEYIDLENGTH = 12;

/* MAIN MODULE FUNCTIONS */
/**
 * Provides current state of all originators from state module
 * @function getAllOriginators
 * @alias module:lib/operations/originators.getAllOriginators
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getAllOriginators(req, res, operationId, callback) {
    wfState.getOriginators(function opsGetOriginatorsCb(err, originatorsState = null) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId, RSC_ORIGINATOR);

        // Send response using common endpoint response function
        if (!err && !originatorsState) err = new Error('Could not retrieve known originators from state');
        if (originatorsState) resBody.meta.info = arr.addItem(resBody.meta.info, 'Currently known originators');
        return sendIndicative(res, err, resBody, originatorsState, callback);
    });
}

/**
 * Provides current originator state from state module
 * @function getOriginator
 * @alias module:lib/operations/originators.getOriginator
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getOriginator(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    wfState.getOriginatorData(originatorAddress, function opsGetOriginatorCb(err, originatorData = null) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId, RSC_ORIGINATOR);

        // Send response using common endpoint response function
        if (!err && !originatorData) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) {
            if (originatorData.blockchain) resBody.meta.related = {
                blockchain: originatorData.blockchain
            }
            resBody.meta.resource.id = originatorAddress;
            resBody.meta.info = arr.addItem(resBody.meta.info, 'Current originator state');
        }
        return sendIndicative(res, err, resBody, originatorData, callback);
    });
}

/**
 * Updates originator state data
 * @function updateOriginator
 * @alias module:lib/operations/originators.updateOriginator
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function updateOriginator(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    const originatorData = req.body;
    wfState.getOriginatorData(originatorAddress, function opsUpdateOriginatorCb(err, data = null) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId, RSC_ORIGINATOR);

        // Check orginator data
        if (!err) {
            if (!data) {
                err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
            } else {
                resBody.meta.resource.id = originatorAddress;
            }
            // Add and check address for correct update
            if (!originatorData.address) originatorData.address = originatorAddress;
            if (originatorData.address !== originatorAddress) {
                err = new ProcessingError(`Different originator address in request body: ${originatorData.address}`, null, 'WF_API_BAD_REQUEST');
            }
        }
        // Upsert originator data
        if (!err) {
            if (originatorData.blockchain) resBody.meta.related = {
                blockchain: originatorData.blockchain
            }
            resBody.meta.info = arr.addItem(resBody.meta.info, 'Accepted request to update originator');
            wfState.upsertOriginatorData(originatorData);
        }
        return sendIndicative(res, err, resBody, originatorData, callback);
    });
}

/**
 * Updates originator state data
 * @function deleteOriginator
 * @alias module:lib/operations/originators.deleteOriginator
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function deleteOriginator(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    wfState.getOriginatorData(originatorAddress, function opsUpdateOriginatorCb(err, originatorData) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId, RSC_ORIGINATOR);

        // Check and delete orginator data
        if (!err && !originatorData) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err) {
            resBody.meta.resource.id = originatorAddress;
            if (originatorData.blockchain) resBody.meta.related = {
                blockchain: originatorData.blockchain
            }
            resBody.meta.info = arr.addItem(resBody.meta.info, 'Accepted request to delete originator');
            wfState.removeOriginatorData(originatorAddress);
        }
        return sendIndicative(res, err, resBody, originatorData, callback);
    });
}

/**
 * Checks for pre-shared key for an originator
 * @function getPreSharedKey
 * @alias module:lib/operations/originators.getPreSharedKey
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getPreSharedKey(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    const accountAddress = req.params.account;
    let resBody = createBody(req, operationId, RSC_PSK);

    // Get originator and check for errors
    wfState.getOriginatorData(originatorAddress, function opsGetOriginatorCb(err, originatorData = null) {
        if (!err && !originatorData) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err && !originatorData.blockchain) err = new Error('Could not determine blockchain for originator');
        if (err) return sendImperative(res, err, resBody, originatorData, callback);

        // Add metadata to response
        resBody.meta.related = {
            blockchain: originatorData.blockchain,
            originator: originatorAddress,
            account: accountAddress
        }
        // Get pre-shared key
        const keyId = hash(originatorData.blockchain + originatorAddress + accountAddress, KEYIDLENGTH);
        wfState.getKey('presharedKeys', keyId, function opsGetOriginatorKeyCb(err, key) {
            if (!err && !key) err = new ProcessingError(`No pre-shared key with this originator available for use with blockchain account ${accountAddress}`, null, 'WF_API_NO_RESOURCE');
            if (key) {
                resBody.meta.resource.id = keyId;
                if (!err) {
                    resBody.meta.info = arr.addItem(resBody.meta.info, 'Pre-shared key exists for this account and originator');
                    resBody.meta.info = arr.addItem(resBody.meta.info, 'Returning originator data related to pre-shared key');
                }
            }
            key = null;
            return sendImperative(res, err, resBody, originatorData, callback);
        });
    });
}

/**
 * Stores or updates pre-shared key for an originator
 * @function storePreSharedKey
 * @alias module:lib/operations/originators.storePreSharedKey
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function storePreSharedKey(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    const accountAddress = req.params.account;
    let resBody = createBody(req, operationId, RSC_PSK);
    let psk = req.body.preSharedKey || null;
    req.body.preSharedKey = null;

    // Get originator and check for errors
    wfState.getOriginatorData(originatorAddress, function opsGetOriginatorCb(err, originatorData = null) {
        if (!err && !originatorData) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err && !psk) err = new ProcessingError('No pre-shared key provided', null, 'WF_API_BAD_REQUEST');
        if (!err && !originatorData.blockchain) err = new Error('Could not determine blockchain for originator');
        if (err) return sendImperative(res, err, resBody, originatorData, callback);

        // Check blockchain account
        wfState.getBlockchainData(originatorData.blockchain, function opsGetBlockchainCb(err, bcState) {
            if (!err && !bcState) err = new Error(`Blockchain ${originatorData.blockchain} does not exist in state`);
            if (!err) {
                const index = bcState.accounts.findIndex(account => account.address.toLowerCase() === accountAddress.toLowerCase());
                if (index < 0) err = new ProcessingError(`Blockchain account ${accountAddress} does not exist`, null, 'WF_API_NO_RESOURCE');
            }
            // If no errors, store the pre-shared key (async)
            if (!err) {
                // Add metadata to response
                resBody.meta.related = {
                    blockchain: originatorData.blockchain,
                    originator: originatorAddress,
                    account: accountAddress
                }
                // Determine key id and store key
                const keyId = hash(originatorData.blockchain + originatorAddress + accountAddress, KEYIDLENGTH);
                resBody.meta.resource.id = keyId;
                resBody.meta.info = arr.addItem(resBody.meta.info, 'Accepted request to store pre-shared key');
                wfState.upsertKey('presharedKeys', keyId, psk);
                psk = null;
            }
            return sendImperative(res, err, resBody, originatorData, callback);
        });
    });
}

/**
 * Deletes pre-shared key for an originator
 * @function deletePreSharedKey
 * @alias module:lib/operations/originators.deletePreSharedKey
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function deletePreSharedKey(req, res, operationId, callback) {
    const originatorAddress = req.params.address;
    const accountAddress = req.params.account;
    let resBody = createBody(req, operationId, RSC_PSK);

    // Get originator and delete pre-shared key
    wfState.getOriginatorData(originatorAddress, function opsGetOriginatorCb(err, originatorData = null) {
        if (!err && !originatorData) err = new ProcessingError(`Unknown originator: ${originatorAddress}`, null, 'WF_API_NO_RESOURCE');
        if (!err && !originatorData.blockchain) err = new Error('Unknown blockchain for originator');
        if (!err) {
            // Add metadata to response
            resBody.meta.related = {
                blockchain: originatorData.blockchain,
                originator: originatorAddress,
                account: accountAddress
            }
            // Determine key id and remove key
            const keyId = hash(originatorData.blockchain + originatorAddress + accountAddress, KEYIDLENGTH);
            resBody.meta.resource.id = keyId;
            resBody.meta.info = arr.addItem(resBody.meta.info, 'Accepted request to delete pre-shared key');
            wfState.removeKey('presharedKeys', keyId);
        }
        return sendImperative(res, err, resBody, originatorData, callback);
    });
}
