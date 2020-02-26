'use strict';
/**
 * @module lib/protocol/content
 * @summary Whiteflag message content validation module
 * @description Module for content verification functions
 */
module.exports = {
    // Message validation functions
    verify: verifyContent
};

// Node.js core and external modules //
const fs = require('fs');

// Whiteflag common functions and classes //
const log = require('../common/logger');
const array = require('../common/arrays');
const { ProtocolError } = require('../common/errors');

// Module constants //
const MODULELOG = 'content';
const wfMessageSchema = JSON.parse(fs.readFileSync('./lib/protocol/static/message.schema.json'));

// MAIN MODULE FUNCTIONS //
/**
 * Checks if message content is compliant with the WF specification
 * @function verifyContent
 * @alias module:lib/protocol/validation.verifyContent
 * @param {object} wfMessage a Whiteflag message
 * @param {function} callback function to be called upon completion
 */
function verifyContent(wfMessage, callback) {
    log.trace(MODULELOG, `Evaluating content of message ${wfMessage.MetaHeader.transactionHash}`);

    // Split message, get specification and prepare error array
    const { MessageHeader: header, MessageBody: body } = wfMessage;
    const wfSpec = wfMessageSchema.specifications;
    let contentErrors = [];

    // CHECK 1: is the subject code valid?
    const mesageTypeIndex = wfSpec.MessageCode.findIndex(
        mesageCode => mesageCode.const === header.MessageCode
    );
    if (mesageTypeIndex < 0) return callback(new Error(`Cannot validate content for non-existing message type: ${header.MessageCode}`));

    if (Object.prototype.hasOwnProperty.call(wfSpec.MessageCode[mesageTypeIndex], 'SubjectCode')) {
        const subjectCodeIndex = wfSpec.MessageCode[mesageTypeIndex](
            SubjectCode => SubjectCode.const === body.SubjectCode
        );
        if (subjectCodeIndex < 0) {
            contentErrors.push(`Subject code is note valid: ${body.SubjectCode}`);
        }
    }

    // CHECK 2: is the object code valid?

    // Evaluate and return result
    if (contentErrors.length > 0) {
        wfMessage.MetaHeader.validationErrors = array.addArray(wfMessage.MetaHeader.validationErrors, contentErrors);
        return callback(new ProtocolError('Invalid message reference', contentErrors, 'WF_REFERENCE_ERROR'));
    }
    return callback(null);
}
