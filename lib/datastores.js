'use strict';
/**
 * @module lib/datastores
 * @summary Whiteflag API datastores module
 * @description Module with the datastore abstraction layer to connect with multiple databases
 * @tutorial installation
 * @tutorial configuration
 * @tutorial modules
 */
module.exports = {
    // Datastore functions
    init: initDatastores,
    close: closeDatastores,
    storeMessage,
    getMessages,
    storeState,
    getState
};

// Node.js core and external modules //
const fs = require('fs');
const toml = require('toml');
const jsonValidate = require('jsonschema').validate;

// Whiteflag common functions and classes //
const array = require('./common/arrays');
const log = require('./common/logger');
const { ignore } = require('./common/processing');

// Whiteflag event emitters //
const wfRxEvent = require('./protocol/events').rxEvent;
const wfTxEvent = require('./protocol/events').txEvent;

// Module constants //
const NOTSET = '(uninitialsed)';
const MODULELOG = 'datastores';
const WFCONFDIR = process.env.WFCONFDIR || './config';
const DSCONFFILE = WFCONFDIR + '/datastores.toml';
const DSMODULEDIR = './datastores/';
const requiredEvents = ['messageProcessed', 'messageUpdated'];
const wfDatastoresConfigSchema = JSON.parse(fs.readFileSync('./lib/datastores/static/datastores.config.schema.json'));

// Module variables //
let _datastores = [];
let _datastoresConfig = [];
let _primaryDatastore = NOTSET;
let _storeEventRegister = {
    rx: [],
    tx: []
};

// MAIN MODULE FUNCTIONS //
/**
 * Initialises configured datastores
 * @function initDatastores
 * @alias module:lib/datastores.init
 * @param {datastoreInitCb} callback function to be called upon completion
 */
function initDatastores(callback) {
    // Read the configuration file
    let datastoresConfig = {};
    try {
        datastoresConfig = toml.parse(fs.readFileSync(DSCONFFILE));
    } catch(err) {
        return callback(new Error(`Could not read configuration in ${DSCONFFILE}`));
    }
    // Parse config file and initialise each enabled blockchain
    if (parseConfig(datastoresConfig)) {
        _datastoresConfig = datastoresConfig.databases;

        // Get array of names of configured datastores
        _datastores = array.pluck(_datastoresConfig, 'name');
        log.debug(MODULELOG, `Configured datastores in ${DSCONFFILE}: ` + JSON.stringify(_datastores));

        // Pass result of initialization to callback
        return initDbConfig(callback);
    } else {
        return callback(new Error(`Could not parse configuration in ${DSCONFFILE}`));
    }
}

/**
 * Closes configured datastores
 * @function closeDatastores
 * @alias module:lib/datastores.close
 * @param {datastoreCloseCb} callback function to be called upon completion
 * @typedef {function(Error)} datastoreCloseCb
 */
function closeDatastores(callback) {
    _datastoresConfig.forEach(dbConfig => {
        // Get configuration and call init function for this datastore
        if (dbConfig?._enabled) {
            /**
             * Callback after closing the datastore
             * @callback datastoreInitCb
             * @param {Error} err error object if any error
             */
            dbConfig._moduleImpl.close(function datastoreCloseCb(err) {
                dbConfig._initialised = false;
                if (err) {
                    log.error(MODULELOG, `Error closing ${dbConfig.name}: ${err.message}`);
                } else {
                    log.info(MODULELOG, `Closed datastore: ${dbConfig.name}`);
                }
                // Only callback for primary datastore
                if (dbConfig?.primary) return callback(err, _primaryDatastore);
            });
        }
    });
}

/**
 * Stores Whiteflag messsage in active and enabled datastores
 * @function storeMessage
 * @alias module:lib/datastores.storeMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be stored
 * @param {datastoreStoreMessageCb} callback function to be called upon completion
 */
