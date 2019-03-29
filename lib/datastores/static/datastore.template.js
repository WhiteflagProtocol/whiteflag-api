'use strict';
/**
 * @module lib/datastores/
 * @summary Whiteflag API datastore template
 * @description Module template to develop a specific datastore implementation
 */
module.exports = {
    // Database functions
    init: initDatastore,
    storeMessage,
    getMessages,
    storeState,
    getState
};

// Node.js core and external modules //
// eslint-disable-next-line no-unused-vars
const someDatabase = require('someDatabase');

// Whiteflag common functions and classes //
// eslint-disable-next-line no-unused-vars
const log = require('../common/logger');
const { ProcessingError } = require('../common/errors');

// Module variables //
let _datastore;
let _db;

// MAIN MODULE FUNCTIONS //
/**
 * Initialises the database
 * @function initDatastore
 * @alias module:lib/datastores/.init
 * @param {object} dbConfig datastore configuration parameters
 * @param {datastoreInitCb} callback function to be called after initialising the datastore
 */
function initDatastore(dbConfig, callback) {
    // Preserve name of the datastore
    _datastore = dbConfig.name;

    // TODO: Do stuff to initialise the datastore
    _db = null;
    return callback(new ProcessingError('Function not implemented for this datastore', null, 'WF_API_NOT_IMPLEMENTED'));
}

/**
 * Stores a Whiteflag message in the database
 * @function storeMessage
 * @alias module:lib/datastores/.storeMessage
 * @param {object} wfMessage the whiteflag message to be stored
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
 * @param {object} wfQuery the properties of the messages to look up
 * @param {datastoreGetMessagesCb} callback function to be called after retrieving Whiteflag messages
 * @returns
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
 * @param {object} stateObject state data enclosed in a storage / encryption container
 * @param {datastoreStoreStateCb} callback function to be called after storing the Whiteflag state
 * @returns
 */
function storeState(stateObject, callback) {
    // TODO: Do stuff to store the state in the datastore
    ignore(stateObject);
    return callback(new ProcessingError('Function not implemented for this datastore', null, 'WF_API_NOT_IMPLEMENTED'));
}

/**
 * Gets Whiteflag state from the database
 * @function getState
 * @alias module:lib/datastores/.getState
 * @param {datastoreGetStateCb} callback function to be called after getting the Whiteflag state
 * @returns
 */
function getState(callback) {
     // TODO: Do stuff to get the state from the datastore
    return callback(new ProcessingError('Function not implemented for this datastore', null, 'WF_API_NOT_IMPLEMENTED'), null);
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}
