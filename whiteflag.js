'use strict';
 /**
 * @module whiteflag
 * @summary Whiteflag API main module
 * @description Module for initialising the transceive event chains, blockchains, datastores and starting the server
 */

// Whiteflag common functions and classes //
const log = require('./lib/common/logger');

// Whiteflag modules //
const wfApiConfig = require('./lib/config');
const wfApiServer = require('./lib/server');
const wfApiDatastores = require('./lib/datastores');
const wfApiBlockchains = require('./lib/blockchains');
const wfState = require('./lib/protocol/state');
const wfTransmit = require('./lib/protocol/transmit');
const wfReceive = require('./lib/protocol/receive');
const wfManagement = require('./lib/protocol/management');

// Whiteflag event emitters //
const wfRxEvent = require('./lib/protocol/events').rxEvent;
const wfTxEvent = require('./lib/protocol/events').txEvent;
const wfStateEvent = require('./lib/protocol/events').stateEvent;

// Module constants //
const MODULELOG = 'api';

/*
 * Gracefully crash if an uncaught exception occurs and
 * ensure proper shutdonwn when process is stopped
 */
process.on('uncaughtException', uncaughtExceptionCb);
process.on('SIGINT', shutdownCb);
process.on('SIGTERM', shutdownCb);

// START THE API
/*
 * Display usage warning upon startup
 */
log.info('WHITEFLAG', 'THE USAGE OF SIGNS AND SIGNALS WITH THIS SOFTWARE IS SUBJECT TO LOCAL AND/OR INTERNATIONAL LAWS');

/*
 * The configuration is retrieved from the configuration module,
 * and in its callback all other modules are initialised
 */
wfApiConfig.getConfig(function apiConfigInitAllCb(err, apiConfig) {
    // Configuration errors are fatal
    if (err) {
        log.fatal(MODULELOG, `Configuration error: ${err.message}`);
        return process.exit(1);
    }
    // Log version number
    if (apiConfig.version) {
        log.info(MODULELOG, `Running version ${apiConfig.version}`);
    }
    // Set set logging level
    if (apiConfig.logger.loglevel) {
        log.setLogLevel(apiConfig.logger.loglevel, loglevelCb);
    }

    /**
     * Initialises rx event chain after state has been initialised
     * @listens module:lib/protocol/state.event:initialised
     */
    wfStateEvent.once('initialised', function apiStateInitReceiveCb() {
        wfReceive.init(function apiInitRxCb(err) {
            transceiveInitCb(err, 'Whiteflag message receive (rx) event chain initialised');
        });
    });

    /**
     * Initialises handling of protocol management messages
     * @listens module:lib/protocol/transmit.txEvent:initialised
     */
    wfTxEvent.once('initialised', function apiTxInitManagementCb() {
        wfManagement.init(managementInitCb);
    });

    /**
     * Creates endpoints after tx chain has been initialised
     * @listens module:lib/protocol/transmit.txEvent:initialised
     */
    wfTxEvent.once('initialised', function apiTxInitEndpointsCb() {
        wfApiServer.createEndpoints(endpointEventCb, endpointsInitCb);
    });

    /**
     * Starts server and depended modules after rx chain has been initialised
     * @listens module:lib/protocol/receive.rxEvent:initialised
     */
    wfRxEvent.once('initialised', function apiRxInitServerCb() {
        // Start the server
        wfApiServer.start(function apiServerInitTransmitCb(err, url) {
            serverStartCb(err, url);

            // Create rest api endpoints after message transmission chain has been initialised
            wfTransmit.init(function apiTxInitCb(err) {
                transceiveInitCb(err, 'Whiteflag message transmit (tx) event chain initialised');
            });
            // Monitor connections on rx socket
            wfApiServer.monitorSocket(socketEventCb);
        });
    });

    /**
     * Initialises blockchains after rx chain has been initialised
     * @listens module:lib/protocol/receive.rxEvent:initialised
     */
    wfRxEvent.once('initialised', function apiRxInitBlockchainsCb() {
        wfApiBlockchains.init(blockhainsInitCb);
    });

    /*
     * Connects to datastores and initiliase state,
     * which triggers all other initialisations
     */
    wfApiDatastores.init(function apiDatastoresInitCb(err) {
        datastoresInitCb(err);
        wfState.init(stateInitCb);
    });
});

// CALLBACK FUNCTIONS //
/**
 * Callback to log uncaught exceptions
 * @callback shutdownCb
 * @param {object} err error object if any error
 */