function storeMessage(wfMessage = {}, callback) {
    if (_datastoresConfig.length <= 0) return callback(new Error('No datastore configured'), null);
    _datastoresConfig.forEach(dbConfig => {
        if (dbConfig?._initialised) {
            /**
             * Callback after storing the Whiteflag message
             * @callback datastoreStoreMessageCb
             * @param {Error} err error object if any error
             * @param {*} result the result
             */
            dbConfig._moduleImpl.storeMessage(wfMessage, function datastoreStoreMessageCb(err, result) {
                if (err) log.error(MODULELOG, `Could not store message in ${dbConfig.name}: ${err.message}`);

                // Only call callback for primary datastore
                if (dbConfig?.primary) {
                    if (err) return callback(err, null);
                    return callback(null, result);
                }
            });
        }
    });
}

/**
 * Get Whiteflag messages from the primary database
 * @function getMessages
 * @alias module:lib/datastores.getMessages
 * @param {Object} wfQuery the properties of the messages to look up
 * @param {datastoreGetMessagesCb} callback function to be called upon completion
 */
function getMessages(wfQuery = {}, callback) {
    if (_datastoresConfig.length <= 0) return callback(new Error('No datastore configured'), null);
    _datastoresConfig.forEach(dbConfig => {
        if (dbConfig?._initialised && dbConfig.primary) {
            dbConfig._moduleImpl.getMessages(wfQuery, datastoreGetMessagesCb);
        }
    });
    /**
     * Callback after retrieving Whiteflag messages
     * @callback datastoreGetMessagesCb
     * @param {Error} err error object if any error
     * @param {Array} wfMessages the resulting Whiteflag messages
     * @param {number} count the number of messages found
     */
    function datastoreGetMessagesCb(err, wfMessages, count) {
        if (err) return callback(new Error(`Could not retrieve messages from ${_primaryDatastore}: ${err.message}`));
        if (Array.isArray(wfMessages)) {
            ignore(count);
            return callback(null, wfMessages, wfMessages.length);
        }
        return callback(new Error(`The primary datastore ${_primaryDatastore} did not return an array`));
    }
}

/**
 * Stores Whiteflag state in the primary database
 * @function storeState
 * @alias module:lib/datastores.storeState
 * @param {Object} stateObject state data enclosed in a storage / encryption container
 * @param {datastoreStoreStateCb} callback function to be called upon completion
 */
function storeState(stateObject, callback) {
    if (_datastoresConfig.length <= 0) return callback(new Error('No datastore configured'), null);
    _datastoresConfig.forEach(dbConfig => {
        if (dbConfig?._initialised && dbConfig.primary) {
            dbConfig._moduleImpl.storeState(stateObject, datastoreStoreStateCb);
        }
    });
    /**
     * Callback after storing the Whiteflag state
     * @callback datastoreStoreStateCb
     * @param {Error} err error object if any error
     * @param {*} result the result
     */
    function datastoreStoreStateCb(err, result) {
        if (err) return callback(new Error(`Could not save state in ${_primaryDatastore}: ${err.message}`));
        ignore(result);
        return callback(null, result);
    }
}

/**
 * Gets Whiteflag state from the primary database
 * @function getState
 * @alias module:lib/datastores.getState
 * @param {datastoreGetStateCb} callback function to be called upon completion
 */
function getState(callback) {
    if (_datastoresConfig.length <= 0) return callback(new Error('No datastore configured'), null);
    _datastoresConfig.forEach(dbConfig => {
        if (dbConfig?._initialised && dbConfig.primary) {
            dbConfig._moduleImpl.getState(datastoreGetStateCb);
        }
    });
    /**
     * Callback after getting the Whiteflag state
     * @callback datastoreGetStateCb
     * @param {Error} err error object if any error
     * @param {Object} stateObject state data enclosed in a storage / encryption container
     */
    function datastoreGetStateCb(err, stateObject) {
        if (err) return callback(new Error(`Could not retrieve state from ${_primaryDatastore}: ${err.message}`));
        return callback(null, stateObject);
    }
}

