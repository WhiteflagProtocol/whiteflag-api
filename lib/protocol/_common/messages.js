'use strict';
/**
 * @module lib/protocol/_common/messages
 * @summary Whiteflag API common protocol message functions
 * @description Module with synchronous Whiteflag message functions
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    getSchema: getMessageSchema,
    type: messageType,
    title: messageTitle,
    descr: messageDescription,
    spec: messageSpecification
};

/* Type definitions */
/**
 * A Whiteflag message object
 * @typedef {Object} wfMessage
 * @property {Object} MetaHeader Metaheader for Whiteflag messages as used by the Whiteflag API
 * @property {Object} MessageHeader Container for the message header fields, which are identical for all message types"
 * @property {Object} MessageBody Container for the message body, which depends on the message type
 */

/* Node.js core and external modules */
const fs = require('fs');

/* Module constants */
const WFSCHEMADIR = './static/protocol/';
const WFSCHEMAFILE = WFSCHEMADIR + 'message.schema.json';

/* Module objects */
/**
 * Whiteflag JSON message schema and specification
 * @typedef {Object} wfMsgSchema the configuration data object
 */
let _wfMsgSchema = {};

/* Module variables */
let _schemaFileRead = false;

/* MAIN MODULE FUNCTIONS */
/**
 * Reads, caches and returns the Whiteflag specification
 * @function getMessageSchema
 * @alias module:lib/protocol/_common/specification.getMessageSchema
 * @param {genericCb} [callback] function called on completion
 * @returns {wfSpec} the Whiteflag specification
 */
function getMessageSchema(callback) {
    try {
        if (!_schemaFileRead) {
            _wfMsgSchema = JSON.parse(fs.readFileSync(WFSCHEMAFILE));
            _schemaFileRead = true;
        }
    } catch(err) {
        if (!callback) throw err;
        return callback(err);
    }
    if (!callback) return _wfMsgSchema;
    return callback(null, _wfMsgSchema);
}

/**
 * Determines type of message
 * @function messageType
 * @alias module:lib/protocol/_common/messages.messageType
 * @param {wfMessage} wfMessage a Whiteflag message
 * @returns {string} the message type
 */
function messageType(wfMessage) {
    // Check for valid message
    if (!wfMessage) return 'NULL';
    if (!wfMessage.MessageHeader) return 'INVALID';
    if (!wfMessage.MessageHeader.MessageCode) return 'unknown';
    const { MessageHeader: header } = wfMessage;

    // Check reference indicator
    let referenceCode = '';
    if (header.ReferenceIndicator) referenceCode = `(${header.ReferenceIndicator})`;

    // Determine message subtype
    if (wfMessage.MessageBody) {
        const { MessageBody: body} = wfMessage;
        if (body.SubjectCode) return `${header.MessageCode}${body.SubjectCode}${referenceCode}`;
        if (body.CryptoDataType) return `${header.MessageCode}${body.CryptoDataType}${referenceCode}`;
        if (body.VerificationMethod) return `${header.MessageCode}${body.VerificationMethod}${referenceCode}`;
        if (body.ResourceMethod) return `${header.MessageCode}${body.ResourceMethod}${referenceCode}`;
    }
    return `${header.MessageCode}${referenceCode}`;
}

/**
 * Get the message tile
 * @function messageType
 * @alias module:lib/protocol/_common/messages.messageTitle
 * @param {wfMessage} wfMessage a Whiteflag message
 * @returns {string} the message title
 */
function messageTitle(wfMessage) {
    // Get message type specification
    const spec = messageSpecification(wfMessage);

    // Return title from specification
    if (spec?.title) return spec.title;
    return null;
}

/**
 * Get the message description
 * @function messageDescription
 * @alias module:lib/protocol/_common/messages.messageDescription
 * @param {wfMessage} wfMessage a Whiteflag message
 * @returns {string} the message description
 */
function messageDescription(wfMessage) {
    // Get message type specification
    const spec = messageSpecification(wfMessage);
    if (!spec) return null;

    // Get subtype specification for different message types
    const { MessageBody: body} = wfMessage;
    let subspec;
    switch (true) {
        case (Object.hasOwn(body, "SubjectCode")): {
            subspec = spec.SubjectCode.find(subtype => subtype.const === body.SubjectCode);
            break;
        }
        case (Object.hasOwn(body, "CryptoDataType")): {
            subspec = spec.CryptoDataType.find(subtype => subtype.const === body.CryptoDataType);
            break;
        }
        case (Object.hasOwn(body, "VerificationMethod")): {
            subspec = spec.VerificationMethod.find(subtype => subtype.const === body.VerificationMethod);
            break;
        }
        case (Object.hasOwn(body, "ResourceMethod")): {
            subspec = spec.ResourceMethod.find(subtype => subtype.const === body.ResourceMethod);
            break;
        }
        default: {
            //  Return description from type specification, if no subtype
            if (spec?.description) return spec.description.replace(/\.$/, '');
        }
    }
    // Return description from subtype specification
    if (subspec?.description) return subspec.description.replace(/\.$/, '');
    return null;
}

/**
 * Gets the message type specification
 * @function messageSpecification
 * @alias module:lib/protocol/_common/messages.messageSpecification
 * @param {wfMessage} wfMessage a Whiteflag message
 * @returns {Object} the specification of the message type
 */
function messageSpecification(wfMessage) {
    if (!wfMessage?.MessageHeader?.MessageCode) return null;
    const wfSpec = getMessageSchema().specifications;
    return wfSpec.MessageCode.find(type =>
        type.const === wfMessage.MessageHeader.MessageCode
    );
}
