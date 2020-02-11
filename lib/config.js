'use strict';
/**
 * @module lib/config
 * @summary Whiteflag API configuration module
 * @description Module for reading and parsing the main API configuration
 */
module.exports = {
    // Configuration functions
    getConfig
};

// Module objects //
/**
 * Whiteflag API configuration data
 * @type {object}
 */
let _apiConfigData = {};

// Node.js core and external modules //
const fs = require('fs');
const toml = require('toml');

// Whiteflag common functions and classes //
const log = require('./common/logger');

// Module constants //
const MODULELOG = 'config';
const PACKAGEFILE = './package.json';
const WFCONFDIR = process.env.WFCONFDIR || './config';
const CONFFILE = WFCONFDIR + '/api.toml';

// Module variables //
let _confFileRead = false;

// MAIN MODULE FUNCTIONS //
/**
 * Reads and returns the configuration
 * @function getConfig
 * @alias module:lib/config.getConfig
 * @param {function} [callback] function to be called upon completion
 */
function getConfig(callback) {
    if (!_confFileRead) {
        _apiConfigData = readConfigFile();
        log.trace(MODULELOG, `Reading configuration from ${CONFFILE}`);
    }
    if (!callback) return _apiConfigData;
    return callback(null, _apiConfigData);
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Reads Whiteflag API configuration parameters from file
 * @private
 * @returns {object} Whiteflag API protocol configuration
 */
function readConfigFile() {
    let apiConfigData = _apiConfigData;

    // Get configuration
    try {
        apiConfigData = toml.parse(fs.readFileSync(CONFFILE));
    } catch(err) {
        // If parsing error at exact location, otherwise generic error
        if (!err.line) {
            log.fatal(MODULELOG, `Error reading configuration file ${CONFFILE}: ${err.message}`);
        } else {
            log.fatal(MODULELOG, `Error in configuration file ${CONFFILE} on line ${err.line}, position ${err.column}: ${err.message}`);
        }
        return process.exit(1);
    }
    _confFileRead = true;
    apiConfigData.CONFFILE = CONFFILE;

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
