'use strict';
/**
 * @module lib/protocol/state
 * @summary Whiteflag state module
 * @description Module for Whiteflag protocol state management
 * @tutorial modules
 * @tutorial protocol
 * @tutorial state
 * @todo review blockchain account backup method
 */
module.exports = {
    // State functions
    init: initState,
    close: closeState,
    save: saveState,
    // Blockchain state functions
    backupAccount,
    getBlockchains,
    getBlockchainData,
    updateBlockchainData,
    // Originator state functions
    getOriginators,
    getOriginatorData,
    upsertOriginatorData,
    removeOriginatorData,
    getOriginatorAuthToken,
    removeOriginatorAuthToken,
    // Queue function
    getQueue,
    getQueueData,
    upsertQueueData,
    removeQueueData,
    // Cryptographic keys
    getKeyIds,
    getKey,
    upsertKey,
    removeKey,
    // State functions for testing
    test: {
        validate: validateState,
        enclose: encloseState,
        extract: extractState
    }
};

// Type definitions //
/**
 * @typedef {blockchainData[]} blockchainsData State data of all blockchains
 */
/**
 * @typedef {Object} blockchainData Blockchain parameters, status and account data
 * @property {Object} parameters Blockchain specific parameters, such as name and node information
 * @property {Object} status Blockchain status, such as current block height, block times, etc.
 * @property {wfAccount[]} accounts Accounts available on this blockchain
 */
/**
 * @typedef {originatorData[]} originatorsData State data of all originators
 */
/**
 * @typedef {Object} originatorData State data of a specific originator
 * @property {string} name The name of the originator
 * @property {string} blockchain The name of the blockchain used by the originator
 * @property {string} address The blockchain address that identifies the originator
 * @property {string} originatorPubKey The public key associated with the blockchain account of the originator
 * @property {string} ecdhPublicKey The state crypto identifier of the ECDH public key of this originator
 * @property {string} url The url of the authentication signature of the originator
 * @property {string} authTokenId The state crypto identifier of the authentication token for this originator
 * @property {boolean} authenticationValid Indication whether the originator has been authenticated at some point in time
 * @property {string[]} authenticationMessages Transaction hashes of valid original authentication messages
 */
/**
 * @typedef {Array} queueData State data from a specific queue
 */

// Module objects //
/**
 * The Whiteflag state object
 * @typedef {Object} wfState
 * @property {blockchainsData} blockchains
 * @property {originatorsData} originators
 * @property {Object} queue
 * @property {Object} crypto
 */
let _wfState = {
    blockchains: {},
    originators: [],
    queue: {
        initVectors: [],
        blockDepths: []
    },
    crypto: {
        blockchainKeys: [],
        ecdhPrivateKeys: [],
        presharedKeys: [],
        negotiatedKeys: [],
        authTokens: []
    }
};

// Node.js core and external modules //
const fs = require('fs');
const crypto = require('crypto');
const jsonValidate = require('jsonschema').validate;

// Whiteflag common functions and classes //
const array = require('../_common/arrays');
const log = require('../_common/logger');
const object = require('../_common/objects');
const { hkdf, hash, zeroise } = require('../_common/crypto');
const { ProcessingError } = require('../_common/errors');
const { hexToBuffer, bufferToHex } = require('../_common/encoding');

// Whiteflag modules //
const wfApiDatastores = require('../datastores');

// Whiteflag event emitters //
const wfStateEvent = require('./events').stateEvent;

// Whiteflag configuration data //
const wfConfigData = require('./config').getConfig();

// Module constants //
const MODULELOG = 'state';
const MEKLENGTH = 32;
const DEKLENGTH = 32;
const KEKLENGTH = 16;
const DEKSALT = '5dbfb2cc6c0f8fa314fd12b662da1bb2f7bef77f8df7ae0c0fb9d15750cfe423';
const KEKSALT = '22d79745768d144783ba6ce8e7b3047b47651e4729168e8d8741b7d094d46d92';
const DATACIPHER = 'aes-256-gcm';
const DATAIVLENGTH = 12;
const KEYCIPHER = 'aes-128-gcm';
const KEYIVLENGTH = 12;
const KEYIDLENGTH = 12;
const BINENCODING = 'hex';
const STATEENCODING = 'base64';
const wfStateSchema = JSON.parse(fs.readFileSync('./static/protocol/state.schema.json'));

