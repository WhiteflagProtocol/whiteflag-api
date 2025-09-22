'use strict';
/**
 * @module lib/_common/jws
 * @summary Whiteflag API common JSON web signature module
 * @description Module for operations on JWS data structues
 * @tutorial modules
 */
module.exports = {
    // JWS functions
    create,
    createSignInput,
    extractSignInput,
    toCompact,
    toFlattened,
    toFull,
    type,
    toBase64u,
    toObject
};

// Whiteflag common functions //
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
 * Returns an new empty JWS structure
 * @function create
 * @alias module:lib/common/jws.create
 * @returns {Object} a JWS object
 */
function create() {
    return {
        protected: {},
        payload: {},
        signature: ''
    }
}

/**
 * Creates the compact serialized string to be signed from a payload object
 * @function createSignInput
 * @alias module:lib/common/jws.createSignInput
 * @param {Object} payload the payload to be signed
 * @param {string} algorithm the identifier of the algorithm used to sign the payload 
 * @returns {string} the compact serialized header and payload, ready to be signed  
 */
function createSignInput(payload, algorithm) {
    let jws = create();
    jws.protected.alg = algorithm;
    jws.payload = payload;
    return serializeSignInput(jws);
}

/**
 * Extracts the compact serialized string from a JWS for verification
 * @function extractSignInput
 * @alias module:lib/common/jws.extractSignInput
 * @param {Object} jws a JSON Web Signature
 * @returns {string} the compact serialized header and payload, ready to be signed  
 */
function extractSignInput(jws) {
    let jwsFull = toFull(jws)
    return serializeSignInput(jwsFull);
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
            return null;
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
            return null;
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
            return null;
        }
    }
    return jwsFull;
}

/**
 * Return the type of the provided JWS
 * @function type
 * @alias module:lib/common/jws.type
 * @param {*} jws a JSON Web Signature 
 * @returns {string} One of "compact", "flat", "full", or null
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
    return null
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

// PRIVATE FUNCTIONS //
/**
 * Serializes the protected header and payload
 * @private
 * @param {Object} jwsFull a full JWS object
 * @returns {string} a compact serialized input for signature 
 */
function serializeSignInput(jwsFull) {
    // SIGN(ASCII(BASE64URL(UTF8(protected)) || ‘.’ || BASE64URL(payload)))
    return (
        stringToBase64u(JSON.stringify(jwsFull.protected))
        + JWSSEPARATOR
        + stringToBase64u(JSON.stringify(jwsFull.payload))
    );
}
