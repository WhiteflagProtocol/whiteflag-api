#!/usr/bin/env node
'use strict';
 /**
 * @module whiteflag
 * @summary Whiteflag API main module
 * @description Module for initialising the transceive event chains, blockchains, datastores and starting the server
 * @tutorial installation
 * @tutorial configuration
 * @tutorial modules
 */

/* Change working directory to process directory
process.chdir(__dirname);

/* Common internal functions and classes */
const log = require('./lib/_common/logger');
const { ignore } = require('./lib/_common/processing');

/* Whiteflag modules */
const wfConfig = require('./lib/config');
const wfServer = require('./lib/server');
const wfDatastores = require('./lib/datastores');
const wfBlockchains = require('./lib/blockchains');
const wfState = require('./lib/protocol/state');
const wfTransmit = require('./lib/protocol/transmit');
const wfReceive = require('./lib/protocol/receive');
const wfManagement = require('./lib/protocol/management');
const wfRxEvent = require('./lib/protocol/events').rxEvent;
const wfTxEvent = require('./lib/protocol/events').txEvent;
const wfStateEvent = require('./lib/protocol/events').stateEvent;

/* Module constants */
const MODULELOG = 'main';
const SHUTDOWNTIMEOUT = 10000;

/* PROCESS CONTROL */
/*
 * Gracefully crash if an uncaught exception occurs and
 * ensure proper shutdown when process is stopped
 */
process.on('uncaughtException', uncaughtExceptionCb);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/*
 * Send any uncontrolled output to stdout and stderr to the debug logger
 * to avoid submodules that do not properly report errors flooding the log
 */
log.redirectStream(process.stdout, log.trace);
log.redirectStream(process.stderr, log.debug);

/* EXECUTE MAIN PROCESS FUNCTION */
/**
 * @Callback errorCb
 * @param {Error} err any error
 */
main(function errorCb(err) {
    if (err) {
        log.fatal(MODULELOG, err.message);
        return process.exit(1);
    }
    shutdown();
});

/* MAIN FUNCTIONS */
/**
 * Main process function that reads the configuration and starts all functionality
 * @function main
 * @param {errorCb} callback
 */
function main(callback) {
    log.info('whiteflag', 'THE USAGE OF SIGNS AND SIGNALS WITH THIS SOFTWARE IS SUBJECT TO LOCAL AND/OR INTERNATIONAL LAWS');
    /*
    * The configuration is retrieved from the configuration module,
    * and in its callback all other modules are initialised
    */
    wfConfig.getConfig(function apiGetConfigCb(err, apiConfig) {
        // Configuration errors are fatal
        if (err) return callback(new Error(`Configuration error: ${err.message}`));
        log.info(MODULELOG, `Configuration read from ${apiConfig.CONFFILE}`);

        // Log version number
        if (apiConfig.version) {
            log.info(MODULELOG, `Version: ${apiConfig.version}`);
        }
        // Set set logging level
        const loglevel = process.env.WFLOGLEVEL || apiConfig.logger.loglevel;
        if (loglevel) {
            /**
             * @callback genericCb
             * @param {Error} err any error
             * @param {*} result the result
             */
            log.setLogLevel(loglevel, function loglevelCb(err, loglevel) {
                if (err) log.error(MODULELOG, `Error setting logging level: ${err.message}`);
                log.info(MODULELOG, `Logging level: ${loglevel}`);
            });
        }
        // Initialise all modules
        initModules();
    });
}

/**
 * Initialises all API modules
 * @function initModules
 */