// Module variables //
let _masterEncryptionKey = 'a15e6437e23fdaaed9b454d7d51bd69e6a9ffcdbcf0a7528538a2f3bfe2d54e4';
let _encryption = true;
let _saveToFile = false;
let _stateFile = '/tmp/whiteflag.state';

// MAIN MODULE FUNCTIONS //
/**
 * Restores previous state from file and binds event handlers to state changes
 * @function initState
 * @alias module:lib/protocol/state.init
 * @param {function(Error)} callback function called after initialising/restoring state
 * @emits module:lib/protocol/events.stateEvent:initialised
 */
function initState(callback) {
    // Check state configuration parameters
    if (!wfConfigData.state) {
        return callback(new Error('State parameters missing in Whiteflag configuration file'));
    }
    if (wfConfigData.state.masterKey.length !== (MEKLENGTH * 2)) {
        return callback(new Error(`Master key in Whiteflag configuration file is not ${(MEKLENGTH * 8)} bits`));
    }
    // Preserve state configuration
    _masterEncryptionKey = wfConfigData.state.masterKey;
    if (wfConfigData.state.encryption === false) _encryption = false;
    delete wfConfigData.state.masterKey;

    // Retrieve state
    log.trace(MODULELOG, 'Retrieving previous state from datastore');
    wfApiDatastores.getState(function stateReadDatastoreCb(err, stateDbData) {
        if (err) return callback(new Error(`Could not retrieve state from datastore: ${err.message}`));
        if (!stateDbData) {
            log.info(MODULELOG, 'Found no existing state: Starting with clean internal state');
            wfStateEvent.emit('initialised');
            return callback(null);
        }
        // Extract and decrypt state
        try {
            _wfState = extractState(stateDbData);
        } catch(err) {
            log.error(MODULELOG, `Could not extract state from datastore: ${err.message}`);
            return callback(new Error('Previous state cannot be restored'));
        }
        log.info(MODULELOG, 'Restored previous state from datastore');

        // Done restoring state
        saveState();
        wfStateEvent.emit('initialised');
        return callback(null);
    });
}

/**
 * Ensures a proper shutdown
 * @function closeState
 * @alias module:lib/protocol/state.closeState
 * @param {function(Error)} [callback] function called after initialising/restoring state
 * @emits module:lib/protocol/events.stateEvent:closed
 */
function closeState(callback) {
    // Closing is triggered when state is saved
    wfStateEvent.once('saved', function stateCloseCb() {
        if (_saveToFile) log.info(MODULELOG, 'Saved state to file before closing');
            else log.info(MODULELOG, 'Saved state to datastore before closing');
        _masterEncryptionKey = undefined;
        wfStateEvent.emit('closed');
        if (callback) return callback(null);
    });
    // Save state to trigger closing
    saveState();
}

/**
 * Saves current state to file
 * @function saveState
 * @alias module:lib/protocol/state.save
 * @emits module:lib/protocol/events.stateEvent:saved
 */
function saveState() {
    // Enclose and encrypt state object
    let stateObject = {};
    try {
        stateObject = encloseState(_wfState);
    } catch(err) {
        return log.error(MODULELOG, `Could not save current state: ${err.message}`);
    }
    // Save state in datastore
    log.trace(MODULELOG, 'Saving current state to datastore');
    wfApiDatastores.storeState(stateObject, function stateStoreDatastoreCb(err) {
        if (err) return log.error(MODULELOG, `Could not store state in datastore: ${err.message}`);
        return wfStateEvent.emit('saved');
    });
    // Save state to file if set in config
    if (_saveToFile) {
        log.trace(MODULELOG, `Saving current state to ${_stateFile}`);
        fs.writeFile(_stateFile, JSON.stringify(stateObject, null, 2), function stateWriteFileCb(err) {
            if (err) return log.error(MODULELOG, `Could not save current state to ${_stateFile}: ${err.message}`);
            return wfStateEvent.emit('saved');
        });
    }
}

/**
 * Returns blockchain state data to callback
 * @function getBlockchains
 * @alias module:lib/protocol/state.getBlockchains
 * @param {function(Error, blockchainsData)} [callback] function to which data is passed
 * @returns {blockchainsData}
 */
