'use strict';
/**
 * @module lib/common/protocol
 * @summary Whiteflag API common protocol functions
 * @description Module with synchronous Whiteflag protocol functions
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    // Protocol functions
    type: messageType
};

// WHITELFAG MESSAGE OBJECT DEFINTION //
/**
 * A Whiteflag message object
 * @typedef {Object} wfMessage
 * @property {Object} MetaHeader Metaheader for Whiteflag messages as used by the Whiteflag API
 * @property {Object} MessageHeader Container for the message header fields, which are identical for all message types"
 * @property {Object} MessageBody Container for the message body, which depends on the message type
 */

// MAIN MODULE FUNCTIONS //
/**
 * Determines type of message
 * @function messageType
 * @alias module:lib/common/protocol.messageType
 * @param {wfMessage} wfMessage a Whiteflag message
 * @returns {string} message type
 */
function messageType(wfMessage) {
    // Check for valid message
    if (!wfMessage) return 'NULL';
    if (!wfMessage.MessageHeader) return 'INVALID';
    if (!wfMessage.MessageHeader.MessageCode) return 'unknown';
    const header = wfMessage.MessageHeader;

    // Check reference indicator
    let referenceCode = '';
    if (header.ReferenceIndicator) referenceCode = `(${header.ReferenceIndicator})`;

    // Determine message
    if (wfMessage.MessageBody) {
        const body = wfMessage.MessageBody;
        if (body.SubjectCode) return `${header.MessageCode}${body.SubjectCode}${referenceCode}`;
        if (body.CryptoDataType) return `${header.MessageCode}${body.CryptoDataType}${referenceCode}`;
        if (body.VerificationMethod) return `${header.MessageCode}${body.VerificationMethod}${referenceCode}`;
        if (body.ResourceMethod) return `${header.MessageCode}${body.ResourceMethod}${referenceCode}`;
    }
    return `${header.MessageCode}${referenceCode}`;
}
