'use strict';
/**
 * @module lib/protocol/references
 * @summary Whiteflag message reference validation module
 * @description Module for reference verification functions
 * @tutorial protocol
 */
module.exports = {
    // Message validation functions
    verify: verifyReference
};

// Node.js core and external modules //
const fs = require('fs');

// Whiteflag common functions and classes //
const array = require('../common/arrays');
const { ProtocolError } = require('../common/errors');

// Whiteflag modules //
const wfRetrieve = require('./retrieve');

// Module constants //
const TESTMESSAGECODE = 'T';
const wfMessageSchema = JSON.parse(fs.readFileSync('./lib/protocol/static/message.schema.json'));

// MAIN MODULE FUNCTIONS //
/**
 * Checks if message references antother message correclty and updates metaheader accordingly
 * @function verifyReference
 * @alias module:lib/protocol/validation.verifyReference
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {function(Error, wfMessage)} callback function to be called upon completion
 */
function verifyReference(wfMessage, callback) {
    // Check message
    if (!wfMessage.MetaHeader) {
        return callback(new ProtocolError('Missing metaheader', null, 'WF_METAHEADER_ERROR'), wfMessage);
    }
    if (!wfMessage.MessageHeader) {
        wfMessage.MetaHeader.formatValid = false;
        return callback(new ProtocolError('Missing message header', null, 'WF_FORMAT_ERROR'), wfMessage);
    }
    // If rerference indcator is 0, then referenced transcation hash may be anything
    if (wfMessage.MessageHeader.ReferenceIndicator === '0') {
        wfMessage.MetaHeader.referenceValid = true;
        return callback(null, wfMessage);
    }
    // Message referenced; but no transaction hash
    if (/^0{64}$/.test(wfMessage.MessageHeader.ReferencedMessage)) {
        wfMessage.MetaHeader.referenceValid = false;
        return callback(new ProtocolError('Illegal reference', null, 'WF_REFERENCE_ERROR'), wfMessage);
    }
    // Retrieve referenced message and validate reference
    wfRetrieve.getMessage(wfMessage.MessageHeader.ReferencedMessage, wfMessage.MetaHeader.blockchain,
        function verifyReferenceRetrieveCb(err, wfMessages) {
            // Return if referenced message cannot be retrieved
            if (err) return callback(err, wfMessage);
            if (wfMessages.length === 0) return callback(new Error('Could not retrieve referenced message'), wfMessage);

            // Call evaluation function and return result
            evaluateReference(wfMessage, wfMessages[0], function verifyReferenceEvalCb(err) {
                if (err) {
                    if (err instanceof ProtocolError) wfMessage.MetaHeader.referenceValid = false;
                    return callback(err, wfMessage);
                }
                wfMessage.MetaHeader.referenceValid = true;
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
 * @param {function(Error)} callback function to be called upon completion
 */
function evaluateReference(wfMessage, wfRefMessage, callback) {
    // Get reference metadata and specification
    const header = wfMessage.MessageHeader;
    if (header.MessageCode === TESTMESSAGECODE) {
        // Test message may reference any message
        return callback(null);
    }
    const refMessageHeader = wfRefMessage.MessageHeader;
    const wfSpec = wfMessageSchema.specifications;

    // Array for errors
    let referenceErrors = [];

    // Execute reference checks
    try {
        // CHECK 1: may the message type reference the referenced message type?
        const mesageTypeIndex = wfSpec.MessageCode.findIndex(
            mesageCode => mesageCode.const === header.MessageCode
        );
        if (mesageTypeIndex < 0) {
            return callback(new Error(`Cannot evaluate reference for non-existing message type: ${header.MessageCode}`));
        }
        const wfSpecMessageType = wfSpec.MessageCode[mesageTypeIndex];
        const allowedReferenceIndex = wfSpecMessageType.allowedToReference.findIndex(
            allowed => allowed.referencedMessageCode === refMessageHeader.MessageCode
        );
        if (allowedReferenceIndex < 0) {
            referenceErrors.push(`Message type ${header.MessageCode} may not reference message type ${refMessageHeader.MessageCode}`);
        } else {
            // CHECK 2: is the reference code allowed?
            const wfSpecAllowedReferences = wfSpecMessageType.allowedToReference[allowedReferenceIndex].allowedReferenceIndicator;
            if (!wfSpecAllowedReferences.includes(header.ReferenceIndicator)) {
                referenceErrors.push(`Message type ${header.MessageCode} may not use reference code ${header.ReferenceIndicator} to reference message type ${refMessageHeader.MessageCode}`);
            }
            // CHECK 3: are the reference codes of both messages compatible (i.e. meaningful)?
            const refIndicatorIndex = wfSpec.ReferenceIndicator.findIndex(
                referenceIndicator => referenceIndicator.const === header.ReferenceIndicator
            );
            if (refIndicatorIndex < 0) {
                referenceErrors.push(`Reference Indicator ${header.ReferenceIndicator} is not allowed`);
            } else {
                // Check if allowed from same originator
                if (
                    !wfSpec.ReferenceIndicator[refIndicatorIndex].allowedToReferenceSameOriginator
                    && wfMessage.MetaHeader.originatorAddress.toLowerCase() === wfRefMessage.MetaHeader.originatorAddress.toLowerCase()
                ) {
                    referenceErrors.push(`Reference code ${header.ReferenceIndicator} may not be used by the same originator`);
                }
                // Check if allowed from different originator
                if (
                    !wfSpec.ReferenceIndicator[refIndicatorIndex].allowedToReferenceDifferentOriginator
                    && wfMessage.MetaHeader.originatorAddress.toLowerCase() !== wfRefMessage.MetaHeader.originatorAddress.toLowerCase()
                ) {
                    referenceErrors.push(`Reference code ${header.ReferenceIndicator} may not be used by a different originator`);
                }
                // Check if reference code may reference reference code
                const wfSpecAllowedRefIndicators = wfSpec.ReferenceIndicator[refIndicatorIndex].allowedToReference;
                if (!wfSpecAllowedRefIndicators.includes(refMessageHeader.ReferenceIndicator)) {
                    referenceErrors.push(`Reference code ${header.ReferenceIndicator} cannot meaningfully reference reference code ${refMessageHeader.ReferenceIndicator}`);
                }
            }
        }
    } catch(err) {
        return callback(err);
    }
    // Evaluate and return result
    if (referenceErrors.length > 0) {
        wfMessage.MetaHeader.validationErrors = array.addArray(wfMessage.MetaHeader.validationErrors, referenceErrors);
        return callback(new ProtocolError('Invalid message contents', referenceErrors, 'WF_FORMAT_ERROR'));
    }
    return callback(null);
}