function getBlockchains(callback) {
    if (callback) return callback(null, _wfState.blockchains);
    return _wfState.blockchains;
}

/**
 * Gets state of a specific blockchain
 * @function getBlockchainData
 * @alias module:lib/protocol/state.getBlockchainData
 * @param {string} blockchain name of the blockchain
 * @param {function(Error, blockchainData)} callback function to which data is passed
 */
function getBlockchainData(blockchain, callback) {
    if (!Object.hasOwn(_wfState.blockchains, blockchain)) {
        return callback(null, null);
    }
    return callback(null, _wfState.blockchains[blockchain]);
}

/**
 * Updates state of a specific blockchain
 * @function updateBlockchains
 * @alias module:lib/protocol/state.updateBlockchains
 * @param {string} blockchain name of the blockchain
 * @param {Object} data parameters of the specific blockchain
 * @emits module:lib/protocol/events.stateEvent:updatedBlockchain
 */
function updateBlockchainData(blockchain, data) {
    if (!Object.hasOwn(_wfState.blockchains, blockchain)) {
        log.warn(MODULELOG, `Adding previously unknown blockchain to state: ${blockchain}`);
    }
    _wfState.blockchains[blockchain] = data;
    wfStateEvent.emit('updatedBlockchain', blockchain);
    return saveState();
}

/**
 * Saves a specific blockchain account to file
 * @function backupAccount
 * @alias module:lib/protocol/state.backupAccount
 * @param {string} blockchain the blockchain of the account to be saved
 * @param {string} address the address of the account to be saved
 */
function backupAccount(blockchain, address) {
    if (!Object.hasOwn(_wfState.blockchains, blockchain)) {
        return log.error(MODULELOG, `Cannot backup account because blockchain does not exist in state: ${blockchain}`);
    }
    const account = _wfState.blockchains[blockchain].accounts.find(account => account.address === address);
    if (account) {
        const accountFile = _stateFile + '.' + account.address.substring(0, 8);
        fs.writeFile(accountFile, JSON.stringify(account, null, 2), function stateWriteAccountFileCb(err) {
            if (err) return log.error(MODULELOG, `Could not save blockchain account to ${accountFile}: ${err.message}`);
            return log.debug(MODULELOG, `Blockchain account saved to ${accountFile}`);
        });
    }
}

/**
 * Returns originator state data to callback
 * @function getOriginators
 * @alias module:lib/protocol/state.getOriginators
 * @param {function(Error, originatorsData)} callback function to which data is passed
 */
function getOriginators(callback) {
    if (callback) return callback(null, _wfState.originators);
    return _wfState.originators;
}

/**
 * Gets state of a specific originator
 * @function getOriginatorData
 * @alias module:lib/protocol/state.getOriginatorData
 * @param {string} address the originator's blockchain address
 * @param {function(Error, originatorData)} callback function to which data is passed
 */
function getOriginatorData(address, callback) {
    const index = _wfState.originators.findIndex(
        originator => originator.address.toLowerCase() === address.toLowerCase()
    );
    if (index < 0) return callback(null, null);
    return callback(null, _wfState.originators[index]);
}

/**
 * Inserts or updates an originator
 * @function upsertOriginatorData
 * @alias module:lib/protocol/state.upsertOriginatorData
 * @param {Object} data originator data
 * @emits module:lib/protocol/events.stateEvent:insertedOriginator
 * @emits module:lib/protocol/events.stateEvent:updatedOriginator
 * @emits module:lib/protocol/events.stateEvent:insertedAuthenticationToken
 * @emits module:lib/protocol/events.stateEvent:updatedAuthenticationToken
 */
