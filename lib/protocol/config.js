'use strict';
/**
 * @module  lib/protocol/config
 * @summary Whiteflag protocol configuration module
 * @description Module for Whiteflag protocol configuration parameters
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    getConfig
};

/* Module objects */
/**
 * Whiteflag protocol configuration data
 * @type {Object}
 */
let _wfConfigData = {
    state: {},
    protocol: {
        tx: {},
        rx: {},
        encryption: {}
    }
};

/* Node.js core and external modules */
const fs = require('fs');
const toml = require('toml');

/* Common internal functions and classes */
const log = require('../_common/logger');

/* Module constants */
const MODULELOG = 'protocol';
const WFCONFDIR = process.env.WFCONFDIR || './config';
const WFCONFFILE = WFCONFDIR + '/whiteflag.toml';

/* Module variables */
let _confFileRead = false;

/* MAIN MODULE FUNCTIONS */
/**
 * Returns the protocol configuration data
 * @function getConfig
 * @alias module:lib/protocol/config.getConfig
 * @param {genericCb} [callback] function called on completion
 */
function getConfig(callback) {
    if (!_confFileRead) {
        log.trace(MODULELOG, `Reading configuration parameters from ${WFCONFFILE}`);
        _wfConfigData = readConfigFile();
    }
    if (!callback) return _wfConfigData;
    if (!_wfConfigData) {
        return callback(new Error('Could not retrieve protocol configuration parameters'));
    }
    return callback(null, _wfConfigData);
}

/* PRIVATE MODULE FUNCTIONS */
/**
 * Reads Whiteflag protocol configuration parameters from file
 * @private
 * @returns {Object} Whiteflag protocol configuration
 */
function readConfigFile() {
    let wfConfigData;
    try {
        wfConfigData = toml.parse(fs.readFileSync(WFCONFFILE));
        log.trace(MODULELOG, `Parameters read from ${WFCONFFILE}: ` + JSON.stringify(_wfConfigData));
    } catch(err) {
        // If parsing error at exact location, otherwise generic error
        if (!err.line) {
            log.error(MODULELOG, `Error reading configuration file ${WFCONFFILE}: ${err.message}`);
        } else {
            log.error(MODULELOG, `Error in configuration file ${WFCONFFILE} on line ${err.line}, position ${err.column}: ${err.message}`);
        }
        return null;
    }
    _confFileRead = true;
    return wfConfigData;
}
