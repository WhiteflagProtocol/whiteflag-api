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
    init: initDatastores,
    close: closeDatastores,
    storeMessage,
    getMessages,
    storeState,
    getState
};

/* Node.js core and external modules */
const fs = require('fs');
const toml = require('toml');
const jsonValidate = require('jsonschema').validate;

/* Common internal functions and classes */
const arr = require('./_common/arrays');
const log = require('./_common/logger');
const { ignore } = require('./_common/processing');

/* Whiteflag modules */
const wfRxEvent = require('./protocol/events').rxEvent;
const wfTxEvent = require('./protocol/events').txEvent;

/* Module constants */
const NOTSET = '(uninitialsed)';
const MODULELOG = 'datastores';
const WFCONFDIR = process.env.WFCONFDIR || './config';
const DSCONFFILE = WFCONFDIR + '/datastores.toml';
const DSMODULEDIR = './datastores/';
const requiredEvents = ['messageProcessed', 'messageUpdated'];
const wfDatastoresConfigSchema = JSON.parse(fs.readFileSync('./lib/datastores/_static/datastores.config.schema.json'));

/* Module variables */
let _datastores = [];
let _datastoresConfig = [];
let _primaryDatastore = NOTSET;
let _storeEventRegister = {
    rx: [],
    tx: []
};

/* MAIN MODULE FUNCTIONS */
/**
 * Initialises configured datastores
 * @function initDatastores
 * @alias module:lib/datastores.init
 * @param {datastoreInitCb} callback function called on completion
 */
function initDatastores(callback) {
    // Read the configuration file
    let datastoresConfig = {};
    try {
        datastoresConfig = toml.parse(fs.readFileSync(DSCONFFILE));
    } catch(err) {
        return callback(new Error(`Could not read configuration in ${DSCONFFILE}: ${err.message}`));
    }
    // Parse config file and initialise each enabled blockchain
    if (parseConfig(datastoresConfig)) {
        _datastoresConfig = datastoresConfig.databases;

        // Get array of names of configured datastores
        _datastores = arr.pluck(_datastoresConfig, 'name');
        log.debug(MODULELOG, `Configured datastores in ${DSCONFFILE}: ` + JSON.stringify(_datastores));

        // Pass result of initialization to callback
        return initdbInstance(callback);
    } else {
        return callback(new Error(`Could not parse configuration in ${DSCONFFILE}`));
    }
}

/**
 * Closes configured datastores
 * @function closeDatastores
 * @alias module:lib/datastores.close
 * @param {genericCb} callback function called on completion
 */
function closeDatastores(callback) {
    _datastoresConfig.forEach(dbInstance => {
        // Get configuration and call init function for this datastore
        if (dbInstance._enabled) {
            /**
             * Callback after closing the datastore
             * @callback datastoreInitCb
             * @param {Error} err any error
             */
            dbInstance._module.close(function datastoreCloseCb(err) {
                dbInstance._initialised = false;
                if (err) {
                    log.error(MODULELOG, `Error closing ${dbInstance.name}: ${err.message}`);
                } else {
                    log.info(MODULELOG, `Closed datastore: ${dbInstance.name}`);
                }
                // Only callback for primary datastore
                if (dbInstance.primary) return callback(err, _primaryDatastore);
            });
        }
    });
}

/**
 * Stores Whiteflag messsage in active and enabled datastores
 * @function storeMessage
 * @alias module:lib/datastores.storeMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be stored
 * @param {datastoreStoreMessageCb} callback function called on completion
 */