function initModules() {
    /* The functions below are defined in reverse order of execution,
     * i.e. the top function is executed last and
     * the bottom one, which triggers everything, first.
     */

    /**
     * Creates endpoints after tx chain has been initialised
     * @listens module:lib/protocol/transmit.txEvent:initialised
     */
    wfTxEvent.once('initialised', function apiTxInitEndpointsCb() {
        wfServer.createEndpoints(endpointEventCb, endpointsInitCb);
    });
    /**
     * Initialises handling of protocol management messages
     * @listens module:lib/protocol/transmit.txEvent:initialised
     */
    wfTxEvent.once('initialised', function apiTxInitManagementCb() {
        wfManagement.init(managementInitCb);
    });
    /**
     * Starts server and depended modules after rx chain has been initialised
     * @listens module:lib/protocol/receive.rxEvent:initialised
     */
    wfRxEvent.once('initialised', function apiRxInitServerCb() {
        // Start the server
        wfServer.start(function apiServerStartCb(err, url) {
            serverStartCb(err, url);

            // Create rest api endpoints after message transmission chain has been initialised
            wfTransmit.init(function apiTxInitCb(err) {
                transceiveInitCb(err, 'Whiteflag message transmit (tx) event chain initialised');
            });
            // Monitor connections on rx socket
            wfServer.monitorSocket(socketEventCb);
        });
    });
    /**
     * Initialises blockchains after rx chain has been initialised
     * @listens module:lib/protocol/receive.rxEvent:initialised
     */
    wfRxEvent.once('initialised', function apiRxInitBlockchainsCb() {
        wfBlockchains.init(blockhainsInitCb);
    });
    /**
     * Initialises rx event chain after state has been initialised
     * @listens module:lib/protocol/state.event:initialised
     */
    wfStateEvent.once('initialised', function apiStateInitReceiveCb() {
        wfReceive.init(function apiInitRxCb(err) {
            transceiveInitCb(err, 'Whiteflag message receive (rx) event chain initialised');
        });
    });
    /*
    * Connects to datastores and initiliase state,
    * which triggers all other initialisations
    */
    wfDatastores.init(function apiDatastoresInitCb(err, primaryDatastore) {
        datastoresInitCb(err, primaryDatastore);
        wfState.init(stateInitCb);
    });
}

/**
 * Shuts down the API gracefully
 * @function shutdown
 */
function shutdown() {
    log.info(MODULELOG, 'Caught SIGINT or SIGTERM. Shutting down...');

    // Set timeout to ensure shutdown
    let timer = setTimeout(timeoutCb, SHUTDOWNTIMEOUT);
    /**
     * Closes datastores after state has been closed
     * @listens module:lib/protocol/state.event:closed
     */
    wfStateEvent.once('closed', function apiStateCloseCb() {
        log.info(MODULELOG, 'Whiteflag protocol state closed');
        wfDatastores.close(function apiDatastoresCloseCb(err, primaryDatastore) {
            datastoresCloseCb(err, primaryDatastore);

            // All done
            clearTimeout(timer);
            log.info(MODULELOG, 'All done. Goodbye.');
            return process.exit(0);
        });
    });
    /*
     * Stop the server and close the state
     * whcih triggers all other closing actions
     */
    wfServer.stop(function apiServerStopCb(err) {
        if (err) log.warn(MODULELOG, err.message);
        if (!err) log.info(MODULELOG, 'Server stopped');
        wfState.close();
    });
    /**
     * Shuts down forcefully after timeout
     * @callback timeoutCb
     */
    function timeoutCb() {
        log.warn(MODULELOG, 'Taking too much time to close down everything. Exiting now.');
        return process.exit(1);
    }
}

/* CALLBACK AND HANDLER FUNCTIONS */
/**
 * Callback to log uncaught exceptions
 * @callback uncaughtExceptionCb
 * @param {Error} err any error
 */
function uncaughtExceptionCb(err) {
    if (err.stack) {
        log.fatal(MODULELOG, `UNCAUGHT EXCEPTION: ${err.stack}`);
    } else {
        log.fatal(MODULELOG, `UNCAUGHT EXCEPTION: ${err.toString()}`);
    }
    return process.exit(1);
}

/**
 * Callback to log endpoint events
 * @callback endpointEventCb
 * @param {Error} err any error
 * @param {string} client client information
 * @param {string} event event name
 * @param {string} info event information
 */
function endpointEventCb(err, client, event, info) {
    if (err) return log.error(MODULELOG, `Endpoint error: ${err.message}`);
    return log.info(MODULELOG, `Client ${client}: ${event}: ${info}`);
}

