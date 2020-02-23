'use strict';
/**
 * @module lib/datastores/mongodb
 * @summary Whiteflag API mongodb datastore module
 * @description Module to use mongodb as a datastore
 * @todo add function that returns an index/cursor instead of a full array
 * @todo database authentication and ssl connection
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
let _datastore = 'mongodb';
let _messagesCollection = 'wfMessages';
let _stateCollection = 'wfState';

// MAIN MODULE FUNCTIONS //
/**
 * Initialises the database
 * @function initDatastore
 * @alias module:lib/datastores/mongodb.init
 * @param {object} dbConfig datastore configuration parameters
 * @param {datastoreInitCb} callback function to be called after initialising the datastore
 */
function initDatastore(dbConfig, callback) {
    // Preserve name of the datastore
    _datastore = dbConfig.name;

    // Connect to native database server and preserve connector
    const dbUrl = getDatabaseURL(dbConfig);
    log.trace(_datastore, `Making database connection with ${dbUrl}`);
    mongoClient.connect(dbUrl, function mongodbConnectCb(err, db) {
        if (err) return callback(err, _datastore, db);

        // Preserve connection for other database functions
        _db = db;

        // Create collections if not existing
        log.trace(_datastore, `Checking if messages collection ${_messagesCollection} exists in database`);
        _db.createCollection(_messagesCollection, err => {
            if (err) log.error(_datastore, `Error creating messages collection ${_messagesCollection} in database: ${err.message}`);
            if (!err) {
                _db.collection(_messagesCollection).ensureIndex({ 'MetaHeader.transactionHash': 1 }, {
                    unique: true,
                    dropDups: true
                }, err => {
                    if (err) log.error(_datastore, `Error checking index for collection ${_messagesCollection} in database: ${err.message}`);
                });
            }
        });
        log.trace(_datastore, `Checking if state collection ${_stateCollection} exists in database`);
        _db.createCollection(_stateCollection, err => {
            if (err) log.error(_datastore, `Error creating state collection ${_stateCollection}: ${err.message}`);
        });
        // All done
        return callback(null, _datastore, _db);
    });
}

/**
 * Closes the database
 * @function closeDatastore
 * @alias module:lib/datastores/mongodb.close
 * @param {datastoreCloseCb} callback function to be called after initialising the datastore
 */
function closeDatastore(callback) {
    log.trace(_datastore, 'Closing database connection');
    _db.close(callback);
}

/**
 * Stores a Whiteflag message in the database
 * @function storeMessage
 * @alias module:lib/datastores/mongodb.storeMessage
 * @param {object} wfMessage the whiteflag message to be stored
 * @param {datastoreStoreMessageCb} callback function to be called after storing the Whiteflag message
 */
function storeMessage(wfMessage, callback) {
    log.trace(_datastore, `Upserting message in collection ${_messagesCollection}: ${wfMessage.MetaHeader.transactionHash}`);
    _db.collection(_messagesCollection).updateOne(
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
 * @param {object} wfQuery the properties of the messages to look up
 * @param {datastoreGetMessagesCb} callback function to be called after retrieving Whiteflag messages
 */
function getMessages(wfQuery, callback) {
    let count = 0;
    let wfMessages = [];

    // Get cursor into full collection and create array of messages
    let cursor = _db.collection(_messagesCollection).find(wfQuery);
    cursor.each(function mongodbGetMessagesCb(err, wfMessage) {
        if (!wfMessage) {
            // No more messages
            log.trace(_datastore, `Found ${count} message for query: ${JSON.stringify(wfQuery)}`);
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
 * @param {object} stateObject state data enclosed in a storage / encryption container
 * @param {datastoreStoreStateCb} callback function to be called after storing the Whiteflag state
 */
function storeState(stateObject, callback) {
    log.trace(_datastore, `Storing state in collection ${_stateCollection}`);
    _db.collection(_stateCollection).findOneAndReplace(
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
    log.trace(_datastore, `Retrieving state from collection ${_stateCollection}`);
    _db.collection(_stateCollection).findOne(
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
 * @param {object} dbConfig datastore configuration parameters
 * @returns {URL}
 */
function getDatabaseURL(dbConfig) {
    const dbProtocol = (dbConfig.dbProtocol || 'http') + '://';
    const dbHost = dbConfig.dbHost || 'localhost';
    const dbPort = ':' + (dbConfig.dbPort || '27017');
    const dbPath = '/' + (dbConfig.database || 'whiteflag');
    let dbAuth = '';
    if (dbConfig.username && dbConfig.password) {
        dbAuth = dbConfig.username + ':' + dbConfig.password + '@';
    }
    return (dbProtocol + dbAuth + dbHost + dbPort + dbPath);
}