function shutdownCb() {
    log.info(MODULELOG, 'Caught SIGINT or SIGTERM. Shutting down...');
    wfState.close(function apiStateCloseCb(err) {
        if (err) {
            log.error(MODULELOG, err.message);
            return process.exit(1);
        }
        return process.exit(0);
    });
}

/**
 * Callback to log uncaught exceptions
 * @callback uncaughtExceptionCb
 * @param {object} err error object if any error
 */
function uncaughtExceptionCb(err) {
    if (err.stack) {
        log.fatal(MODULELOG, `UNCAUGHT EXCEPTION: ${err.stack}`);
    } else {
        log.fatal(MODULELOG, `UNCAUGHT EXCEPTION: ${err.toString()}`);
    }
    return process.exit(2);
}

/**
 * Callback to log loglevel upon startup
 * @callback loglevelCb
 * @param {object} err error object if any error
 * @param {number} loglevel logging level
 */
function loglevelCb(err, loglevel) {
    if (err) {
        log.fatal(MODULELOG, `Error setting logging level: ${err.message}`);
        return process.exit(1);
    }
    log.info(MODULELOG, `Logging level set to ${loglevel}`);
}

/**
 * Callback to log endpoint events
 * @callback endpointEventCb
 * @param {object} err error object if any error
 * @param {string} client client information
 * @param {string} event event name
 * @param {string} info event information
 */
function endpointEventCb(err, client, event, info) {
    if (err) return log.error(MODULELOG, `Endpoint error occured: ${err.message}`);
    return log.debug(MODULELOG, `Client ${client}: ${event}: ${info}`);
}

/**
 * Callback to log socket events
 * @callback socketEventCb
 * @param {object} err error object if any error
 * @param {string} client client information
 * @param {string} event event name
 * @param {string} info event information
 */
function socketEventCb(err, client, event, info) {
    // Logs socket event
    if (err) return log.error(MODULELOG, `Socket error occured: ${err.message}`);
    return log.debug(MODULELOG, `Socket client ${client}: ${event}: ${info}`);
}

/**
 * Callback to log transceive chain initialisation
 * @callback transceiveInitCb
 * @param {string} info transceive init information
 */
function transceiveInitCb(err, info) {
    if (err) {
        log.fatal(`Cannot initialise transceive chain: ${err.message}`);
        return process.exit(1);
    }
    if (info) log.info(MODULELOG, info);
}

/**
 * Callback to log datatstore initialisation
 * @callback datastoresInitCb
 * @param {object} err error object if any error
 */
function datastoresInitCb(err) {
    if (err) {
        if (err.line) {
            log.fatal(MODULELOG, `Error in datastores configuration file on line ${err.line}, position ${err.column}: ${err.message}`);
        } else {
            log.fatal(MODULELOG, `Datastore initialisation eror: ${err.message}`);
        }
        return process.exit(1);
    }
    log.info(MODULELOG, 'Primary datastore initialised');
}

/**
 * Callback to log blockchain initialisation
 * @callback blockhainsInitCb
 * @param {object} err error object if any error
 */
function blockhainsInitCb(err) {
    if (err) {
        if (err.line) {
            log.fatal(MODULELOG, `Error in blockchains configuration file on line ${err.line}, position ${err.column}: ${err.message}`);
        } else {
            log.fatal(MODULELOG, `Blockchains initialisation error: ${err.message}`);
        }
        return process.exit(1);
    }
    log.info(MODULELOG, 'Blockchains initialisation started');
}

/**
 * Callback to log Whiteflag protocol state initialisation
 * @callback stateInitCb
 * @param {object} err error object if any error
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
 * @param {object} err error object if any error
 */
function managementInitCb(err) {
    if (err) {
        log.fatal(MODULELOG, `Cannot initialise protocol management: ${err.message}`);
        return process.exit(1);
    }
    log.info(MODULELOG, 'Whiteflag protocol management initialised');
}

/**
 * Callback to log endpoints initialisation
 * @callback endpointsInitCb
 * @param {object} err error object if any error
 */
function endpointsInitCb(err) {
    if (err) {
        log.fatal(MODULELOG, `Cannot initialise endpoints: ${err.message}`);
        return process.exit(1);
    }
    log.info(MODULELOG, 'Server endpoints initialised');
}

/**
 * Callback to log server startup
 * @callback serverStartCb
 * @param {object} err error object if any error
 * @param {string} url server information
 */
function serverStartCb(err, url) {
    if (err) {
        if (url) {
            log.fatal(MODULELOG, `Cannot start server on ${url}: ${err.message}`);
        } else {
            log.fatal(MODULELOG, `Cannot start server: ${err.message}`);
        }
        return process.exit(1);
    }
    log.info(MODULELOG, `Server started on ${url}`);
}