/**
 * Callback to log socket events
 * @callback socketEventCb
 * @param {Error} err any error
 * @param {string} client client information
 * @param {string} event event name
 * @param {string} info event information
 */
function socketEventCb(err, client, event, info) {
    // Logs socket event
    if (err) return log.error(MODULELOG, `Socket error: ${err.message}`);
    return log.info(MODULELOG, `Socket client ${client}: ${event}: ${info}`);
}

/**
 * Callback to log transceive chain initialisation
 * @callback transceiveInitCb
 * @param {Error} err any error
 * @param {string} info transceive init information
 */
function transceiveInitCb(err, info) {
    if (err) {
        log.fatal(`Could not initialise transceive chain: ${err.message}`);
        return process.exit(1);
    }
    if (info) log.info(MODULELOG, info);
}

/**
 * Callback to log datatstore initialisation
 * @callback datastoresInitCb
 * @param {Error} err any error
 */
function datastoresInitCb(err, primaryDatastore) {
    if (err) {
        if (err.line) {
            log.fatal(MODULELOG, `Error in datastores configuration file on line ${err.line}: ${err.message}`);
        } else {
            log.fatal(MODULELOG, `Datastore initialisation eror: ${err.message}`);
        }
        return process.exit(1);
    }
    log.info(MODULELOG, `Primary datastore: ${primaryDatastore}`);
}

/**
 * Callback to log datatstore closure
 * @callback datastoresCloseCb
 * @param {Error} err any error
 * @param {string} naem of the primary datastrore
 */
function datastoresCloseCb(err, primaryDatastore) {
    if (err) {
        log.error(MODULELOG, `Primary datastore did not properly close: ${err.message}`);
    } else {
        log.info(MODULELOG, `Primary datastore ${primaryDatastore} closed`);
    }
}

/**
 * Callback to log blockchain initialisation
 * @callback blockhainsInitCb
 * @param {Error} err any error
 * @param {Array} array of blockchain names in the configuration
 */
function blockhainsInitCb(err, blockchains) {
    if (err) {
        if (err.line) {
            log.fatal(MODULELOG, `Error in blockchains configuration file on line ${err.line}: ${err.message}`);
        } else {
            log.fatal(MODULELOG, `Blockchains initialisation error: ${err.message}`);
        }
        return process.exit(1);
    }
    ignore(blockchains);
}

/**
 * Callback to log Whiteflag protocol state initialisation
 * @callback stateInitCb
 * @param {Error} err any error
 */
function stateInitCb(err) {
    if (err) {
        log.fatal(MODULELOG, `Whiteflag protocol state initialisation error: ${err.message}`);
        return process.exit(1);
    }
    log.info(MODULELOG, 'Whiteflag protocol state initialised');
}

/**
 * Callback to log Whiteflag protocol management messages handler initialisation
 * @callback managementInitCb
 * @param {Error} err any error
 */
function managementInitCb(err) {
    if (err) {
        log.fatal(MODULELOG, `Could not initialise protocol management: ${err.message}`);
        return process.exit(1);
    }
    log.info(MODULELOG, 'Whiteflag protocol management initialised');
}

/**
 * Callback to log endpoints initialisation
 * @callback endpointsInitCb
 * @param {Error} err any error
 */
function endpointsInitCb(err) {
    if (err) {
        log.fatal(MODULELOG, `Could not initialise endpoints: ${err.message}`);
        return process.exit(1);
    }
    log.info(MODULELOG, 'Server endpoints initialised');
}

/**
 * Callback to log server startup
 * @callback serverStartCb
 * @param {Error} err any error
 * @param {string} url server information
 */
function serverStartCb(err, url) {
    if (err) {
        if (url) {
            log.fatal(MODULELOG, `Could not start server on ${url}: ${err.message}`);
        } else {
            log.fatal(MODULELOG, `Could not start server: ${err.message}`);
        }
        return process.exit(1);
    }
    log.info(MODULELOG, `Server started listening on ${url}`);
}
