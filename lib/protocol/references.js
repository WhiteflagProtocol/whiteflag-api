'use strict';
/**
 * @module lib/protocol/references
 * @summary Whiteflag message reference validation module
 * @description Module for reference verification functions
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    verify: verifyReference
};

// Node.js core and external modules //
const fs = require('fs');

// Common internal functions and classes //
const arr = require('../_common/arrays');
const log = require('../_common/logger');
const { ProtocolError } = require('../_common/errors');
const { type } = require('./_common/messages');

// Whiteflag modules //
const wfRetrieve = require('./retrieve');

// Module constants //
const MODULELOG = 'references';
const TESTMESSAGECODE = 'T';
const wfMessageSchema = JSON.parse(fs.readFileSync('./static/protocol/message.schema.json'));

// MAIN MODULE FUNCTIONS //
/**
 * Checks if message references antother message correclty and updates metaheader accordingly
 * @function verifyReference
 * @alias module:lib/protocol/validation.verifyReference
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function called on completion
 */
function verifyReference(wfMessage, callback) {
    // Check message metaheader
    if (!wfMessage?.MetaHeader) {
        return callback(new ProtocolError('Missing metaheader', null, 'WF_METAHEADER_ERROR'), wfMessage);
    }
    let { MetaHeader: meta } = wfMessage;

    // Check message header
    if (!wfMessage.MessageHeader) {
        meta.formatValid = false;
        return callback(new ProtocolError('Missing message header', null, 'WF_FORMAT_ERROR'), wfMessage);
    }
    let { MessageHeader: header } = wfMessage;

    // If rerference indcator is 0, then referenced transcation hash may be anything
    if (header.ReferenceIndicator === '0') {
        meta.referenceValid = true;
        return callback(null, wfMessage);
    }
    // Message referenced; but no transaction hash
    if (/^0{64}$/.test(header.ReferencedMessage)) {
        const refError = 'Missing transaction hash of referenced message';
        meta.referenceValid = false;
        meta.validationErrors = arr.addItem(meta.validationErrors, refError);
        return callback(new ProtocolError(refError, null, 'WF_REFERENCE_ERROR'), wfMessage);
    }
    // Retrieve referenced message and validate reference
    wfRetrieve.getMessage(header.ReferencedMessage, meta.blockchain,
        function verifyReferenceRetrieveCb(err, refMessages) {
            // Return if referenced message cannot be retrieved
            if (err) return callback(err, wfMessage);
            if (refMessages.length === 0) return callback(new Error('Could not retrieve referenced message'), wfMessage);

            // Call evaluation function and return result
            evaluateReference(wfMessage, refMessages[0], function verifyReferenceEvalCb(err) {
                if (err) {
                    if (err instanceof ProtocolError) meta.referenceValid = false;
                    return callback(err, wfMessage);
                }
                meta.referenceValid = true;
                return callback(null, wfMessage);
            }
        );
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Evaluates reference by checking referenced message
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {Object} wfRefMessage the refereced Whiteflag message
 * @param {errorCb} callback function called on completion
 */
function evaluateReference(wfMessage, wfRefMessage, callback) {
    // Get message reference data
    let { MetaHeader: meta } = wfMessage;
    const { MessageHeader: header } = wfMessage;
    if (header.MessageCode === TESTMESSAGECODE) {
        // Test message may reference any message
        return callback(null);
    }
    // Get referenced message data
    const { MetaHeader: refMeta } = wfRefMessage;
    const { MessageHeader: refHeader } = wfRefMessage;
    if (!refHeader) return callback(new Error('Cannot evaluate references without header of referenced message'));

    // Get Whiteflag specification
    const wfSpec = wfMessageSchema.specifications;

    // Array and metaheader for errors

    let refErrors = [];

    // Perform reference checks
    log.trace(MODULELOG, `Evaluating ${type(wfMessage)} message ${JSON.stringify(header)} referencing ${type(wfRefMessage)} message ${JSON.stringify(refHeader)}`)
    try {
        // CHECK 1: may the message type reference the referenced message type?
        const mesageTypeIndex = wfSpec.MessageCode.findIndex(
            mesageCode => mesageCode.const === header.MessageCode
        );
        if (mesageTypeIndex < 0) {
            return callback(new Error(`Cannot evaluate reference for non-existing message type: ${header.MessageCode}`));
        }
        const wfTypeSpec = wfSpec.MessageCode[mesageTypeIndex];
        const refTypeIndex = wfTypeSpec.allowedToReference.findIndex(
            allowed => allowed.referencedMessageCode === refHeader.MessageCode
        );
        if (refTypeIndex < 0) {
            refErrors.push(`Message type ${header.MessageCode} may not reference message type ${refHeader.MessageCode}`);
        } else {
            // CHECK 2: is the reference code allowed?
            const wfRefSpec = wfTypeSpec.allowedToReference[refTypeIndex].allowedReferenceIndicator;
            if (!wfRefSpec.includes(header.ReferenceIndicator)) {
                refErrors.push(`Message type ${header.MessageCode} may not use reference code ${header.ReferenceIndicator} to reference message type ${refHeader.MessageCode}`);
            }
            // CHECK 3: are the reference codes of both messages compatible (i.e. meaningful)?
            const refIndex = wfSpec.ReferenceIndicator.findIndex(
                referenceIndicator => referenceIndicator.const === header.ReferenceIndicator
            );
            if (refIndex < 0) {
                refErrors.push(`Reference Indicator ${header.ReferenceIndicator} is not allowed`);
            } else {
                // Check if allowed from same originator
                if (
                    !wfSpec.ReferenceIndicator[refIndex].allowedToReferenceSameOriginator
                    && meta.originatorAddress?.toLowerCase() === refMeta.originatorAddress?.toLowerCase()
                ) {
                    refErrors.push(`Reference code ${header.ReferenceIndicator} may not be used by the same originator`);
                }
                // Check if allowed from different originator
                if (
                    !wfSpec.ReferenceIndicator[refIndex].allowedToReferenceDifferentOriginator
                    && meta.originatorAddress?.toLowerCase() !== refMeta.originatorAddress?.toLowerCase()
                ) {
                    refErrors.push(`Reference code ${header.ReferenceIndicator} may not be used by a different originator`);
                }
                // Check if reference code may reference reference code
                const wfSpecAllowedRefIndicators = wfSpec.ReferenceIndicator[refIndex].allowedToReference;
                if (!wfSpecAllowedRefIndicators.includes(refHeader.ReferenceIndicator)) {
                    refErrors.push(`Reference code ${header.ReferenceIndicator} cannot meaningfully reference reference code ${refHeader.ReferenceIndicator}`);
                }
            }
        }
    } catch(err) {
        return callback(new Error(`Error while evaluating reference: ${err.message}`));
    }
    // Evaluate and return result
    if (refErrors.length > 0) {
        return callback(new ProtocolError('Invalid message reference', refErrors, 'WF_REFERENCE_ERROR'), wfMessage);
    }
    return callback(null);
}