function upsertOriginatorData(data) {
    // Check if originator with the same address or authentication token already exists
    let indexA = null;
    if (Object.hasOwn(data, 'address')) {
        indexA = _wfState.originators.findIndex(
            originator => originator.address.toLowerCase() === data.address.toLowerCase()
        );
    } else {
        data.address = '';
    }
    let indexT = null;
    if (Object.hasOwn(data, 'authTokenId')) {
        indexT = _wfState.originators.findIndex(
            originator => originator.authTokenId === data.authTokenId
        );
    } else {
        data.authTokenId = '';
    }
    // Error if no address and no authentication token
    if (indexA === null && indexT === null) {
        return log.error(MODULELOG, 'Attempt to add originator to state without address or authentication token');
    }
    // Check if not existing originator with address
    if (indexA === null || indexA < 0) {
        // No address; check if not also existing originator with token
        if (indexT === null || indexT < 0) {
            // Insert if no originator with token or address
            _wfState.originators.push(data);
            if (indexT === null) wfStateEvent.emit('insertedOriginator', data.address);
            if (indexA === null) wfStateEvent.emit('insertedOriginatorAuthToken', data.authTokenId);
            return saveState();
        } else {
            // Update if existing originator with token but (different) address
            if (!_wfState.originators[indexT].address) {
                // No address, so update originator with same token
                object.update(data, _wfState.originators[indexT]);
                wfStateEvent.emit('updatedOriginatorAuthToken', data.authTokenId);
                return saveState();
            } else {
                // Create new originator with same token but different address
                _wfState.originators.push(data);
                wfStateEvent.emit('insertedOriginator', data.address);
                return saveState();
            }
        }
    } else {
        // Originator with address
        if (indexT === null || indexT < 0) {
            // Check if existing originator has different token
            if (_wfState.originators[indexA].authTokenId && data.authTokenId &&
                _wfState.originators[indexA].authTokenId !== data.authTokenId) {
                // Token does not match; create new entry to preserve token
                _wfState.originators.push({
                    name: _wfState.originators[indexA].name,
                    blockchain: _wfState.originators[indexA].blockchain,
                    authTokenId: _wfState.originators[indexA].authTokenId
                });
            }
            // Update if existing originator with address but no token or same token
            object.update(data, _wfState.originators[indexA]);
            wfStateEvent.emit('updatedOriginator', data.address);
            return saveState();
        }
    }
    // Remove same originator with no address
    if (!_wfState.originators[indexT].address) {
        _wfState.originators.splice(indexT, 1);
    }
    // Update existing originator
    object.update(data, _wfState.originators[indexA]);
    wfStateEvent.emit('updatedOriginator', data.address);
    return saveState();
}

/**
 * Removes state of a specific originator
 * @function removeOriginatorData
 * @alias module:lib/protocol/state.removeOriginatorData
 * @param {string} address the originator's blockchain address
 * @emits module:lib/protocol/events.stateEvent:removedOriginator
 */
function removeOriginatorData(address) {
    const index = _wfState.originators.findIndex(
        originator => originator.address.toLowerCase() === address.toLowerCase()
    );
    if (index >= 0) {
        _wfState.originators.splice(index, 1);
        wfStateEvent.emit('removedOriginator', address);
        return saveState();
    }
}

/**
 * Returns originator authentication token
 * @function getOriginatorAuthToken
 * @alias module:lib/protocol/state.getOriginatorAuthToken
 * @param {string} authTokenId the originator's authentication token
 * @param {function(Error, originatorData)} callback function to which data is passed
 */
function getOriginatorAuthToken(authTokenId, callback) {
    const index = _wfState.originators.findIndex(
        originator => originator.authTokenId === authTokenId
    );
    if (index < 0) return callback(null, null);
    return callback(null, _wfState.originators[index]);
}

/**
 * Removes originator authentication data
 * @function removeOriginatorAuthToken
 * @alias module:lib/protocol/state.removeOriginatorAuthToken
 * @param {string} address the originator's blockchain address
 * @emits module:lib/protocol/events.stateEvent:removedAuthenticationToken
 * @emits module:lib/protocol/events.stateEvent:removedOriginatorAuthToken
 */
function removeOriginatorAuthToken(authTokenId) {
    const index = _wfState.originators.findIndex(
        originator => originator.authTokenId === authTokenId
    );
    if (index >= 0) {
        if (!_wfState.originators[index].address) {
            _wfState.originators.splice(index, 1);
            wfStateEvent.emit('removedOriginator', authTokenId);
        } else {
            _wfState.originators[index].authTokenId = null;
            wfStateEvent.emit('removedAuthenticationToken', _wfState.originators[index].address);
        }
    }
    removeKey('authTokens', authTokenId);
    return saveState();
}

