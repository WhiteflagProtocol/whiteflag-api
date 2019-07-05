'use strict';
/**
 * @module  lib/protocol/config
 * @summary Whiteflag protocol configuration module
 * @description Module for Whiteflag protocol configuration parameters
 */
module.exports = {
    // Whiteflag protocol configuration functions
    getConfig
};

// Module objects //
/**
 * Whiteflag protocol configuration data
 * @type {object}
 */
let _wfConfigData = {
    state: {},
    protocol: {
        tx: {},
        rx: {},
        encryption: {}
    }
};

// Node.js core and external modules //
const fs = require('fs');
const toml = require('toml');

// Whiteflag common functions and classes //
const log = require('../common/logger');

// Module constants //
const MODULELOG = 'protocol';
const WFCONFDIR = process.env.WFCONFDIR || './config';
const WFCONFFILE = WFCONFDIR + '/whiteflag.toml';

// Module variables //
let _confFileRead = false;

// MAIN MODULE FUNCTIONS //
/**
 * Returns the protocol configuration data
 * @function getConfig
 * @alias module:lib/protocol/config.getConfig
 * @param {function} [callback] function to be called upon completion
 */
function getConfig(callback) {
    if (!_confFileRead) {
        _wfConfigData = readConfigFile();
        log.trace(MODULELOG, `Configuration parameters read from ${WFCONFFILE}`);
    }
    if (!callback) return _wfConfigData;
    return callback(null, _wfConfigData);
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Reads Whiteflag protocol configuration parameters from file
 * @private
 * @returns {object} Whiteflag protocol configuration
 */
function readConfigFile() {
    let wfConfigData = _wfConfigData;
    try {
        wfConfigData = toml.parse(fs.readFileSync(WFCONFFILE));
        log.trace(MODULELOG, `Parameters read from ${WFCONFFILE}: ` + JSON.stringify(_wfConfigData));
    } catch(err) {
        // If parsing error at exact location, otherwise generic error
        if (!err.line) {
            log.fatal(MODULELOG, `Error reading configuration file ${WFCONFFILE}: ${err.message}`);
        } else {
            log.fatal(MODULELOG, `Error in configuration file ${WFCONFFILE} on line ${err.line}, position ${err.column}: ${err.message}`);
        }
        return process.exit(1);
    }
    _confFileRead = true;
    return wfConfigData;
}
