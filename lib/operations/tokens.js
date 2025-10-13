'use strict';
/**
 * @module lib/operations/tokens
 * @summary Whiteflag API tokens endpoints handler module
 * @description Module with api tokens endpoint handlers
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    create: createToken
};

// Common internal functions and classes //
const { ProcessingError } = require('../_common/errors');
const { createBody,
        sendImperative } = require('../_common/httpres');

// Whiteflag modules //
const wfBlockchains = require('../blockchains');
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
    let resBody = createBody(req, operationId);
    let resData = {};

    let errors = [];
    if (!req.body.blockchain) errors.push('No blockchain provided');
    if (!req.body.address) errors.push('No blockchain account address provided');
    if (!req.body.secret) errors.push('No authentication token provided');
    if (errors.length > 0) {
        let err = new ProcessingError('Invalid authentication token data', errors, 'WF_API_BAD_REQUEST');
        return sendImperative(res, err, resBody, resData, callback);
    }
    wfBlockchains.getBinaryAddress(req.body.address, req.body.blockchain, function opsGetNinaryAddressCb(err, addressBuffer) {
        if (!err) {
            resBody.meta.blockchain = req.body.blockchain;
            resBody.meta.account = req.body.address;
        }
        if (!err && !addressBuffer) {
            err = new Error('Could not obtain binary representation of address');
            return sendImperative(res, err, resBody, resData, callback);
        }
        if (addressBuffer) resData.address = addressBuffer.toString('hex').toLowerCase();

        wfAuthenticate.generateToken(req.body.secret, req.body.address, req.body.blockchain, function opsBlockchainsTokenCb(err, token) {
            // Send response using common endpoint response function
            if (!err && !token) err = new Error('Could not obtain valid token for address');
            if (token) resData.VerificationData = token;
            return sendImperative(res, err, resBody, resData, callback);
        });
    });
}