/**
 * Returns specific queue to callback
 * @function getQueue
 * @alias module:lib/protocol/state.getQueue
 * @param {string} queue the name of the queue
 * @param {function(Error, queueData)} callback function to which data is passed
 */
function getQueue(queue, callback) {
    if (!Object.hasOwn(_wfState.queue, queue)) {
        return callback(new ProcessingError(`Queue ${queue} does not exist`, null, 'WF_API_NO_RESOURCE'));
    }
    return callback(null, _wfState.queue[queue]);
}

/**
 * Gets specific item from specific queue
 * @function getQueueData
 * @alias module:lib/protocol/state.getQueueData
 * @param {string} queue the name of the queue
 * @param {string} property the data object property name by which the item is identified
 * @param {Object} value the value of the property by which the item is identified
 * @param {function(Error, Object)} callback function to which data is passed
 */
function getQueueData(queue, property, value, callback) {
    if (!Object.hasOwn(_wfState.queue, queue)) {
        return callback(new Error(`Queue ${queue} does not exist`));
    }
    const index = _wfState.queue[queue].findIndex(
        item => item[property].toLowerCase() === value.toLowerCase()
    );
    if (index < 0) return callback(null, null);
    return callback(null, _wfState.queue[queue][index]);
}

/**
 * Inserts or updates specific item in specific queue
 * @function upsertQueueData
 * @alias module:lib/protocol/state.upsertQueueData
 * @param {string} queue the name of the queue
 * @param {string} property the data object property name by which the item is identified
 * @param {Object} data the data to be updated or put on queue
 * @emits module:lib/protocol/events.stateEvent:insertedInQueue
 * @emits module:lib/protocol/events.stateEvent:updatedQueue
 */
function upsertQueueData(queue, property, data) {
    const index = _wfState.queue[queue].findIndex(
        item => item[property].toLowerCase() === data[property].toLowerCase()
    );
    if (index < 0) {
        _wfState.queue[queue].push(data);
        wfStateEvent.emit('insertedInQueue', queue, data);
    } else {
        _wfState.queue[queue][index] = data;
        wfStateEvent.emit('updatedQueue', queue, data);
    }
    return saveState();
}

/**
 * Removes specific item in specific queue
 * @function removeQueueData
 * @alias module:lib/protocol/state.removeQueueData
 * @param {string} queue the name of the queue
 * @param {string} property the data object property name by which the item is identified
 * @param {Object} value the value of the property by which the item to be removed is identified
 * @emits module:lib/protocol/events.stateEvent:removedFromQueue
 */
function removeQueueData(queue, property, value) {
    const index = _wfState.queue[queue].findIndex(
        item => item[property].toLowerCase() === value.toLowerCase()
    );
    if (index >= 0) {
        const data = _wfState.queue[queue][index];
        _wfState.queue[queue].splice(index, 1);
        wfStateEvent.emit('removedFromQueue', queue, data);
        return saveState();
    }
}

/**
 * Returns all key ids of a cryptographic key category
 * @function getKeyIds
 * @alias module:lib/protocol/state.getKeyIds
 * @param {string} category the key category
 * @param {function(Error, Array)} callback function to which the key is passed
 */
function getKeyIds(category, callback) {
    if (!Object.hasOwn(_wfState.crypto, category)) {
        return callback(new Error(`Key category ${category} does not exist`));
    }
    return callback(null, array.pluck(_wfState.crypto[category], 'id'));
}

/**
 * Gets a cryptographic key
 * @function getKey
 * @alias module:lib/protocol/state.getKey
 * @param {string} category the key category
 * @param {string} id unique identifier of the key
 * @param {function(Error, key)} callback function to which the key is passed
 */
function getKey(category, id, callback) {
    if (!Object.hasOwn(_wfState.crypto, category)) {
        return callback(new Error(`Key category ${category} does not exist`));
    }
    const index = _wfState.crypto[category].findIndex(
        item => item.id.toLowerCase() === id.toLowerCase()
    );
    if (index < 0) return callback(null, null);

    let key = decryptKey(_wfState.crypto[category][index].secret, id);
    return callback(null, key);
}

