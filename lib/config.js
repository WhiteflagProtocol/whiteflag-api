'use strict';
/**
 * @module lib/config
 * @summary Whiteflag API configuration module
 * @description Module for reading and parsing the main API configuration
 * @tutorial installation
 * @tutorial configuration
 * @tutorial modules
 */
module.exports = {
    getConfig
};

/* Module objects */
/**
 * Whiteflag API configuration data
 * @typedef {Object} apiConfigData the configuration data object
 */
let _apiConfigData = {};

/* Node.js core and external modules */
const fs = require('fs');
const toml = require('toml');

/* Common internal functions and classes */
const log = require('./_common/logger');

/* Module constants */
const MODULELOG = 'config';
const PACKAGEFILE = './package.json';
const WFCONFDIR = process.env.WFCONFDIR || './config';
const WFCONFFILE = WFCONFDIR + '/api.toml';

/* Module variables */
let _confFileRead = false;

/* MAIN MODULE FUNCTIONS */
/**
 * Reads, caches and returns the configuration
 * @function getConfig
 * @alias module:lib/config.getConfig
 * @param {genericCb} [callback] function called on completion
 * @returns {apiConfigData} the configuration data
 */
function getConfig(callback) {
    if (!_confFileRead) {
        log.trace(MODULELOG, `Reading configuration from ${WFCONFFILE}`);
        _apiConfigData = readConfigFile();
    }
    if (!callback) return _apiConfigData;
    if (!_apiConfigData) {
        return callback(new Error('Could not retrieve configuration'));
    }
    return callback(null, _apiConfigData);
}

/* PRIVATE MODULE FUNCTIONS */
/**
 * Reads Whiteflag API configuration parameters from file
 * @private
 * @returns {apiConfigData} Whiteflag API protocol configuration
 */
function readConfigFile() {
    let apiConfigData = _apiConfigData;

    // Get configuration
    try {
        apiConfigData = toml.parse(fs.readFileSync(WFCONFFILE));
    } catch(err) {
        if (!err.line) {
            log.error(MODULELOG, `Error reading configuration file ${WFCONFFILE}: ${err.message}`);
        } else {
            log.error(MODULELOG, `Error in configuration file ${WFCONFFILE} on line ${err.line}, position ${err.column}: ${err.message}`);
        }
        return null;
    }
    _confFileRead = true;
    apiConfigData.WFCONFFILE = WFCONFFILE;

    // Get software version for logging
    try {
        apiConfigData.version = JSON.parse(fs.readFileSync(PACKAGEFILE)).version;
    } catch(err) {
        log.error(MODULELOG, `Error obtaining version number from ${PACKAGEFILE}: ${err.message}`);
        apiConfigData.version = 'unknown';
    }
    // Return configuration data
    return apiConfigData;
}
