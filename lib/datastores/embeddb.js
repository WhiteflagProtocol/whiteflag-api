'use strict';
/**
 * @module lib/datastores/embeddb
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
 * @alias module:lib/datastores/embeddb.init
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
 * @alias module:lib/datastores/embeddb.close
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
 * @alias module:lib/datastores/embeddb.storeMessage
 * @param {wfMessage} wfMessage the whiteflag message to be stored
 * @param {datastoreStoreMessageCb} callback function to be called after storing the Whiteflag message
 */
function storeMessage(wfMessage, callback) {
    log.trace(_dbName, `Upserting message: ${wfMessage.MetaHeader.transactionHash}`);
    if (!_dbMessagesCollection) return callback(new Error(`Message collection in ${_dbName} not initialised`));

    // Insert if new else update message
    let result;
    if (_dbMessagesCollection.has(item => item.MetaHeader.transactionHash === wfMessage.MetaHeader.transactionHash)) {
        result = _dbMessagesCollection.update(
            message => {
                message.MetaHeader = wfMessage.MetaHeader;
                message.MessageHeader = wfMessage.MessageHeader;
                message.MessageBody = wfMessage.MessageBody;
            },
            item => item.MetaHeader.transactionHash === wfMessage.MetaHeader.transactionHash
        );
    } else {
        result = _dbMessagesCollection.create(wfMessage);
    }
    _dbMessagesCollection.save();
    return callback(null, result);
}

/**
 * Gets all Whiteflag messages from the database that match the query in an array
 * @function getMessages
 * @alias module:lib/datastores/embeddb.getMessages
 * @param {Object} wfQuery the properties of the messages to look up
 * @param {datastoreGetMessagesCb} callback function to be called after retrieving Whiteflag messages
 */
function getMessages(wfQuery, callback) {
    let count = 0;
    let wfMessages = [];

    // Get an array of result with all messages that match all key values in query object
    log.trace(_dbName, 'Performing message query: ' + JSON.stringify(wfQuery));
    if (JSON.stringify(wfQuery) === '{}') {
        wfMessages = _dbMessagesCollection.getAll();
        count = wfMessages.length;
    } else {
        wfMessages = _dbMessagesCollection.getMany(item => {
            let match = false;
            for (const [key, value] of Object.entries(wfQuery)) {
                const property = key.split('.').pop();
                if (property in item.MetaHeader) {
                    if (item.MetaHeader[property] === value) match = true;
                    else return false;
                }
            }
            if (match) {
                count += 1;
                return true;
            }
            return false;
        });
    }
    log.trace(_dbName, `Found ${count} messages for query: ${JSON.stringify(wfQuery)}`);
    return callback(null, wfMessages, count);
}

/**
 * Stores Whiteflag state in the database
 * @function storeState
 * @alias module:lib/datastores/embeddb.storeState
 * @param {Object} stateObject state data enclosed in a storage / encryption container
 * @param {datastoreStoreStateCb} callback function to be called after storing the Whiteflag state
 */
function storeState(stateObject, callback) {
    log.trace(_dbName, `Storing state in collection ${STATECOLLECTION}`);
    if (!_dbStateCollection) return callback(new Error(`State collection in ${_dbName} not initialised`));
    _dbStateCollection.remove();
    const result = _dbStateCollection.create(stateObject);
    _dbStateCollection.save();
    return callback(null, result);
}

/**
 * Gets Whiteflag state from the database
 * @function getState
 * @alias module:lib/datastores/embeddb.getState
 * @param {datastoreGetStateCb} callback function to be called after getting the Whiteflag state
 */
function getState(callback) {
    log.trace(_dbName, `Retrieving state from collection ${STATECOLLECTION}`);
    if (!_dbStateCollection) return callback(new Error(`State collection in ${_dbName} not initialised`));
    const stateObject = _dbStateCollection.fetch(
        state => {
            ignore(state); return true;
        }
    );
    return callback(null, stateObject);
}