function storeMessage(wfMessage = {}, callback) {
    if (_datastoresConfig.length <= 0) return callback(new Error('No datastore configured'), null);
    _datastoresConfig.forEach(dbInstance => {
        if (dbInstance._initialised) {
            /**
             * Callback after storing the Whiteflag message
             * @callback datastoreStoreMessageCb
             * @param {Error} err any error
             * @param {*} result the result
             */
            dbInstance._module.storeMessage(wfMessage, function datastoreStoreMessageCb(err, result) {
                if (err) log.error(MODULELOG, `Could not store message in ${dbInstance.name}: ${err.message}`);

                // Only call callback for primary datastore
                if (dbInstance.primary) {
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
 * @param {datastoreGetMessagesCb} callback function called on completion
 */
function getMessages(wfQuery = {}, callback) {
    if (_datastoresConfig.length <= 0) return callback(new Error('No datastore configured'), null);
    return getPrimaryDatastore().getMessages(wfQuery, datastoreGetMessagesCb);
    /**
     * Callback after retrieving Whiteflag messages
     * @callback datastoreGetMessagesCb
     * @param {Error} err any error
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
 * @param {datastoreStoreStateCb} callback function called on completion
 */
function storeState(stateObject, callback) {
    if (_datastoresConfig.length <= 0) return callback(new Error('No datastore configured'), null);
    return getPrimaryDatastore().storeState(stateObject, datastoreStoreStateCb);
    /**
     * Callback after storing the Whiteflag state
     * @callback datastoreStoreStateCb
     * @param {Error} err any error
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
 * @param {datastoreGetStateCb} callback function called on completion
 */
function getState(callback) {
    if (_datastoresConfig.length <= 0) return callback(new Error('No datastore configured'), null);
    return getPrimaryDatastore().getState(datastoreGetStateCb);
    /**
     * Callback after getting the Whiteflag state
     * @callback datastoreGetStateCb
     * @param {Error} err any error
     * @param {Object} stateObject state data enclosed in a storage / encryption container
     */
    function datastoreGetStateCb(err, stateObject) {
        if (err) return callback(new Error(`Could not retrieve state from ${_primaryDatastore}: ${err.message}`));
        return callback(null, stateObject);
    }
}

/* PRIVATE MODULE FUNCTIONS
/**
 * Returns the primary datastore module
 * @private
 */
function getPrimaryDatastore() {
    const dbInstance = _datastoresConfig.find(dbInstance => {
        return (dbInstance._initialised && dbInstance.primary);
    });
    if (dbInstance) return dbInstance._module;
    throw new Error(`No primary datastore initialized`);
}

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
        if (datastoresConfigErrors?.length > 0) {
            log.error(MODULELOG, 'Configuration errors: ' + JSON.stringify(datastoresConfigErrors));
        } else {
            // Parse config of each datastore
            datastoresConfig.databases.forEach(dbInstance => {
                dbInstance._enabled = enabledbInstance(dbInstance);
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
        return [].concat(arr.pluck(jsonValidate(datastoresConfig, wfDatastoresConfigSchema).errors, 'stack'));
    } catch(err) {
        return [].push(err.message);
    }
}

/**
 * Enables a specific datastore and loads module (but does not yet connect to the database)
 * @private
 * @param {string} event the tx event to be checked with each enabled datastore
 * @param {Object} dbInstance the configuration of a specific database
 * @returns {boolean} true if datastore could be activated and module could be loaded, else false
 */
function enabledbInstance(dbInstance) {
    // CHeck if datastore is set to active
    if (!dbInstance.active) return false;

    // Assure parameters are configured
    if (dbInstance.primary !== undefined) {
        // Try loading the module to assure it exists
        try {
            dbInstance._module = require(DSMODULEDIR + dbInstance.module);
            dbInstance._initialised = false;
        } catch(err) {
            log.error(MODULELOG, `Module ${dbInstance.module} cannot be loaded: ${err.message}`);
            return false;
        }
        // Primary datastore requires 'messageProcessed' tx and rx events configured
        if (dbInstance.rxStoreEvent.length > -1 && dbInstance.txStoreEvent.length > -1) {
            if (dbInstance.primary) {
                requiredEvents.forEach(event => {
                    if (dbInstance.rxStoreEvent.indexOf(event) < 0) {
                        dbInstance.rxStoreEvent.push(event);
                        log.debug(MODULELOG, `Auto configured primary datastore ${dbInstance.name} to store message on '${event}' RX events`);
                    }
                    if (dbInstance.txStoreEvent.indexOf(event) < 0) {
                        dbInstance.txStoreEvent.push(event);
                        log.debug(MODULELOG, `Auto configured primary datastore ${dbInstance.name} to store message on '${event}' TX events`);
                    }
                });
            }
            // Handle storage of messages based on configured events
            dbInstance.rxStoreEvent.forEach(event => {
                if (_storeEventRegister.rx.indexOf(event) < 0) {
                    wfRxEvent.on(event, function datastoreRxEventCb(wfMessage) {
                        rxStoreMessage(event, wfMessage);
                    });
                    _storeEventRegister.rx.push(event);
                }
            });
            dbInstance.txStoreEvent.forEach(event => {
                if (_storeEventRegister.tx.indexOf(event) < 0) {
                    wfTxEvent.on(event, function datastoreTxEventCb(wfMessage) {
                        txStoreMessage(event, wfMessage);
                    });
                    _storeEventRegister.tx.push(event);
                }
            });
        } else {
            // Ignore datastore because no rx and tx events defined
            log.warn(MODULELOG, `Ignoring ${dbInstance.name}: Datastore requires at least one tx and one rx event`);
            return false;
        }
    } else {
        // Ignore datastore because of incomplete configuration
        log.warn(MODULELOG, `Ignoring ${dbInstance.name}: Missing one of the following parameters in ${DSCONFFILE}: primary, module, active, txStoreEvent, rxStoreEvent`);
        return false;
    }
    // Datastore enabled
    return true;
}

/**
 * Calls init function for each datastore
 * @private
 * @param {genericCb} callback
 */
function initdbInstance(callback) {
    // Get configuration and call init function for each datastore
    _datastoresConfig.forEach(dbInstance => {
        if (dbInstance._enabled) {
            /**
             * Callback after initialising the datastore
             * @callback datastoreInitCb
             * @param {Error} err any error
             */
            dbInstance._module.init(dbInstance, function datastoreInitCb(err) {
                if (err) {
                    log.error(MODULELOG, `Error initialising ${dbInstance.name}: ${err.message}`);
                } else {
                    dbInstance._initialised = true;
                    log.info(MODULELOG, `Initialised datastore: ${dbInstance.name}`);
                }
                // Ensure only one datastore is primary
                if (_primaryDatastore !== NOTSET) {
                    dbInstance.primary = false;
                    log.warn(MODULELOG, `Ignoring ${dbInstance.name} as primary, because ${_primaryDatastore} already is; please update ${DSCONFFILE}`);
                }
                // Only invoke callback if primary
                if (dbInstance.primary && _primaryDatastore === NOTSET) {
                    _primaryDatastore = dbInstance.name;
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
    _datastoresConfig.forEach(dbInstance => {
        if (dbInstance._initialised && dbInstance.txStoreEvent.indexOf(event) > -1) {
            log.trace(MODULELOG, `Storing message in ${dbInstance.name} upon tx event '${event}': ${wfMessage.MetaHeader.transactionHash}`);
            dbInstance._module.storeMessage(wfMessage, datastoreTxStoreMessageCb);
        }
    });
    /**
     * Transmits result of storage of sent message
     * @callback txStoreMessageDbCb
     * @param {Error} err any error
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
    _datastoresConfig.forEach(dbInstance => {
        if (dbInstance._initialised && dbInstance.rxStoreEvent.indexOf(event) > -1) {
            log.trace(MODULELOG, `Storing message in ${dbInstance.name} upon rx event '${event}': ${wfMessage.MetaHeader.transactionHash}`);
            dbInstance._module.storeMessage(wfMessage, datastoreRxStoreMessageCb);
        }
    });
    /**
     * Transmits result of storage of received message
     * @callback rxStoreMessageDbCb
     * @param {Error} err any error
     * @param {wfMessage} storedMessage the stored Whiteflag message
     */
    function datastoreRxStoreMessageCb(err, storedMessage) {
        if (err) return wfRxEvent.emit('error', err);
        return wfRxEvent.emit('messageStored', storedMessage);
    }
}
