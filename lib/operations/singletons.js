'use strict';
/**
 * @module lib/operations/singletons
 * @summary Whiteflag API messages endpoints handler module
 * @description Module with api messages endpoint handlers
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    validateMessage,
    encodeMessage,
    decodeMessage,
    decodeSignature,
    verifySignature,
    verifyToken
};

/* Common internal functions and classes */
const arr = require('../_common/arrays');
const jws = require('../_common/jws');
const { ProcessingError } = require('../_common/errors');
const { createBody,
        addRelatedResource,
        addMessageData,
        sendImperative,
        sendIndicative } = require('./_common/response');

/* Whiteflag modules */
const wfAuthenticate = require('../protocol/authenticate');
const wfBlockchains = require('../blockchains');
const wfReference = require('../protocol/references');
const wfCodec = require('../protocol/codec');

/* Module constants */
const R_MESSAGE = 'message';
const R_SIGNATURE = 'signature';
const R_TOKEN = 'token';

/* MAIN MODULE FUNCTIONS */
/**
 * Encodes a Whiteflag message
 * @function encodeMessage
 * @alias module:lib/operations/singletons.encodeMessage
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function encodeMessage(req, res, operationId, callback) {
    const wfMessage = req.body;
    wfCodec.encode(wfMessage, function opsEncodeCb(err, wfMessage) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId, R_MESSAGE);
        if (!err) resBody.meta = addMessageData(wfMessage, resBody.meta);

        // Send response using common endpoint response function
        return sendImperative(res, err, resBody, wfMessage, callback);
    });
}

/**
 * Decodes a Whiteflag message
 * @function decodeMessage
 * @alias module:lib/operations/singletons.decodeMessage
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function decodeMessage(req, res, operationId, callback) {
    // Do not complain if plain metaheader provided
    let wfMessage = {};
    if (Object.hasOwn(req.body, 'MetaHeader')) {
        wfMessage = req.body;
    } else {
        wfMessage.MetaHeader = req.body;
    }
    wfCodec.decode(wfMessage, function opsDecodeCb(err, wfMessage, ivMissing) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId, R_MESSAGE);

        // Check for missing decryption key
        if (err?.code === 'WF_ENCRYPTION_ERROR' && !wfMessage.MetaHeader.encryptionKeyInput) {
            err = new ProcessingError('Could not decrypt message', [ 'Encryption key input is missing', err.message ], 'WF_API_BAD_REQUEST');
        }
        // Check for missing intitialisation vector
        if (!err && ivMissing) {
            err = new ProcessingError('Could not decrypt message', [ 'Initialisation vector is missing' ], 'WF_API_BAD_REQUEST');
        }
        // Add message info to meta data
        if (!err) resBody.meta = addMessageData(wfMessage, resBody.meta);

        // Send response using common endpoint response function
        return sendImperative(res, err, resBody, wfMessage, callback);
    });
}

/**
 * Checks whether a Whiteflag message is valid
 * @function validateMessage
 * @alias module:lib/operations/singletons.validateMessage
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function validateMessage(req, res, operationId, callback) {
    const wfMessage = req.body;
    wfCodec.verifyFormat(wfMessage, function opsVerifyFormatCb(err, wfMessage) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId, R_MESSAGE);
        if (err) return sendIndicative(res, err, resBody, wfMessage, callback);

        // Verify message reference
        wfReference.verify(wfMessage, function opsVerifyReferenceCb(err, wfMessage) {
            if (!err) resBody.meta = addMessageData(wfMessage, resBody.meta);
            return sendIndicative(res, err, resBody, wfMessage, callback);
        });
    });
}

/**
 * Decodes a Whiteflag authentication signature
 * @function decodeSignature
 * @alias module:lib/operations/singletons.decode
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function decodeSignature(req, res, operationId, callback) {
    let wfSignature = {};
    // If extended signature, extract signature without complaining
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
        let resBody = createBody(req, operationId, R_SIGNATURE);

        // Send response using common endpoint response function
        if (!err && !wfSignDecoded) err = new Error('Decoded signature is empty');
        if (!err) {
            resBody.meta = addRelatedResource(null, null, wfSignDecoded.payload.addr, resBody.meta);
            resBody.meta.info = arr.addItem(resBody.meta.info, `Decoded Whiteflag authentication signature`);
        }
        return sendIndicative(res, err, resBody, wfSignDecoded, callback);
    });
}

/**
 * Verifies a Whiteflag authentication signature
 * @function verifySignature
 * @alias module:lib/operations/singletons.verify
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
        let resBody = createBody(req, operationId, R_SIGNATURE);

        // Send response using common endpoint response function
        if (!err && !wfSignDecoded) err = new Error('Verified signature is empty');
        if (!err) {
            resBody.meta = addRelatedResource(wfExtSignature.blockchain, null, wfSignDecoded.payload.addr, resBody.meta);
            resBody.meta.info = arr.addItem(resBody.meta.info, `Verified Whiteflag authentication signature`);
        }
        return sendIndicative(res, err, resBody, wfSignDecoded, callback);
    });
}

/**
 * Returns verification data for a Whiteflag authentication token
 * @function verifyToken
 * @alias module:lib/operations/singletons.verifyToken
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function verifyToken(req, res, operationId, callback) {
    let resBody = createBody(req, operationId, R_TOKEN);
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
        if (!err && !addressBuffer) {
            err = new Error('Could not obtain binary representation of address');
            return sendImperative(res, err, resBody, resData, callback);
        }
        if (addressBuffer) resData.binaryAddress = addressBuffer.toString('hex').toLowerCase();

        wfAuthenticate.generateToken(req.body.secret, req.body.address, req.body.blockchain, function opsBlockchainsTokenCb(err, token) {
            // Send response using common endpoint response function
            if (!err && !token) err = new Error('Could not obtain valid token for address');
            if (!err) {
                resBody.meta = addRelatedResource(req.body.blockchain, null, req.body.address, resBody.meta);
                resData.VerificationData = token;
                if (!err && token) resBody.meta.info = arr.addItem(resBody.meta.info, `Verificaton data for a Whiteflag authentication token`);
            }
            return sendImperative(res, err, resBody, resData, callback);
        });
    });
}