// PRIVATE MODULE FUNCTIONS
// Whiteflag modules //
/**
 * Parses the base elements of the configuration before processing the configuration of each datastore
 * @private
 * @param {Object} datastoresConfig the datastores configuration object read from file
 * @returns {boolean} true if configuration could be parsed, else false
 */
function parseConfig(datastoresConfig) {
    // Check if any databases defined in datastores config
    if (datastoresConfig?.databases) {
        // Validate config file based on schema
        let datastoresConfigErrors = validateConfig(datastoresConfig);
        if (datastoresConfigErrors && datastoresConfigErrors.length > 0) {
            log.error(MODULELOG, 'Configuration errors: ' + JSON.stringify(datastoresConfigErrors));
        } else {
            // Parse config of each datastore
            datastoresConfig.databases.forEach(dbConfig => {
                dbConfig._enabled = enableDbConfig(dbConfig);
            });
            return true;
        }
    }
    return false;
}

/**
 * Validates the datastore configuration against the datastore configuration schema
 * @private
 * @param {Object} datastoresConfig the datastore configuration to be validated
 * @returns {Array} validation errors, empty if no errors
 */
function validateConfig(datastoresConfig) {
    try {
        return [].concat(array.pluck(jsonValidate(datastoresConfig, wfDatastoresConfigSchema).errors, 'stack'));
    } catch(err) {
        return [].push(err.message);
    }
}

/**
 * Enables a specific datastore and loads module (but does not yet connect to the database)
 * @private
 * @param {string} event the tx event to be checked with each enabled datastore
 * @param {Object} dbConfig the configuration of a specific database
 * @returns {boolean} true if datastore could be activated and module could be loaded, else false
 */
function enableDbConfig(dbConfig) {
    // CHeck if datastore is set to active
    if (!dbConfig?.active) return false;

    // Assure parameters are configured
    if (dbConfig?.primary !== undefined) {
        // Try loading the module to assure it exists
        try {
            dbConfig._moduleImpl = require(DSMODULEDIR + dbConfig.module);
            dbConfig._initialised = false;
        } catch(err) {
            log.error(MODULELOG, `Module ${dbConfig.module} cannot be loaded: ${err.message}`);
            return false;
        }
        // Primary datastore requires 'messageProcessed' tx and rx events configured
        if (dbConfig?.rxStoreEvent.length > -1 && dbConfig?.txStoreEvent.length > -1) {
            if (dbConfig?.primary) {
                requiredEvents.forEach(event => {
                    if (dbConfig.rxStoreEvent.indexOf(event) < 0) {
                        dbConfig.rxStoreEvent.push(event);
                        log.debug(MODULELOG, `Auto configured primary datastore ${dbConfig.name} to store message on '${event}' RX events`);
                    }
                    if (dbConfig.txStoreEvent.indexOf(event) < 0) {
                        dbConfig.txStoreEvent.push(event);
                        log.debug(MODULELOG, `Auto configured primary datastore ${dbConfig.name} to store message on '${event}' TX events`);
                    }
                });
            }
            // Handle storage of messages based on configured events.
            dbConfig.rxStoreEvent.forEach(event => {
                if (_storeEventRegister.rx.indexOf(event) < 0) {
                    wfRxEvent.on(event, function datastoreRxEventCb(wfMessage) {
                        rxStoreMessage(event, wfMessage);
                    });
                    _storeEventRegister.rx.push(event);
                }
            });
            dbConfig.txStoreEvent.forEach(event => {
                if (_storeEventRegister.tx.indexOf(event) < 0) {
                    wfTxEvent.on(event, function datastoreTxEventCb(wfMessage) {
                        txStoreMessage(event, wfMessage);
                    });
                    _storeEventRegister.tx.push(event);
                }
            });
        } else {
            // Ignore datastore because no rx and tx events defined
            log.warn(MODULELOG, `Ignoring ${dbConfig.name}: Datastore requires at least one tx and one rx event`);
            return false;
        }
    } else {
        // Ignore datastore because of incomplete configuration
        log.warn(MODULELOG, `Ignoring ${dbConfig.name}: Missing one of the following parameters in ${DSCONFFILE}: primary, module, active, txStoreEvent, rxStoreEvent`);
        return false;
    }
    // Datastore enabled
    return true;
}

