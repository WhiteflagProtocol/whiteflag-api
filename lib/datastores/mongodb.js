'use strict';
/**
 * @module lib/datastores/mongodb
 * @summary Whiteflag API mongodb datastore module
 * @description Module to use mongodb as a datastore
 * @tutorial modules
 */
module.exports = {
    // Mongodb datastore functions
    init: initDatastore,
    close: closeDatastore,
    storeMessage,
    getMessages,
    storeState,
    getState
};

// Node.js core and external modules //
const mongoClient = require('mongodb').MongoClient;

// Whiteflag common functions and classes //
const log = require('../common/logger');

// Module variables //
let _db;
let _dbName = 'mongodb';
let _dbClient;
let _dbMessagesCollection;
let _dbStateCollection;

// Module constants //
const MESSAGECOLLECTION = 'wfMessages';
const STATECOLLECTION = 'wfState';
const dbOptions = {
    useUnifiedTopology: true
};

// MAIN MODULE FUNCTIONS //
/**
 * Initialises the database
 * @function initDatastore
 * @alias module:lib/datastores/mongodb.init
 * @param {Object} dbConfig datastore configuration parameters
 * @param {datastoreInitCb} callback function to be called after initialising the datastore
 */
function initDatastore(dbConfig, callback) {
    // Preserve name of the datastore
    _dbName = dbConfig.name;

    // Connect to native database server and preserve connector
    const dbUrl = getDatabaseURL(dbConfig);
    mongoClient.connect(dbUrl, dbOptions, function mongodbConnectCb(err, client) {
        if (err) return callback(err, _dbName, client);
        log.debug(_dbName, `Opened database at ${dbUrl}`);

        // Get correct database
        _dbClient = client;
        _db = _dbClient.db((dbConfig.database || 'whiteflag'));

        // Collection for Whiteflag protocol state
        log.trace(_dbName, `Checking if state collection ${STATECOLLECTION} exists in database`);
        _dbStateCollection = _db.collection(STATECOLLECTION, err => {
            if (err) log.error(_dbName, `Error creating state collection ${STATECOLLECTION}: ${err.message}`);
        });
        // Collection for Whiteflag messages
        log.trace(_dbName, `Checking if messages collection ${MESSAGECOLLECTION} exists in database`);
        _dbMessagesCollection = _db.collection(MESSAGECOLLECTION, err => {
            if (err) log.error(_dbName, `Error creating messages collection ${MESSAGECOLLECTION} in database: ${err.message}`);
            if (!err) {
                _db.collection(MESSAGECOLLECTION).createIndex({ 'MetaHeader.transactionHash': 1 }, {
                    unique: true,
                    dropDups: true
                }, err => {
                    if (err) log.error(_dbName, `Error checking index for collection ${MESSAGECOLLECTION} in database: ${err.message}`);
                });
            }
        });
        // All done
        return callback(null, _dbName, _db);
    });
}

/**
 * Closes the database
 * @function closeDatastore
 * @alias module:lib/datastores/mongodb.close
 * @param {datastoreCloseCb} callback function to be called after initialising the datastore
 */
function closeDatastore(callback) {
    log.trace(_dbName, 'Closing database connection');
    _dbClient.close(callback);
}

/**
 * Stores a Whiteflag message in the database
 * @function storeMessage
 * @alias module:lib/datastores/mongodb.storeMessage
 * @param {wfMessage} wfMessage the whiteflag message to be stored
 * @param {datastoreStoreMessageCb} callback function to be called after storing the Whiteflag message
 */
function storeMessage(wfMessage, callback) {
    log.trace(_dbName, `Upserting message: ${wfMessage.MetaHeader.transactionHash}`);
    if (!_dbMessagesCollection) return callback(new Error(`Message collection in ${_dbName} not initialised`));
    _dbMessagesCollection.updateOne(
        { 'MetaHeader.transactionHash': wfMessage.MetaHeader.transactionHash },
        {
            $currentDate: { _modified: true },
            $set: {
                MetaHeader: wfMessage.MetaHeader,
                MessageHeader: wfMessage.MessageHeader,
                MessageBody: wfMessage.MessageBody
            }
        },
        { upsert: true },
        function mongodbUpsertMessageCb(err, result) {
            return callback(err, result);
    });
}

/**
 * Gets all Whiteflag messages from the database that match the query in an array
 * @function getMessages
 * @alias module:lib/datastores/mongodb.getMessages
 * @param {Object} wfQuery the properties of the messages to look up
 * @param {datastoreGetMessagesCb} callback function to be called after retrieving Whiteflag messages
 */
function getMessages(wfQuery, callback) {
    let count = 0;
    let wfMessages = [];

    // Get cursor into full collection and create array of messages
    log.trace(_dbName, 'Performing message query: ' + JSON.stringify(wfQuery));
    if (!_dbMessagesCollection) return callback(new Error(`Message collection in ${_dbName} not initialised`));
    let cursor = _dbMessagesCollection.find(wfQuery);
    cursor.each(function mongodbGetMessagesCb(err, wfMessage) {
        if (!wfMessage) {
            // No more messages
            log.trace(_dbName, `Found ${count} messages for query: ${JSON.stringify(wfQuery)}`);
            return callback(err, wfMessages, count);
        }
        wfMessages[count] = wfMessage;
        count += 1;
    });
}

/**
 * Stores Whiteflag state in the database
 * @function storeState
 * @alias module:lib/datastores/mongodb.storeState
 * @param {Object} stateObject state data enclosed in a storage / encryption container
 * @param {datastoreStoreStateCb} callback function to be called after storing the Whiteflag state
 */
function storeState(stateObject, callback) {
    log.trace(_dbName, `Storing state in collection ${STATECOLLECTION}`);
    if (!_dbStateCollection) return callback(new Error(`State collection in ${_dbName} not initialised`));
    _dbStateCollection.findOneAndReplace(
        {},
        stateObject,
        { upsert: true },
        function mongodbUpsertStateCb(err, result) {
            return callback(err, result);
        }
    );
}

/**
 * Gets Whiteflag state from the database
 * @function getState
 * @alias module:lib/datastores/mongodb.getState
 * @param {datastoreGetStateCb} callback function to be called after getting the Whiteflag state
 */
function getState(callback) {
    log.trace(_dbName, `Retrieving state from collection ${STATECOLLECTION}`);
    if (!_dbStateCollection) return callback(new Error(`State collection in ${_dbName} not initialised`));
    _dbStateCollection.findOne(
        {},
        function mongodbGetStateCb(err, stateObject) {
            return callback(err, stateObject);
        }
    );
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Gets URL of the MongoDB server from the configuration
 * @private
 * @param {Object} dbConfig datastore configuration parameters
 * @returns {string} url
 */
function getDatabaseURL(dbConfig) {
    const dbProtocol = (dbConfig.dbProtocol || 'http') + '://';
    const dbHost = dbConfig.dbHost || 'localhost';
    const dbPort = ':' + (dbConfig.dbPort || '27017');
    let dbAuth = '';
    if (dbConfig.username && dbConfig.password) {
        dbAuth = dbConfig.username + ':' + dbConfig.password + '@';
    }
    return (dbProtocol + dbAuth + dbHost + dbPort);
}
