'use strict';
/**
 * @module lib/datastores/
 * @summary Whiteflag API embedded datastore module
 * @description Module to use an embedded datastore
 */
module.exports = {
    // Database functions
    init: initDatastore,
    close: closeDatastore,
    storeMessage,
    getMessages,
    storeState,
    getState
};

// Node.js core and external modules //
const fs = require('fs');
const SimpleDB = require('simpl.db');

// Whiteflag common functions and classes //
// eslint-disable-next-line no-unused-vars
const log = require('../common/logger');
const { ignore } = require('../common/processing');
const { ProcessingError } = require('../common/errors');

// Module variables //
let _db;
let _dbName = 'embedded-db';
let _dbMessagesCollection;
let _dbStateCollection;

// Module constants //
const MESSAGECOLLECTION = 'wfMessages';
const STATECOLLECTION = 'wfState';
const DATAFILE = 'wfDatastore';

// MAIN MODULE FUNCTIONS //
/**
 * Initialises the database
 * @function initDatastore
 * @alias module:lib/datastores/.init
 * @param {Object} dbConfig datastore configuration parameters
 * @param {datastoreInitCb} callback function to be called after initialising the datastore
 */
function initDatastore(dbConfig, callback) {
    // Preserve name of the datastore
    _dbName = dbConfig.name;

    // Check folder and file access
    if (!fs.existsSync(dbConfig.directory)) {
        try {
            fs.mkdirSync(dbConfig.directory, { recursive: true });
        } catch(err) {
            log.error(_dbName, `Error creating collections folder ${dbConfig.directory}: ${err.message}`);
            return callback(err, null);
        }
    }
    fs.access(dbConfig.directory, fs.constants.W_OK, err => {
        if (err) {
            log.error(_dbName, `Error writing to collections folder ${dbConfig.directory}: ${err.message}`);
            return callback(err, null);
        } else {
            // Database configuration
            const dbDataFile = dbConfig.directory + '/' + DATAFILE + '.json';
            const dbOptions = {
                autoSave: false,
                collectionTimestamps: true,
                collectionsFolder: dbConfig.directory,
                dataFile: dbDataFile
            };
            // Connect to datastore and preserve connector
            _db = new SimpleDB(dbOptions);
            log.trace(_dbName, `Openend embedded SimpleDB database version ${_db.version}`);

            // Collection for Whiteflag protocol state
            _dbStateCollection = _db.createCollection(STATECOLLECTION);
            _dbStateCollection.save();

            // Collection for Whiteflag messages
            _dbMessagesCollection = _db.createCollection(MESSAGECOLLECTION);
            _dbMessagesCollection.save();

            // All done
            log.info(_dbName, 'Collections in database: ' + JSON.stringify(_db.collections));
            _db.save();
            return callback(null, _dbName, _db);
        }
    });
}

/**
 * Closes the database
 * @function closeDatastore
 * @alias module:lib/datastores/.close
 * @param {datastoreCloseCb} callback function to be called after initialising the datastore
 */
function closeDatastore(callback) {
    log.trace(_dbName, 'Closing database connection');
    _db.save();
    return callback(null);
}

/**
 * Stores a Whiteflag message in the database
 * @function storeMessage
 * @alias module:lib/datastores/.storeMessage
 * @param {wfMessage} wfMessage the whiteflag message to be stored
 * @param {datastoreStoreMessageCb} callback function to be called after storing the Whiteflag message
 */
function storeMessage(wfMessage, callback) {
    // TODO: Do stuff to store a message in the datastore
    ignore(wfMessage);
    return callback(new ProcessingError('Function not implemented for this datastore', null, 'WF_API_NOT_IMPLEMENTED'), null);
}

/**
 * Gets all Whiteflag messages from the database that match the query in an array
 * @function getMessages
 * @alias module:lib/datastores/.getMessages
 * @param {Object} wfQuery the properties of the messages to look up
 * @param {datastoreGetMessagesCb} callback function to be called after retrieving Whiteflag messages
 */
function getMessages(wfQuery, callback) {
    // TODO: Do stuff to query the datastore
    ignore(wfQuery);
    return callback(new ProcessingError('Function not implemented for this datastore', null, 'WF_API_NOT_IMPLEMENTED'), null);
}

/**
 * Stores Whiteflag state in the database
 * @function storeState
 * @alias module:lib/datastores/.storeState
 * @param {Object} stateObject state data enclosed in a storage / encryption container
 * @param {datastoreStoreStateCb} callback function to be called after storing the Whiteflag state
 */
function storeState(stateObject, callback) {
    log.trace(_dbName, `Storing state in collection ${STATECOLLECTION}`);
    _dbStateCollection.remove();
    const result = _dbStateCollection.create(stateObject);
    _dbStateCollection.save();
    return callback(null, result);
}

/**
 * Gets Whiteflag state from the database
 * @function getState
 * @alias module:lib/datastores/.getState
 * @param {datastoreGetStateCb} callback function to be called after getting the Whiteflag state
 */
function getState(callback) {
    log.trace(_dbName, `Retrieving state from collection ${STATECOLLECTION}`);
    if (!_dbStateCollection) return callback(new Error(`State collection in ${_dbName} not initialised`));
    const stateObject = _dbStateCollection.fetch(function embeddeddbGetStateCb(state) {
        ignore(state); return true;
    });
    return callback(null, stateObject);
}