/**
 * Inserts or updates a cryptographic key
 * @function upsertKey
 * @alias module:lib/protocol/state.upsertKey
 * @param {string} category the key category
 * @param {string} id unique identifier of the key
 * @param {string} key the key to be stored or updated in raw hexadecimal format
 * @emits module:lib/protocol/events.stateEvent:insertedKey
 * @emits module:lib/protocol/events.stateEvent:updatedKey
 */
function upsertKey(category, id, key) {
    const index = _wfState.crypto[category].findIndex(
        item => item.id.toLowerCase() === id.toLowerCase()
    );
    const data = encryptKey(key, id);

    // Hopefully the garbage collector will do its work
    key = undefined;

    // Upsert the encrypted key
    if (index < 0) {
        _wfState.crypto[category].push({
            id: id,
            secret: data
        });
        wfStateEvent.emit('insertedKey', category, id);
    } else {
        _wfState.crypto[category][index] = {
            id: id,
            secret: data
        };
        wfStateEvent.emit('updatedKey', category, id);
    }
    return saveState();
}

/**
 * Removes a cryptographic key
 * @function removeKey
 * @alias module:lib/protocol/state.removeKey
 * @param {string} category the key category
 * @param {string} id unique identifier of the key
 * @emits module:lib/protocol/events.stateEvent:removedKey
 */
