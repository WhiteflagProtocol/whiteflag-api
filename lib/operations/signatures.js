'use strict';
/**
 * @module lib/operations/signatures
 * @summary Whiteflag API signatures endpoints handler module
 * @description Module with api signatures endpoint handlers
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    decode: decodeSignature,
    verify: verifySignature
};

// Common internal functions and classes //
const jws = require('../_common/jws');
const { createBody,
        sendIndicative } = require('./_common/response');

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
    let wfSignature;
    if (Object.hasOwn(req.body, 'jws')) {
        wfSignature = req.body.jws;
    } else {
        wfSignature = req.body;
    }
    /**
     * @callback endpointSignatureDecodeCb
     * @param {Error} err any error
     * @param {wfSignDecoded} wfSignDecoded the decoded signature
     */
    wfAuthenticate.decodeSignature(wfSignature, function opsSignatureDecodeCb(err, wfSignDecoded) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId);
        if (!err) resBody.meta.jws = jws.toCompact(wfSignature) || '';

        // Send response using common endpoint response function
        if (!err && !wfSignDecoded) err = new Error('Decoded signature is empty');
        return sendIndicative(res, err, resBody, wfSignDecoded, callback);
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
    /**
     * @callback endpointSignatureVerifyCb
     * @param {Error} err any error
     * @param {wfSignDecoded} wfSignDecoded the verified signature
     */
    wfAuthenticate.verifySignature(wfExtSignature, function opsSignatureVerifyCb(err, wfSignDecoded) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId);
        if (!err) {
            resBody.meta.blockchain = wfExtSignature.blockchain || '';
            resBody.meta.pubkey = wfExtSignature.pubkey || '';
            resBody.meta.jws = jws.toCompact(wfExtSignature.jws) || '';
        }
        // Send response using common endpoint response function
        if (!err && !wfSignDecoded) err = new Error('Verified signature is empty');
        return sendIndicative(res, err, resBody, wfSignDecoded, callback);
    });
}
