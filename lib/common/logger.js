'use strict';
/**
 * @module lib/common/logger
 * @summary Whiteflag API logging module
 * @description Module for logging events of the Whiteflag API
 */
module.exports = {
    // Loglevel functions
    setLogLevel,
    getLogLevel,
    // Logging functions
    fatal,
    error,
    warn,
    info,
    debug,
    trace
};

// Module constants //
/** 
 * @constant {object} levels
 * @description Defines the logging levels
 */
const levels = {
    fatal: 1,
    error: 2,
    warn: 3,
    info: 4,
    debug: 5,
    trace: 6
};
// Module variables //
let _logLevel = 4;

// MAIN MODULE FUNCTIONS //
/**
 * Sets new logging level
 * @function setLogLevel
 * @alias module:lib/common/logger.setLogLevel
 * @param {number} level
 * @param {function} callback
 * @returns
 */
function setLogLevel(level, callback) {
    if (level > 0 && level <= 6) {
        _logLevel = level;
    } else {
        return callback(new Error(`Logging level ${level} does not exist`), _logLevel);
    }
    return callback(null, _logLevel);
}

/**
 * Returns current loglevel
 * @function getLogLevel
 * @alias module:lib/common/logger.getLogLevel
 * @param {*} callback
 * @returns
 */
function getLogLevel(callback) {
    return callback(null, _logLevel);
}

// MAIN LOGGER FUNCTIONS
/**
 * Logs fatal events (level 1)
 * @function fatal
 * @alias module:lib/common/logger.fatal
 * @param {string} source component name that makes the log
 * @param {string} message the message to log
 * @returns
 */
function fatal(source, message) {
    if (levels.fatal <= _logLevel) {
        return console.error(`[FATAL] ${source}: ${message}`);
    }
}

/**
 * Logs error events (level 2)
 * @function error
 * @alias module:lib/common/logger.error
 * @param {string} source component name that makes the log
 * @param {string} message the message to log
 * @returns
 */
function error(source, message) {
    if (levels.error <= _logLevel) {
        return console.error(`[ERROR] ${source}: ${message}`);
    }
}

/**
 * Logs warning events (level 3)
 * @function warn
 * @alias module:lib/common/logger.warn
 * @param {string} source component name that makes the log
 * @param {string} message the message to log
 * @returns
 */
function warn(source, message) {
    if (levels.warn <= _logLevel) {
        return console.warn(`[WARN ] ${source}: ${message}`);
    }
}

/**
 * Logs informational events (level 4)
 * @function info
 * @alias module:lib/common/logger.info
 * @param {string} source component name that makes the log
 * @param {string} message the message to log
 * @returns
 */
function info(source, message) {
    if (levels.info <= _logLevel) {
        return console.info(`[INFO ] ${source}: ${message}`);
    }
}

/**
 * Logs debug events (level 5)
 * @function debug
 * @alias module:lib/common/logger.debug
 * @param {string} source component name that makes the log
 * @param {string} message the message to log
 * @returns
 */
function debug(source, message) {
    if (levels.debug <= _logLevel) {
        return console.debug(`[DEBUG] ${source}: ${message}`);
    }
}

/**
 * Logs trace events (level 6)
 * @function trace
 * @alias module:lib/common/logger.trace
 * @param {string} source component name that makes the log
 * @param {string} message the message to log
 * @returns
 */
function trace(source, message) {
    if (levels.trace <= _logLevel) {
        return console.debug(`[TRACE] ${source}: ${message}`);
    }
}
