'use strict';
/**
 * @module lib/common/logger
 * @summary Whiteflag API logging module
 * @description Module for logging events of the Whiteflag API
 * @tutorial modules
 * @tutorial logging
 */
module.exports = {
    // output control functions
    redirectStream,
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

// Original write to standard output and error functions //
const writeStdout = process.stdout.write.bind(process.stdout);
const writeSterr = process.stderr.write.bind(process.stderr);

// Module constants //
/**
 * @constant {Object} levels
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
 * Redirects a stream to a logger
 * @param {WritableStream} stream the writable stream to intercept
 * @param {function} logger a logger function
 */
function redirectStream(stream, logger) {
    stream.write = (data) => {
        // Remove line end, timestamps, leading whitespace
        let message = data.replace(/\n$/, '')
                          .replace(/^\d+-\d+-\d+\s\d+:\d+:\d+/, '')
                          .replace(/^\s+/, '');

        // Send data to logger 
        return logger('submodule', message)
    }
}

/**
 * Sets new logging level
 * @function setLogLevel
 * @alias module:lib/common/logger.setLogLevel
 * @param {loglevel} loglevel logging level to be set
 * @param {function(Error, loglevel)} callback
 * @typedef {number} loglevel logging level
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
 * @param {function(Error, loglevel)} callback
 */
function getLogLevel(callback) {
    return callback(null, _logLevel);
}

// MAIN LOGGER FUNCTIONS
/**
 * Logs fatal events (level 1)
 * @function fatal
 * @alias module:lib/common/logger.fatal
 * @param {string} module name of the module that makes the log
 * @param {string} message the message to log
 */
function fatal(module, message) {
    if (levels.fatal <= _logLevel) {
        return writeSterr(`[FATAL] ${module}: ${cleanLogMessage(message)}\n`);
    }
}

/**
 * Logs error events (level 2)
 * @function error
 * @alias module:lib/common/logger.error
 * @param {string} module name of the module that makes the log
 * @param {string} message the message to log
 */
function error(module, message) {
    if (levels.error <= _logLevel) {
        return writeSterr(`[ERROR] ${module}: ${cleanLogMessage(message)}\n`);
    }
}

/**
 * Logs warning events (level 3)
 * @function warn
 * @alias module:lib/common/logger.warn
 * @param {string} module name of the module that makes the log
 * @param {string} message the message to log
 */
function warn(module, message) {
    if (levels.warn <= _logLevel) {
        return writeStdout(`[WARN ] ${module}: ${cleanLogMessage(message)}\n`);
    }
}

/**
 * Logs informational events (level 4)
 * @function info
 * @alias module:lib/common/logger.info
 * @param {string} module name of the module that makes the log
 * @param {string} message the message to log
 */
function info(module, message) {
    if (levels.info <= _logLevel) {
        return writeStdout(`[INFO ] ${module}: ${cleanLogMessage(message)}\n`);
    }
}

/**
 * Logs debug events (level 5)
 * @function debug
 * @alias module:lib/common/logger.debug
 * @param {string} module name of the module that makes the log
 * @param {string} message the message to log
 */
function debug(module, message) {
    if (levels.debug <= _logLevel) {
        return writeStdout(`[DEBUG] ${module}: ${cleanLogMessage(message)}\n`);
    }
}

/**
 * Logs trace events (level 6)
 * @function trace
 * @alias module:lib/common/logger.trace
 * @param {string} module name of the module that makes the log
 * @param {string} message the message to log
 */
function trace(module, message) {
    if (levels.trace <= _logLevel) {
        return writeStdout(`[TRACE] ${module}: ${cleanLogMessage(message)}\n`);
    }
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Sanitises log messages
 */
function cleanLogMessage(message) {
    return message
           .replace(/(?<=:\/{2}).+?(?:@)/, '')
           .replace(/\n/, ': ');
}
