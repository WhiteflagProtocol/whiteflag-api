'use strict';
/**
 * @module lib/operations/signatures
 * @summary Whiteflag API signatures endpoints handler module
 * @description Module with api signatures endpoint handlers
 * @tutorial openapi
 */
module.exports = {
    // Endpoint handler functions
    decode: decodeSignature,
    verify: verifySignature
};

// Whiteflag common functions and classes //
const response = require('../common/httpres');

// Whiteflag modules //
const wfAuthenticate = require('../protocol/authenticate');

// MAIN MODULE FUNCTIONS //
/**
 * Decodes a Whiteflag authentication signature
 * @function decodeSignature
 * @alias module:lib/operations/signatures.decode
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function decodeSignature(req, res, operationId, callback) {
    const wfSignature = req.body;
    wfAuthenticate.decodeSignature(wfSignature, function endpointSignatureDecodeCb(err, signatureDecoded) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);
        if (!err) resBody.meta.signature = wfSignature || {};

        // Send response using common endpoint response function
        if (!err && !signatureDecoded) err = new Error('Decoded signature is empty');
        return response.sendIndicative(res, err, resBody, signatureDecoded, callback);
    });
}

/**
 * Verifies a Whiteflag authentication signature
 * @function verifySignature
 * @alias module:lib/operations/signatures.verify
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function verifySignature(req, res, operationId, callback) {
    const wfExtSignature = req.body;
    wfAuthenticate.verifySignature(wfExtSignature, function endpointSignatureVerifyCb(err, signatureDecoded, originatorKeys) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);
        if (!err) resBody.meta.signature = wfExtSignature.wfSignature || {};
        if (!err) resBody.meta.keys = originatorKeys || {};

        // Send response using common endpoint response function
        if (!err && !signatureDecoded) err = new Error('Verified signature is empty');
        return response.sendIndicative(res, err, resBody, signatureDecoded, callback);
    });
}
