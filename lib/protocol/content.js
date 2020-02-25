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
const TESTMESSAGECODE = 'T';
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
}
