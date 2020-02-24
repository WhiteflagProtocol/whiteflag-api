'use strict';
/**
 * @module lib/operations/tokens
 * @summary Whiteflag API tokens endpoints handler module
 * @description Module with api tokens endpoint handlers
 */
module.exports = {
    // Endpoint handler functions
    create: createToken
};

// Whiteflag common functions and classes //
const response = require('../common/httpres');
const { ProcessingError } = require('../common/errors');

// Whiteflag modules //
const wfAuthenticate = require('../protocol/authenticate');

// MAIN MODULE FUNCTIONS //

/**
 * Creates a Whiteflag authentication token
 * @function createToken
 * @alias module:lib/operations/tokens.createToken
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function createToken(req, res, operationId, callback) {
    let resBody = response.createBody(req, operationId);
    let resData = {};

    let errors = [];
    if (!req.body.blockchain) errors.push('No blockchain provided');
    if (!req.body.address) errors.push('No blockchain account address provided');
    if (!req.body.authToken) errors.push('No authentication token provided');
    if (errors.length > 0) {
        let err = new ProcessingError('Invalid authentication token data', errors, 'WF_API_BAD_REQUEST');
        return response.sendImperative(res, err, resBody, resData, callback);
    }
    wfAuthenticate.generateToken(req.body.authToken, req.body.address, req.body.blockchain, function endpointBlockchainsTokenCb(err, token) {
        // Send response using common endpoint response function
        if (!err) {
            resBody.meta.blockchain = req.body.blockchain;
            resBody.meta.account = req.body.address;
        }
        if (!err && !token) err = new Error('Could not obtain valid token for address');
        if (token) resData.VerificationData = token;
        return response.sendImperative(res, err, resBody, resData, callback);
    });
}