/**
 * Calls init function for each datastore
 * @private
 * @param {function} callback
 */
function initDbConfig(callback) {
    // Get configuration and call init function for each datastore
    _datastoresConfig.forEach(dbConfig => {
        if (dbConfig._enabled) {
            /**
             * Callback after initialising the datastore
             * @callback datastoreInitCb
             * @param {Error} err error object if any error
             */
            dbConfig._moduleImpl.init(dbConfig, function datastoreInitCb(err) {
                if (err) {
                    log.error(MODULELOG, `Error initialising ${dbConfig.name}: ${err.message}`);
                } else {
                    dbConfig._initialised = true;
                    log.info(MODULELOG, `Initialised datastore: ${dbConfig.name}`);
                }
                // Ensure only one datastore is primary
                if (_primaryDatastore !== NOTSET) {
                    dbConfig.primary = false;
                    log.warn(MODULELOG, `Ignoring ${dbConfig.name} as primary, because ${_primaryDatastore} already is; please update ${DSCONFFILE}`);
                }
                // Only invoke callback if primary
                if (dbConfig.primary && _primaryDatastore === NOTSET) {
                    _primaryDatastore = dbConfig.name;
                    return callback(err, _primaryDatastore);
                }
            });
        }
    });
}

/**
 * Checks each enabled datastore whether message needs to be stored at tx event
 * @private
 * @param {string} event the tx event to be checked with each enabled datastore
 * @param {wfMessage} wfMessage the sent whiteflag message
 */
function txStoreMessage(event, wfMessage) {
    _datastoresConfig.forEach(dbConfig => {
        if (dbConfig?._initialised && dbConfig.txStoreEvent.indexOf(event) > -1) {
            log.trace(MODULELOG, `Storing message in ${dbConfig.name} upon tx event '${event}': ${wfMessage.MetaHeader.transactionHash}`);
            dbConfig._moduleImpl.storeMessage(wfMessage, datastoreTxStoreMessageCb);
        }
    });
    /**
     * Transmits result of storage of sent message
     * @callback txStoreMessageDbCb
     * @param {Error} err error object if any error
     * @param {wfMessage} storedMessage the stored Whiteflag message
     */
    function datastoreTxStoreMessageCb(err, storedMessage) {
        if (err) return wfTxEvent.emit('error', err);
        return wfTxEvent.emit('messageStored', storedMessage);
    }
}

/**
 * Checks each enabled datastore whether message needs to be stored at rx event
 * @private
 * @param {string} event the rx event to be checked with each enabled datastore
 * @param {wfMessage} wfMessage the received whiteflag message
 */
function rxStoreMessage(event, wfMessage) {
    _datastoresConfig.forEach(dbConfig => {
        if (dbConfig?._initialised && dbConfig.rxStoreEvent.indexOf(event) > -1) {
            log.trace(MODULELOG, `Storing message in ${dbConfig.name} upon rx event '${event}': ${wfMessage.MetaHeader.transactionHash}`);
            dbConfig._moduleImpl.storeMessage(wfMessage, datastoreRxStoreMessageCb);
        }
    });
    /**
     * Transmits result of storage of received message
     * @callback rxStoreMessageDbCb
     * @param {Error} err error object if any error
     * @param {wfMessage} storedMessage the stored Whiteflag message
     */
    function datastoreRxStoreMessageCb(err, storedMessage) {
        if (err) return wfRxEvent.emit('error', err);
        return wfRxEvent.emit('messageStored', storedMessage);
    }
}
