'use strict';
/**
 * @module lib/operations/tokens
 * @summary Whiteflag API tokens endpoints handler module
 * @description Module with api tokens endpoint handlers
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    // Endpoint handler functions
    create: createToken
};

// Common internal functions and classes //
const response = require('../_common/httpres');
const { ProcessingError } = require('../_common/errors');

// Whiteflag modules //
const wfApiBlockchains = require('../blockchains');
const wfAuthenticate = require('../protocol/authenticate');

// MAIN MODULE FUNCTIONS //

/**
 * Creates a Whiteflag authentication token
 * @function createToken
 * @alias module:lib/operations/tokens.createToken
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function createToken(req, res, operationId, callback) {
    let resBody = response.createBody(req, operationId);
    let resData = {};

    let errors = [];
    if (!req.body.blockchain) errors.push('No blockchain provided');
    if (!req.body.address) errors.push('No blockchain account address provided');
    if (!req.body.secret) errors.push('No authentication token provided');
    if (errors.length > 0) {
        let err = new ProcessingError('Invalid authentication token data', errors, 'WF_API_BAD_REQUEST');
        return response.sendImperative(res, err, resBody, resData, callback);
    }
    wfApiBlockchains.getBinaryAddress(req.body.address, req.body.blockchain, function endpointGetNinaryAddressCb(err, addressBuffer) {
        if (!err) {
            resBody.meta.blockchain = req.body.blockchain;
            resBody.meta.account = req.body.address;
        }
        if (!err && !addressBuffer) err = new Error('Could not obtain binary representation of address');
        if (addressBuffer) resData.address = addressBuffer.toString('hex').toLowerCase();

        wfAuthenticate.generateToken(req.body.secret, req.body.address, req.body.blockchain, function endpointBlockchainsTokenCb(err, token) {
            // Send response using common endpoint response function
            if (!err && !token) err = new Error('Could not obtain valid token for address');
            if (token) resData.VerificationData = token;
            return response.sendImperative(res, err, resBody, resData, callback);
        });
    });
}
