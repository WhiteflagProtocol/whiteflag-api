'use strict';
/**
 * @module lib/datastores/rest
 * @summary Whiteflag API rest datastore module
 * @description Module to use a database with a http rest interface
 */
module.exports = {
    // Rest datastore functions
    init: initRest,
    close: closeRest,
    storeMessage,
    getMessages,
    storeState,
    getState
};

// Node.js core and external modules //
const request = require('request');

// Whiteflag common functions and classes //
const log = require('../common/logger');

// Module constants //
const MESSAGECONTEXT = 'context=message';
const STATECONTEXT = 'context=state';
const HBCONTEXT = 'context=heartbeat';

// Module variables //
let _dbName = 'rest';
let _restURL = '';
let _restAuthHeader = '';

// MAIN MODULE FUNCTIONS //
/**
 * Initialises the database
 * @function initRest
 * @alias module:lib/datastores/rest.init
 * @param {Object} dbConfig datastore configuration parameters
 * @param {datastoreInitCb} callback function to be called after initialising the datastore
 */
function initRest(dbConfig, callback) {
    // Preserve name of the datastore
    _dbName = dbConfig.name;

    // Get rest URL parameters
    _restURL = getDatabaseURL(dbConfig);
    _restAuthHeader = getDatabaseAuthHeader(dbConfig);

    // Perform dummy call to assure config is correct
    log.trace(_dbName, `Checking http connection with ${_restURL}`);
    request(createRequestOptions(HBCONTEXT, null), function restCheckConnectionCb(err, response, body) {
        ignore(response);
        ignore(body);
        if (err) return callback(err, null);
        return callback(null, _dbName);
    });
}

/**
 * Closes the database
 * @function closeRest
 * @alias module:lib/datastores/rest.close
 * @param {datastoreCloseCb} callback function to be called after initialising the datastore
 */
function closeRest(callback) {
    log.trace(_dbName, 'Closing database connection');
    return callback();
}

/**
 * Stores a Whiteflag message in the database
 * @function storeMessage
 * @alias module:lib/datastores/rest.storeMessage
 * @param {wfMessage} wfMessage the whiteflag message to be stored
 * @param {datastoreStoreMessageCb} callback function to be called after storing the Whiteflag message
 */
function storeMessage(wfMessage, callback) {
    log.trace(_dbName, `Storing message: ${wfMessage.MetaHeader.transactionHash}`);

    let requestOptions = createRequestOptions(MESSAGECONTEXT, null);
    requestOptions.body = JSON.stringify(wfMessage);

    // Make http request to store message
    request.post(requestOptions, function restStoreMessageCb(err, response, body) {
        if (err) return callback(err, null);
        if (response.statusCode === 200) {
            return processResponseBody(body, callback);
        }
        return callback(new Error(JSON.stringify(response)));
    });
}

/**
 * Gets all Whiteflag messages from the database that match the query in an array
 * @function getMessages
 * @alias module:lib/datastores/rest.getMessages
 * @param {Object} wfQuery the properties of the messages to look up
 * @param {datastoreGetMessagesCb} callback function to be called after retrieving Whiteflag messages
 */
function getMessages(wfQuery, callback) {
    log.trace(_dbName, 'Performing message query: ' + JSON.stringify(wfQuery));

    // Make http request to retrieve messages
    request(createRequestOptions(MESSAGECONTEXT, wfQuery), function restCreateRequestCb(err, response, body) {
        if (err) return callback(err);
        if (response.statusCode === 200) {
            // return callback(null, JSON.parse(body));
            return processResponseBody(body, callback);
        }
        return callback(new Error(JSON.stringify(response)));
    });
}

/**
 * Stores Whiteflag state in the database
 * @function storeState
 * @alias module:lib/datastores/rest.storeState
 * @param {Object} stateObject state data enclosed in a storage / encryption container
 * @param {datastoreStoreStateCb} callback function to be called after storing the Whiteflag state
 */
function storeState(stateObject, callback) {
    log.trace(_dbName, 'Storing state');

    let requestOptions = createRequestOptions(STATECONTEXT, null);
    requestOptions.body = JSON.stringify(stateObject);

    // Make http request to store state
    request.post(requestOptions, function restUpsertStateCb(err, response, body) {
        if (err) return callback(err);
        if (response.statusCode === 200) {
            // return callback(null, JSON.parse(body));
            return processResponseBody(body, callback);
        }
        return callback(new Error(JSON.stringify(response)));
    });
}

/**
 * Gets Whiteflag state from the database
 * @function getState
 * @alias module:lib/datastores/.getState
 * @param {datastoreGetStateCb} callback function to be called after getting the Whiteflag state
 */
function getState(callback) {
    log.trace(_dbName, 'Retrieving state');

    // Make http request to retrieve messages
    request(createRequestOptions(STATECONTEXT, null), function restGetStateCb(err, response, body) {
        if (err) return callback(err);
        if (response.statusCode === 200) {
            return processResponseBody(body, callback);
        }
        return callback(new Error(JSON.stringify(response)));
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}

/**
 * Gets URL for the REST datastore from the configuration
 * @private
 * @param {Object} dbConfig datastore configuration parameters
 * @returns {string} url
 */
function getDatabaseURL(dbConfig) {
    // Puts configuration parameters in a single url string
    const dbProtocol = (dbConfig.dbProtocol || 'http') + '://';
    const dbHost = dbConfig.dbHost || 'localhost';
    let dbPort = '';
    if (dbConfig.dbPort) dbPort = ':' + dbConfig.dbPort;
    const dbPath = dbConfig.dbPath || '';
    return (dbProtocol + dbHost + dbPort + dbPath);
}

/**
 * Gets http auth header for the REST datastore from the configuration
 * @private
 * @param {Object} dbConfig datastore configuration parameters
 * @returns {string} http auth header
 */
function getDatabaseAuthHeader(dbConfig) {
    // Creates basic http auth header
    if (dbConfig.username && dbConfig.password) {
        return ('Basic ' + Buffer.from(dbConfig.username + ':' + dbConfig.password).toString('base64'));
    }
    return '';
}

/**
 * Creates request options
 * @private
 * @param {string} context
 * @param {Object} parameters
 * @returns {Object} request options
 */
function createRequestOptions(context, parameters) {
    let requestURL = '';
    if (context) {
        requestURL = createContextURL(context, parameters);
    } else {
        requestURL = _restURL;
    }
    return {
        url : requestURL,
        headers : {
            'Authorization' : _restAuthHeader,
            'Content-type': 'application/json'
        }
    };
}

/**
 * Creates context URL
 * @private
 * @param {string} context
 * @param {Object} parameters
 * @returns {string} url with context
 */
function createContextURL(context, parameters) {
    let requestURL = _restURL + '?' + context;
    if (parameters && parameters['MetaHeader.transactionHash']) {
        requestURL += '&tx=' + parameters['MetaHeader.transactionHash'];
    } else {
        if (parameters && parameters.id) {
            requestURL += '&id=' + parameters.id;
        }
    }
    return requestURL;
}

/**
 * Creates context URL
 * @private
 * @param {Object} body request body
 * @param {function(Error, Object)} callback function to be called upon completion
 */
function processResponseBody(body, callback) {
    // Return null if empty response body
    if (body === '{}') return callback(null, null);

    // Parse response body
    let parsedBody = {};
    try {
        parsedBody = JSON.parse(body);
    } catch(err) {
        return callback(new Error(`Cannot parse data: ${err.message}: ${body}`));
    }
    return callback(null, parsedBody);
}
