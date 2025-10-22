'use strict';
/**
 * @module lib/datastores/embeddb
 * @summary Whiteflag API embedded datastore module
 * @description Module to use an embedded datastore
 */
module.exports = {
    init: initDatastore,
    close: closeDatastore,
    storeMessage,
    getMessages,
    storeState,
    getState
};

/* Node.js core and external modules */
const fs = require('fs');
const SimpleDB = require('simpl.db');

/* Common internal functions and classes */
const log = require('../_common/logger');
const { ignore } = require('../_common/processing');

/* Module variables */
let _db;
let _dbName = 'embedded-db';
let _dbMessagesCollection;
let _dbStateCollection;

/* Module constants */
const MESSAGECOLLECTION = 'wfMessages';
const STATECOLLECTION = 'wfState';
const DATAFILE = 'wfDatastore';

/* MAIN MODULE FUNCTIONS */
/**
 * Initialises the database
 * @function initDatastore
 * @alias module:lib/datastores/embeddb.init
 * @param {Object} dbConfig datastore configuration parameters
 * @param {datastoreInitCb} callback function called after initialising the datastore
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
            log.debug(_dbName, `Openend embedded database version ${_db.version}`);

            // Collection for Whiteflag protocol state
            _dbStateCollection = _db.createCollection(STATECOLLECTION);
            _dbStateCollection.save();

            // Collection for Whiteflag messages
            _dbMessagesCollection = _db.createCollection(MESSAGECOLLECTION);
            _dbMessagesCollection.save();

            // All done
            log.debug(_dbName, 'Collections in database: ' + JSON.stringify(_db.collections));
            _db.save();
            return callback(null, _dbName, _db);
        }
    });
}

/**
 * Closes the database
 * @function closeDatastore
 * @alias module:lib/datastores/embeddb.close
 * @param {datastoreCloseCb} callback function called after initialising the datastore
 */
function closeDatastore(callback) {
    log.trace(_dbName, 'Closing database connection');
    _db.save();
    return callback(null);
}

/**
 * Stores a Whiteflag message in the database, preserving the transceive direction
 * @function storeMessage
 * @alias module:lib/datastores/embeddb.storeMessage
 * @param {wfMessage} wfMessage the whiteflag message to be stored
 * @param {datastoreStoreMessageCb} callback function called after storing the Whiteflag message
 */
function storeMessage(wfMessage, callback) {
    log.trace(_dbName, `Upserting message: ${wfMessage.MetaHeader.transactionHash}`);
    if (!_dbMessagesCollection) return callback(new Error(`Message collection in ${_dbName} not initialised`));

    // Insert if new else update message
    let result;
    if (_dbMessagesCollection.has(item => item.MetaHeader.transactionHash === wfMessage.MetaHeader.transactionHash)) {
        result = _dbMessagesCollection.update(
            message => {
                // Preserve transceive direction
                const transceiveDirection = message.MetaHeader?.transceiveDirection
                                            || wfMessage.MetaHeader?.transceiveDirection;
                message.MetaHeader = wfMessage.MetaHeader;
                message.MetaHeader.transceiveDirection = transceiveDirection;
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
 * Gets all Whiteflag messages from the database that messageMatch the query in an array
 * @function getMessages
 * @alias module:lib/datastores/embeddb.getMessages
 * @param {Object} wfQuery the properties of the messages to look up
 * @param {datastoreGetMessagesCb} callback function called after retrieving Whiteflag messages
 */
function getMessages(wfQuery, callback) {
    log.trace(_dbName, 'Performing message query: ' + JSON.stringify(wfQuery));

    // Get an array of result with all messages that match all key values in query object
    const properties = Object.entries(wfQuery);
    let wfMessages = [];
    if (JSON.stringify(wfQuery) === '{}') {
        wfMessages = _dbMessagesCollection.getAll();
    } else {
        wfMessages = _dbMessagesCollection.getMany(message => {
            let match = 0;
            for (const [key, value] of properties) {
                const property = key.split('.').pop();
                if (property in message.MetaHeader) {
                    if (message.MetaHeader[property] === value) match += 1;
                } else if (property in message.MessageHeader) {
                    if (message.MessageHeader[property] === value) match += 1;
                } else return false;
            }
            if (match === properties.length) return true;
            return false;
        });
    }
    log.trace(_dbName, `Found ${wfMessages.length} messages for query: ${JSON.stringify(wfQuery)}`);
    return callback(null, wfMessages, wfMessages.length);
}

/**
 * Stores Whiteflag state in the database
 * @function storeState
 * @alias module:lib/datastores/embeddb.storeState
 * @param {Object} stateObject state data enclosed in a storage / encryption container
 * @param {datastoreStoreStateCb} callback function called after storing the Whiteflag state
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
 * @param {datastoreGetStateCb} callback function called after getting the Whiteflag state
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
