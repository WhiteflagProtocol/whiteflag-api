'use strict';
/**
 * @module lib/_common/jws
 * @summary Whiteflag API common JSON web signature module
 * @description Module for operations on JWS data structues
 * @tutorial modules
 */
module.exports = {
    concatinate,
    createEmpty,
    createFlattened,
    createSignInput,
    serializeSignInput,
    decode,
    toCompact,
    toFlattened,
    toFull,
    type,
    toBase64u,
    toObject
};

// Whiteflag common functions //
const { ProcessingError } = require('../_common/errors');
const { isObject,
        isString,
        base64uToString,
        stringToBase64u } = require('./encoding');

// Module constants //
const JWSTYPE_COMPACT = 'compact'
const JWSTYPE_FLAT = 'flat'
const JWSTYPE_FULL = 'full'
const JWSSEPARATOR = '.';

/**
 * Concatinates two parts of a compact serialized JWS
 * @param {string} part1 the firt part, e.g. compact serialized header and payload
 * @param {string} part2 the second part, e.g. the signature
 * @returns {string} a compact serialized string
 */
function concatinate(part1, part2) {
    return (part1 + JWSSEPARATOR + part2);
}

/**
 * Returns an new empty JWS structure
 * @function createEmpty
 * @alias module:lib/common/jws.createEmpty
 * @returns {Object} a JWS object
 */
function createEmpty() {
    return {
        protected: {},
        payload: {},
        signature: ''
    }
}

/**
 * Creates a flattened JWS object with serialsed values from input and signature
 * @param {string} input the compact serialized header and payload
 * @param {string} signature the signature
 * @returns {string} a flattened JWS object with serialsed values
 */
function createFlattened(input, signature) {
    return toFlattened(concatinate(input, signature));
}

/**
 * Creates the compact serialized string to be signed from a payload object
 * @function createSignInput
 * @alias module:lib/common/jws.createSignInput
 * @param {Object} payload the payload to be signed
 * @param {string} algorithm the identifier of the algorithm used to sign the payload
 * @param {boolean} time indicates whether or not to include timestamp
 * @returns {string} the compact serialized header and payload, ready to be signed
 */
function createSignInput(payload, algorithm, time = true) {
    let jws = createEmpty();
    jws.protected.alg = algorithm;
    jws.payload = payload;
    if (time) jws.payload.iat = Math.floor(Date.now()/1000);
    return serializeSignInput(jws);
}

/**
 * Extracts the compact serialized string from a JWS for verification
 * @function serializeSignInput
 * @alias module:lib/common/jws.serializeSignInput
 * @param {Object} jws a JSON Web Signature
 * @returns {string} the compact serialized header and payload, ready to be signed  
 */
function serializeSignInput(jws) {
    const jwsFlat = toFlattened(jws);
    return concatinate(jwsFlat.protected, jwsFlat.payload);
}

/**
 * Decodes and verifies a flattened JWS to a fully unserialized JWS
 * @function decode
 * @alias module:lib/common/jws.decode
 * @param {Object} jws a flattened JSON Web Signature with serialized values
 * @returns {Object} a fully
 * @throws {ProcessingError} if invalid JWS
 */
function decode(jws) {
    let jwsErrors = [];
    if (!isString(jws?.protected)) jwsErrors.push('Missing or not serialized property: protected');
    if (!isString(jws?.payload)) jwsErrors.push('Missing or not serialized property: payload');
    if (!isString(jws?.signature)) jwsErrors.push('Missing or not serialized property: signature');
    if (jwsErrors.length > 0) {
        throw new ProcessingError('Invalid JWS', jwsErrors, 'WF_API_BAD_REQUEST');
    }
    return toFull(jws);
}

/**
 * Transform a JWS to compact serialized string
 * @function toCompact
 * @alias module:lib/common/jws.toCompact
 * @param {Object} jws a JSON Web Signature
 * @returns {string} a JWS as a compact serialized string
 */
