'use strict';
/**
 * @module lib/common/protocol
 * @summary Whiteflag API common protocol functions
 * @description Module with synchronous Whiteflag protocol functions
 */
module.exports = {
    // Protocol functions
    type: messageType
};

// MAIN MODULE FUNCTIONS //
/**
 * Determines type of message
 * @function messageType
 * @alias module:lib/common/protocol.messageType
 * @returns {string} message type
 */
function messageType(wfMessage) {
    // Check for valid message
    if (!wfMessage) return 'NULL';
    if (!wfMessage.MessageHeader) return 'INVALID';
    if (!wfMessage.MessageHeader.MessageCode) return 'unknown';

    // Check reference indicator
    let referenceCode = '';
    if (wfMessage.MessageHeader.ReferenceIndicator) referenceCode = `(${wfMessage.MessageHeader.ReferenceIndicator})`;

    // Determine message
    if (wfMessage.MessageBody) {
        if (wfMessage.MessageBody.SubjectCode) return `${wfMessage.MessageHeader.MessageCode}${wfMessage.MessageBody.SubjectCode}${referenceCode}`;
        if (wfMessage.MessageBody.CryptoDataType) return `${wfMessage.MessageHeader.MessageCode}${wfMessage.MessageBody.CryptoDataType}${referenceCode}`;
        if (wfMessage.MessageBody.VerificationMethod) return `${wfMessage.MessageHeader.MessageCode}${wfMessage.MessageBody.VerificationMethod}${referenceCode}`;
        if (wfMessage.MessageBody.ResourceMethod) return `${wfMessage.MessageHeader.MessageCode}${wfMessage.MessageBody.ResourceMethod}${referenceCode}`;
    }
    return `${wfMessage.MessageHeader.MessageCode}${referenceCode}`;
}