function removeKey(category, id) {
    const index = _wfState.crypto[category].findIndex(
        item => item.id.toLowerCase() === id.toLowerCase()
    );
    if (index >= 0) {
        _wfState.crypto[category].splice(index, 1);
        wfStateEvent.emit('removedKey', category, id);
        return saveState();
    }
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Validates the state structure configuration against the state schema
 * @private
 * @param {Object} [stateData] the complete state
 * @returns {Array} validation errors, empty if no errors
 */
function validateState(stateData = _wfState) {
    let stateErrors = [];
    try {
        stateErrors = array.pluck(jsonValidate(stateData, wfStateSchema).errors, 'stack');
    } catch(err) {
        stateErrors.push(err.message);
    }
    return stateErrors;
}

/**
 * Encloses (and encrypts) state
 * @private
 * @param {Object} [stateData] the complete state
 * @returns {Object} state data enclosed in a storage / encryption container
 */
function encloseState(stateData = _wfState) {
    let stateObject = {};
    if (_encryption) {
        stateObject = encryptState(JSON.stringify(stateData));
    } else {
        stateObject = { state: JSON.stringify(stateData) };
    }
    return stateObject;
}

/**
 * Extracts (and decrypts) state from file or datastore contents
 * @private
 * @param {Object} stateObject state data enclosed in a storage / encryption container
 * @returns {Object} the complete state
 */
function extractState(stateObject) {
    let stateDataStr;
    if (!Object.hasOwn(stateObject, 'state')) {
        throw new Error('State object might be corrupted: state property is missing');
    }
    if (
        Object.hasOwn(stateObject, 'tag')
        && Object.hasOwn(stateObject, 'iv')
    ) {
        stateDataStr = decryptState(stateObject);
    } else {
        stateDataStr = stateObject.state;
    }
    return checkState(JSON.parse(stateDataStr));
}

/**
 * Checks state and performs updates from old versions
 * @param {Object} stateData
 * @returns {Object} updated state
 */
function checkState(stateData) {
    // Check for complete object structure and add new properties as required
    stateData =
        checkStateDataOriginators(
            checkStateDataBlockchains(
                checkStateDataStructure(stateData)
            )
        );
    // Finally, validate against schema
    let stateErrors = validateState();
    if (stateErrors.length > 0) throw new Error('State does not validate against schema: ' + JSON.stringify(stateErrors));
    return stateData;
}

/**
 * Encrypts state
 * @private
 * @param {string} stateDataStr stringified state data
 * @returns {Object} encrypted state with authentication tag and initialisation vector
 */
function encryptState(stateDataStr) {
    // Initialise encrypter object
    const ivBuffer = crypto.randomBytes(DATAIVLENGTH);
    const dekBuffer = generateDEK();
    if (!dekBuffer) {
        throw new Error('Could not generate DEK to encrypt state: Invalid master key?');
    }
    const encrypter = crypto.createCipheriv(DATACIPHER, dekBuffer, ivBuffer);

    // Perform encrytption
    const encryptedState = encrypter.update(stateDataStr, '', STATEENCODING) + encrypter.final(STATEENCODING);
    const tag = encrypter.getAuthTag().toString(BINENCODING);
    zeroise(dekBuffer);

    // Return encryption result
    return {
        tag: tag,
        iv: ivBuffer.toString(BINENCODING),
        state: encryptedState
    };
}

/**
 * Decrypts state
 * @private
 * @param {Object} stateObject encrypted state with authentication tag and initialisation vector
 * @returns {string} stringified state data
 */
function decryptState(stateObject) {
    // Check data
    if (!stateObject.iv || !stateObject.tag) {
        throw new Error('Cannot decrypt: Missing tag and/or initialisation vector');
    }
    // Get information from data object
    const ivBuffer = Buffer.from(stateObject.iv, BINENCODING);
    const tagBuffer = Buffer.from(stateObject.tag, BINENCODING);
    const stateBuffer = Buffer.from(stateObject.state, STATEENCODING);

    // Initialise decrypter object
    const dekBuffer = generateDEK();
    if (!dekBuffer) {
        throw new Error('Could not generate DEK to decrypt state: Invalid master key?');
    }
    const decrypter = crypto.createDecipheriv(DATACIPHER, dekBuffer, ivBuffer);

    // Perform decryption and return result
    decrypter.setAuthTag(tagBuffer);
    const stateDataStr = Buffer.concat([decrypter.update(stateBuffer), decrypter.final()]);
    zeroise(dekBuffer);

    // Return decryption result
    return stateDataStr;
}

/**
 * Encrypts key data
 * @private
 * @param {string} key key in hexadecimal string
 * @param {string} id unique identifier for the key, usually a related blockchain address
 * @returns {Object} encrypted key with authentication tag and initialisation vector
 */
function encryptKey(key, id) {
    // Initialise encrypter object
    const ivBuffer = crypto.randomBytes(KEYIVLENGTH);
    const kekBuffer = generateKEK(id);
    if (!kekBuffer) {
        throw new Error('Could not generate KEK to encrypt key: Invalid master key?');
    }
    const encrypter = crypto.createCipheriv(KEYCIPHER, kekBuffer, ivBuffer);

    // Perform encrytption
    const encryptedKey = encrypter.update(key, '', BINENCODING) + encrypter.final(BINENCODING);
    const tag = encrypter.getAuthTag().toString(BINENCODING);

    // Hopefully the garbage collector will do its work
    key = undefined;
    zeroise(kekBuffer);

    // Return encryption result
    return {
        tag: tag,
        iv: ivBuffer.toString(BINENCODING),
        key: encryptedKey
    };
}

/**
 * Decrypts key data
 * @private
 * @param {Object} stateObject encrypted key with authentication tag and initialisation vector
 * @param {string} id unique identifier for the key, usually a related blockchain address
 * @returns {string} key in hexadecimal string
 */
function decryptKey(keyObject, id) {
    // Check data
    if (!keyObject.iv || !keyObject.tag) {
        throw new Error('Cannot decrypt: Missing tag and/or initialisation vector');
    }
    // Get information from data object
    const ivBuffer = Buffer.from(keyObject.iv, BINENCODING);
    const tagBuffer = Buffer.from(keyObject.tag, BINENCODING);
    const keyBuffer = Buffer.from(keyObject.key, BINENCODING);

    // Initialise decrypter object
    const kekBuffer = generateKEK(id);
    if (!kekBuffer) {
        throw new Error('Could not generate KEK to decrypt key: Invalid master key?');
    }
    const decrypter = crypto.createDecipheriv(KEYCIPHER, kekBuffer, ivBuffer);

    // Perform decryption and return result
    decrypter.setAuthTag(tagBuffer);
    const key = Buffer.concat([decrypter.update(keyBuffer), decrypter.final()]).toString();
    zeroise(kekBuffer);

    // Return decryption result
    return key;
}

/**
 * Generates data encryption key from master key using HKDF
 * @private
 * @returns {buffer} the encryption key
 */
function generateDEK() {
    const ikm = Buffer.from(_masterEncryptionKey, BINENCODING);
    if (ikm.length === 0) return null;

    const salt = Buffer.from(DEKSALT, BINENCODING);
    const info = Buffer.from('DEK-00');
    return hkdf(ikm, salt, info, DEKLENGTH);
}

/**
 * Generates key encryption key from master key using HKDF
 * @private
 * @returns {buffer} the encryption key
 */
function generateKEK(id) {
    const ikm = Buffer.from(_masterEncryptionKey, BINENCODING);
    if (ikm.length === 0) return null;

    const salt = Buffer.from(KEKSALT, BINENCODING);
    const info = Buffer.from('KEK-' + id);
    return hkdf(ikm, salt, info, KEKLENGTH);
}


// STATE STRUCTURE CORRECTIONS //
/**
 * Check for complete object structure and add new properties as required
 * @private
 * @param {Object} stateData the state data object
 * @returns {Object} the checked and corrected state data object
 */
function checkStateDataStructure(stateData) {
    if (!Object.hasOwn(stateData, 'blockchains')) stateData.blockchains = {};
    if (!Object.hasOwn(stateData, 'originators')) stateData.originators = [];
    if (!Object.hasOwn(stateData, 'queue')) stateData.queue = {};
    if (!Object.hasOwn(stateData.queue, 'initVectors')) stateData.queue.initVectors = [];
    if (!Object.hasOwn(stateData.queue, 'blockDepths')) stateData.queue.blockDepths = [];
    if (!Object.hasOwn(stateData, 'crypto')) stateData.crypto = {};
    if (!Object.hasOwn(stateData.crypto, 'blockchainKeys')) stateData.crypto.blockchainKeys = [];
    if (!Object.hasOwn(stateData.crypto, 'ecdhPrivateKeys')) stateData.crypto.ecdhPrivateKeys = [];
    if (!Object.hasOwn(stateData.crypto, 'negotiatedKeys')) stateData.crypto.negotiatedKeys = [];
    if (!Object.hasOwn(stateData.crypto, 'presharedKeys')) stateData.crypto.presharedKeys = [];
    if (!Object.hasOwn(stateData.crypto, 'authTokens')) stateData.crypto.authTokens = [];
    return stateData;
}

/**
 * Checks and corrects blockchain state data
 * @private
 * @param {Object} stateData the state data object
 * @returns {Object} the checked and corrected state data object
 */
function checkStateDataBlockchains(stateData) {
    // Check blockchains
    for (const blockchain in stateData.blockchains) {
        // Check blockchain accounts
        if (Object.hasOwn(stateData.blockchains[blockchain], 'accounts')) {
            let accounts = stateData.blockchains[blockchain].accounts;
            for (const index in accounts) {
                // Remove invalid account entry with a non-string address
                if (Object.hasOwn(accounts[index], 'address')) {
                    if (typeof accounts[index].address !== 'string') {
                        accounts.splice(index, 1);
                        continue;
                    }
                }
                // Move naked private keys in acoount to keystore
                stateData = upgradeStateDataKeyStorage(stateData, blockchain, accounts[index]);
            }
        }
    }
    return stateData;
}

/**
 * Upgrades state by putting naked private keys in keystore
 * @private
 * @param {Object} stateData the state data object
 * @param {string} blockchain the blockchain name
 * @param {Object} account the account data
 * @returns {Object} the checked and corrected state data object
 */
function upgradeStateDataKeyStorage(stateData, blockchain, account) {
    if (Object.hasOwn(account, 'privateKey')) {
        const id = hash(blockchain + account.address, KEYIDLENGTH);
        const index = stateData.crypto.blockchainKeys.findIndex(
            item => item.id.toLowerCase() === id.toLowerCase()
        );
        const data = encryptKey(account.privateKey, id);
        if (index < 0) {
            stateData.crypto.blockchainKeys.push({
                id: id,
                secret: data
            });
        } else {
            stateData.crypto.blockchainKeys[index] = {
                id: id,
                secret: data
            };
        }
        account.privateKey = undefined;
    }
    return stateData;
}

/**
 * Checks and corrects originator state data
 * @private
 * @param {Object} stateData the state data object
 * @returns {Object} the checked and corrected state data object
 */
function checkStateDataOriginators(stateData) {
    // Checks for unique values in originator authentication messages
    stateData.originators.forEach(originator => {
        if (Array.isArray(originator.authenticationMessages)) {
            originator.authenticationMessages = [...new Set(originator.authenticationMessages)];
        }
    });
    return stateData;
}