function toCompact(jws) {
    let jwsCompact = '';
    switch (type(jws)) {
        case JWSTYPE_COMPACT: {
            jwsCompact = jws;
            break;
        }
        case JWSTYPE_FLAT: {
            jwsCompact = jws.protected
                         + JWSSEPARATOR
                         + jws.payload;
            if (isString(jws.signature)) {
                jwsCompact = jwsCompact
                             + JWSSEPARATOR
                             + jws.signature
            }
            break;
        }
        case JWSTYPE_FULL: {
            jwsCompact = toBase64u(jws.protected)
                         + JWSSEPARATOR
                         + toBase64u(jws.payload);
            if (isString(jws.signature)) {
                jwsCompact = jwsCompact
                             + JWSSEPARATOR
                             + jws.signature
            }
            break;
        }
        default: {
            throw new Error('Cannot convert to compact JWS');
        }
    }
    return jwsCompact;
}

/**
 * Transforms a JWS to a flattened JWS object with serialsed values
 * @function toFlattened
 * @alias module:lib/common/jws.toFlattened
 * @param {Object} jws a JSON Web Signature
 * @returns {Object} a flattened JWS object with serialsed values
 */
function toFlattened(jws) {
    let jwsFlat = {};
    switch (type(jws)) {
        case JWSTYPE_COMPACT: {
            const jwsArray = jws.split(JWSSEPARATOR);
            if (jwsArray.length > 0) jwsFlat.protected = jwsArray[0];
            if (jwsArray.length > 1) jwsFlat.payload = jwsArray[1];
            if (jwsArray.length > 2) jwsFlat.signature = jwsArray[2];
            break;
        }
        case JWSTYPE_FLAT: {
            jwsFlat = jws;
            break;
        }
        case JWSTYPE_FULL: {
            jwsFlat.protected = toBase64u(jws.protected);
            jwsFlat.payload = toBase64u(jws.payload);
            jwsFlat.signature = jws.signature || '';
            break;
        }
        default: {
            throw new Error('Cannot convert to compact JWS');
        }
    }
    return jwsFlat;
}

/**
 * Transforms the provided JWS to a fully unserialized JWS object
 * @function toFull
 * @alias module:lib/common/jws.toFull
 * @param {*} jws a JSON Web Signature
 * @returns {Object} a fully unserialized JWS object
 */
function toFull(jws) {
    let jwsFull = {};
    switch (type(jws)) {
        case JWSTYPE_COMPACT: {
            const jwsArray = jws.split(JWSSEPARATOR);
            if (jwsArray.length > 0) jwsFull.protected = toObject(jwsArray[0]);
            if (jwsArray.length > 1) jwsFull.payload = toObject(jwsArray[1]);
            if (jwsArray.length > 2) jwsFull.signature = jwsArray[2];
            break;
        }
        case JWSTYPE_FLAT: {
            jwsFull.protected = toObject(jws.protected);
            jwsFull.payload = toObject(jws.payload);
            jwsFull.signature = jws.signature || '';
            break;
        }
        case JWSTYPE_FULL: {
            jwsFull = jws;
            break;
        }
        default: {
            throw new Error('Cannot convert to compact JWS');
        }
    }
    return jwsFull;
}

/**
 * Return the type of the provided JWS
 * @function type
 * @alias module:lib/common/jws.type
 * @param {*} jws a JSON Web Signature
 * @returns {string} One of "compact", "flat", "full"
 * @throws {ProcessingError} if invalid JWS
 */
function type(jws) {
    if (isString(jws)) {
        return JWSTYPE_COMPACT;
    }
    if (isObject(jws)) {
        if (isString(jws.protected) && isString(jws.payload)) {
            return JWSTYPE_FLAT;
        }
        if (isObject(jws.protected) && isObject(jws.payload)) {
            return JWSTYPE_FULL;
        }
    }
    throw new Error('Cannot determine JWS type');
}

/**
 * Creates a base64URL encoded JSON string from an object
 * @function toBase64u
 * @alias module:lib/common/jws.toBase64u
 * @param {Object} object the object to be encoded
 * @returns {string} a base64URL encoded JSON string
 */
function toBase64u(object) {
    return stringToBase64u(JSON.stringify(object));
}

/**
 * Creates an object from a base64URL encoded JSON string
 * @function toObject
 * @alias module:lib/common/jws.toObject
 * @param {string} base64u a base64URL encoded JSON string
 * @returns {Object} an object with the data from the JSON object
 */
function toObject(base64u) {
    return JSON.parse(base64uToString(base64u));
}
