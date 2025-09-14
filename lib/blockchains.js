'use strict';
/**
 * @module lib/blockchains
 * @summary Whiteflag API blockchains module
 * @description Module with the blockchain abstraction layer to connect with multiple blockchains
 * @tutorial installation
 * @tutorial configuration
 * @tutorial modules
 */
module.exports = {
    // Blockchain functions
    init: initBlockchains,
    sendMessage,
    getMessage,
    requestSignature,
    requestKeys,
    getBinaryAddress,
    transferFunds,
    createAccount,
    updateAccount,
    deleteAccount
};

// Type defintitions //
/**
 * @typedef {Object} wfAccount A Whiteflag account object
 * @property {string} address the address as encoded for that specific blokchain
 * @property {string} publicKey the hexedecimal encoded public key
 * @property {string} privateKey the hexedecimal encoded private key
 * @property {number} transactionCount the number of transaction sent by the account
 * @property {number} balance the current balance of the account
 */

// Node.js core and external modules //
const fs = require('fs');
const toml = require('toml');
const jsonValidate = require('jsonschema').validate;

// Whiteflag common functions and classes //
const log = require('./common/logger');
const array = require('./common/arrays');
const { type } = require('./common/protocol');
const { ProcessingError, ProtocolError } = require('./common/errors');
const { hexToBuffer } = require('./common/encoding');

// Whiteflag modules //
const wfState = require('./protocol/state');
const wfApiDatastores = require('./datastores');

// Whiteflag event emitters //
const wfRxEvent = require('./protocol/events').rxEvent;
const wfTxEvent = require('./protocol/events').txEvent;

// Module constants //
const MODULELOG = 'blockchains';
const WFCONFDIR = process.env.WFCONFDIR || './config';
const BCCONFFILE = WFCONFDIR + '/blockchains.toml';
const BCMODULEDIR = './blockchains/';
const bcConfigSchema = JSON.parse(fs.readFileSync('./lib/blockchains/static/blockchains.config.schema.json'));

// Module variables //
let _blockchains = [];
let _bcConfig = [];
let _confirmMessages = false;
let _confirmInterval = 10000;
let _confirmBlockDepth = 8;
let _confirmEachBlock = false;

// MAIN MODULE FUNCTIONS //

/**
 * @callback 
 * @
 */

/**
 * Initialises configured blockchains
 * @function initBlockchains
 * @alias module:lib/blockchains.init
 * @param {function(Error, blockchains)} callback function to be called upon completion
 * @typedef {Array} blockchains names of the configured blockchains
 */
function initBlockchains(callback) {
    // Read the configuration file
    let bcConfigData = {};
    try {
        bcConfigData = toml.parse(fs.readFileSync(BCCONFFILE));
    } catch(err) {
        return callback(err);
    }
    // Parse the configuration
    if (!parseConfig(bcConfigData)) {
        return callback(new Error(`Could not parse configuration in ${BCCONFFILE}`));
    }
    _bcConfig = bcConfigData.blockchains;
    _blockchains = array.pluck(_bcConfig, 'name');
    log.debug(MODULELOG, `Configured blockchains in ${BCCONFFILE}: ` + JSON.stringify(_blockchains));

    // Initialise each enabled blockchain
    _bcConfig.forEach(bcInstance => {
        if (bcInstance._enabled) {
            bcInstance._moduleImpl.init(bcInstance, function blockchainInitCb(err, blockchain) {
                if (err) return log.error(MODULELOG, `Could not intialise ${blockchain}: ${err.message}`);
                return log.info(MODULELOG, `Initialised blockchain: ${blockchain}`);
            });
        }
    });
    initConfirmMessages(bcConfigData.confirmation);
    return callback(null, _blockchains);
}

/**
 * Sends an encoded message to the blockchain defined in the metaheader
 * @function sendMessage
 * @alias module:lib/blockchains.sendMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be sent on the blockchain
 * @param {function(Error, wfMessage)} callback function to be called upon completion
 */
function sendMessage(wfMessage, callback) {
    // Check message parameters
    if (!Object.hasOwn(wfMessage, 'MetaHeader')) {
        return callback(new ProtocolError('Missing metaheader', null, 'WF_METAHEADER_ERROR'), wfMessage);
    }
    if (!wfMessage.MetaHeader.blockchain) {
        wfMessage.MetaHeader.transmissionSuccess = false;
        return callback(new ProtocolError('Blockchain not specified in message metaheader', null, 'WF_METAHEADER_ERROR'), wfMessage);
    }
    // Check blockchain
    if (!_blockchains.includes(wfMessage.MetaHeader.blockchain)) {
        wfMessage.MetaHeader.transmissionSuccess = false;
        return callback(new ProcessingError(`Unsupported blockchain: ${wfMessage.MetaHeader.blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'), wfMessage);
    }
    // Check other required data
    if (!wfMessage.MetaHeader.originatorAddress) {
        return callback(new ProtocolError('No address for blockchain account specified in metaheader', null, 'WF_METAHEADER_ERROR'));
    }
    if (!wfMessage.MetaHeader.encodedMessage) {
        return callback(new ProtocolError('No encoded message in metaheader', null, 'WF_METAHEADER_ERROR'));
    }
    // Request correct blockchain to make the transfer
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === wfMessage.MetaHeader.blockchain) {
            if (!bcInstance._enabled) {
                wfMessage.MetaHeader.transmissionSuccess = false;
                return callback(new ProcessingError(`Blockchain not active: ${bcInstance.name}`, null, 'WF_API_NOT_AVAILABLE'), wfMessage);
            }
            bcInstance._moduleImpl.sendMessage(wfMessage, function blockchainSendMessageCb(err, transactionHash, blockNumber) {
                if (err) {
                    wfMessage.MetaHeader.transmissionSuccess = false;
                    return callback(err, wfMessage);
                }
                wfMessage.MetaHeader.transmissionSuccess = true;
                wfMessage.MetaHeader.transactionHash = transactionHash;
                wfMessage.MetaHeader.blockNumber = blockNumber;
                return callback(null, wfMessage);
            });
        }
    });
}

/**
 * Performs a simple query to find a message by transaction hash
 * @function getMessage
 * @alias module:lib/blockchains.getMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {function(Error, wfMessage)} callback function to be called upon completion
 */
function getMessage(wfQuery = {}, callback) {
    // Check query parameters
    let queryErrors = [];
    if (!wfQuery['MetaHeader.blockchain']) queryErrors.push('Blockchain not specified in query');
    if (!wfQuery['MetaHeader.transactionHash']) queryErrors.push(queryErrors, 'Transaction hash not specified in query');
    if (queryErrors.length > 0) {
        return callback(new ProcessingError('Invalid message query', queryErrors, 'WF_API_BAD_REQUEST'));
    }
    // Check blockchain
    if (!_blockchains.includes(wfQuery['MetaHeader.blockchain'])) {
        return reportUnsupported(wfQuery['MetaHeader.blockchain'], callback);
    }
    // Request correct blockchain to look up message
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === wfQuery['MetaHeader.blockchain']) {
            if (!bcInstance._enabled) return reportNotActive(wfQuery['MetaHeader.blockchain'], callback);
            bcInstance._moduleImpl.getMessage(wfQuery, callback);
        }
    });
}

/**
 * Requests a Whiteflag signature for a specific blockchain address
 * @function requestSignature
 * @alias module:lib/blockchains.requestSignature
 * @param {Object} signPayload the JWS payload for the Whiteflag signature
 * @param {string} blockchain the blockchain for which the signature is requested
 * @param {function(Error, wfSignature)} callback function to be called upon completion
 */
function requestSignature(signPayload = {}, blockchain, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    // Check request data
    let payloadErrors = [];
    if (!signPayload.addr) payloadErrors.push('No blockchain address specified in payload');
    if (!signPayload.orgname) payloadErrors.push('No originator name specified in payload');
    if (!signPayload.url) payloadErrors.push('No URL specified in payload');
    if (payloadErrors.length > 0) return callback(new ProcessingError('Invalid signature request', payloadErrors, 'WF_API_BAD_REQUEST'));

    // Request signature from the correct blockchain
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._moduleImpl.requestSignature(signPayload, callback);
        }
    });
}

/**
 * Requests the address and correctly encoded pubic key for an originator
 * @function requestKeys
 * @alias module:lib/blockchains.requestKeys
 * @param {string} originatorPubKey the raw hex public key of the originator
 * @param {string} blockchain the blockchain for which the address and keys are requested
 * @param {function(Error, originatorKeys)} callback function to be called upon completion
 * @typedef {Object} originatorKeys object with originator keys
 */
function requestKeys(originatorPubKey, blockchain, callback) {
    // Check parameters
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    if (!originatorPubKey) {
        return callback(new ProcessingError('Missing originator public key', null, 'WF_API_BAD_REQUEST'));
    }
    // Request keys from the correct blockchain
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._moduleImpl.requestKeys(originatorPubKey, callback);
        }
    });
}

/**
 * Requests a blockchain address in binary encoded form
 * @function getBinaryAddress
 * @alias module:lib/blockchains.requestgetBinaryAddressKeys
 * @param {string} address the blockchain address
 * @param {string} blockchain the blockchain for which the binary encoded address is requested
 * @param {function(Error, binaryAddress)} callback function to be called upon completion
 * @typedef {Buffer} binaryAddress binary encoded blockchain address
 */
function getBinaryAddress(address, blockchain, callback) {
    // If no blockchains active, just assume hex encoded address for testing
    if (_bcConfig.length <= 0) return callback(null, hexToBuffer(address));

    // Check blockchain and address
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    if (!address) {
        return callback(new ProcessingError('Missing originator address', null, 'WF_API_BAD_REQUEST'));
    }
    // Request keys from the correct blockchain
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._moduleImpl.getBinaryAddress(address, callback);
        }
    });
}



/**
 * @description Transfers value from one blockchain address to an other address
 * @function transferFunds
 * @alias module:lib/blockchains.transferFunds
 * @param {Object} transfer the object with the transaction details to transfer value
 * @param {string} address the address of the account from which to make the transfer from
 * @param {string} blockchain the blockchain on which the value must be transdered
 * @param {function(Error, transactionHash, blockNumber)} callback function to be called upon completion
 * @typedef {string} transactionHash the transaction hash of the successful transfer
 * @typedef {number} blockNumber the blocknumber of the successful transfer transaction
 */
function transferFunds(transfer = {}, address, blockchain, callback) {
    // Check blockchain and address
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    if (!address) {
        return callback(new ProcessingError('Missing blockchain address', null, 'WF_API_BAD_REQUEST'));
    }
    // Check request data
    let transferErrors = [];
    if (!transfer.fromAddress) transfer.fromAddress = address;
    if (transfer.fromAddress !== address) transferErrors.push('Address to transfer value from does not match blockchain account');
    if (!transfer.toAddress) transferErrors.push('No address to transfer value to specified');
    if (!transfer.value) transferErrors.push('No value to transfer specified');
    if (transferErrors.length > 0) return callback(new ProcessingError('Invalid transfer request', transferErrors, 'WF_API_BAD_REQUEST'));

    // Request correct blockchain to make the transfer
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._moduleImpl.transferFunds(transfer, callback);
        }
    });
}

/**
 * Callback for blockchain account functions
 * @callback bcAccountCb
 * @param {Error} err an error if any, else null
 * @param {wfAccount} result the result of the account action
 */

/**
 * Creates blockchain account
 * @function createAccount
 * @alias module:lib/blockchains.createAccount
 * @param {string} blockchain the blockchain for which account needs to be created
 * @param {string} secret hexadecimal encoded blockchain dependent secret (e.g. private key, wif or seed)
 * @param {bcAccountCb} callback function to be called upon completion
 */
function createAccount(blockchain, secret = null, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    // Request correct blockchain to create account
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._moduleImpl.createAccount(secret, callback);
        }
    });
    // Hopefully the garbage collector will do its work
    secret = undefined;
}

/**
 * Updates blockchain account
 * @function updateAccount
 * @alias module:lib/blockchains.updateAccount
 * @param {Object} account the blockchain account to be updated
 * @param {string} address the address of the account to be updated
 * @param {string} blockchain the blockchain for which the account needs to be updated
 * @param {bcAccountCb} callback function to be called upon completion
 */
function updateAccount(account = {}, address, blockchain, callback) {
    // Check blockchain and address
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    if (!address) {
        return callback(new ProcessingError('Missing blockchain address', null, 'WF_API_BAD_REQUEST'));
    }
    // Check request data
    let accountErrors = [];
    if (!account.address) account.address = address;
    if (account.address !== address) accountErrors.push('Account addresses does not match blockchain account');
    if (accountErrors.length > 0) return callback(new ProcessingError('Invalid account update request', accountErrors, 'WF_API_BAD_REQUEST'));

    // Request correct blockchain to update account
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._moduleImpl.updateAccount(account, callback);
        }
    });
}

/**
 * Deletes blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains.deleteAccount
 * @param {string} address the blockchain account address
 * @param {string} blockchain the blockchain for which the account needs to be deleted
 * @param {bcAccountCb} callback function to be called upon completion
 */
function deleteAccount(address, blockchain, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    // Check request data
    let accountErrors = [];
    if (!address) accountErrors.push('No account address specified');
    if (accountErrors.length > 0) return callback(new ProcessingError('Invalid account delete request', accountErrors, 'WF_API_BAD_REQUEST'));

    // Request correct blockchain to delete account
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._moduleImpl.deleteAccount(address, callback);
        }
    });
}

// PRIVATE MODULE FUNCTIONS //
// PRIVATE ERROR FUNCTIONS //
/**
 * Calls callback with no blockchains configured error
 * @param {func} callback callback function to be called
 */
function reportNoBlockchain(callback) {
    return callback(new Error('No blockchain configured'), null);
}

/**
 * Calls callback with generic blockchain not active error message
 * @param {string} bcName the name of the inactive blockchain
 * @param {func} callback callback function to be called
 */
function reportNotActive(bcName, callback) {
    return callback(new ProcessingError(`Blockchain not active: ${bcName}`, null, 'WF_API_NOT_AVAILABLE'));
}

/**
 * Calls callback with generic blockchain not active error message
 * @param {string} bcName the name of the inactive blockchain
 * @param {func} callback callback function to be called
 */
function reportUnsupported(bcName, callback) {
    return callback(new ProcessingError(`Unsupported blockchain: ${bcName}`, null, 'WF_API_NOT_IMPLEMENTED'));
}

// PRIVATE BLOCKCHAIN CONFIGURATION FUNCTIONS //
/**
 * Parses the base elements of the configuration before processing the configuration of each blockchain
 * @private
 * @param {Object} bcConfigData the blockchains configuration object read from file
 * @returns {boolean} true if configuration could be parsed, else false
 */
function parseConfig(bcConfigData) {
    // Check if any blockchains defined in blockchains config
    if (bcConfigData?.blockchains) {
        // Validate config file based on schema
        let blockchainsConfigErrors = validateConfig(bcConfigData);
        if (blockchainsConfigErrors?.length > 0) {
            log.error(MODULELOG, 'Configuration errors: ' + JSON.stringify(blockchainsConfigErrors));
        } else {
            // Parse config of each blockchain
            bcConfigData.blockchains.forEach(bcInstance => {
                bcInstance._enabled = enableBlockchain(bcInstance);
            });
            return true;
        }
    }
    return false;
}

/**
 * Validates the blockchain configuration against the blockchain configuration schema
 * @private
 * @param {Object} bcConfigData the blockchains configuration object to be validated
 * @returns {Array} validation errors, empty if no errors
 */
function validateConfig(bcConfigData) {
    try {
        return [].concat(array.pluck(jsonValidate(bcConfigData, bcConfigSchema).errors, 'stack'));
    } catch(err) {
        return [].push(err.message);
    }
}

/**
 * Enables a specific blockchain and loads module
 * @private
 * @param {Object} bcInstance the configuration of a specific blockchain
 * @returns {boolean} true if blockchain could be activated and module could be loaded, else false
 */
function enableBlockchain(bcInstance) {
    // Check if blockchain is set to active
    if (!bcInstance.active) {
        log.info(MODULELOG, `Blockchain deactivated in configuration: ${bcInstance.name}`);
        return false;
    }
    // Try loading the module to assure it exists
    try {
        bcInstance._moduleImpl = require(BCMODULEDIR + bcInstance.module);
    } catch(err) {
        log.error(MODULELOG, `Module ${bcInstance.module} cannot be loaded: ${err.message}`);
        return false;
    }
    // Blockchain enabled
    return true;
}

// PRIVATE MESSAGE CONFIRMATION FUNCTIONS //
/**
 * Initialise Whiteflag message transaction confirmation
 * @private
 * @param {Object} confirmationConfig the confirmation paramters from the blockchain configuration
 */
function initConfirmMessages(confirmationConfig = {}) {
    // Clear queue from messages of disabled blockchains
    wfState.getQueue('blockDepths', function blockchainGetQueueCb(err, confirmationQueue) {
        if (err) return log.error(MODULELOG, err.message);

        // Cycle through messages that persisted on queue
        confirmationQueue.forEach(message => {
            let knownBlockchain = false;

            // Check of blockchain exists and is active
            _bcConfig.forEach(bcInstance => {
                if (message.blockchain === bcInstance.name) {
                    knownBlockchain = true;
                    if (!bcInstance._enabled) {
                        log.info(MODULELOG, `Removing message from confirmation queue because blockchain ${message.blockchain} is not enabled: ${message.transactionHash}`);
                        return removeMessageConfirmation(message);
                    }
                }
            });
            if (!knownBlockchain) {
                log.info(MODULELOG, `Removing message from confirmation queue because blockchain ${message.blockchain} is not configured: ${message.transactionHash}`);
                removeMessageConfirmation(message);
            }
        });
    });

    // Check if confirmation is enabled
    if (confirmationConfig.enabled) _confirmMessages = confirmationConfig.enabled;
    if (!_confirmMessages) {
        return log.info(MODULELOG, 'Messages are not traced for confirmation');
    }
    // Get confirmation parameters from configuration
    if (confirmationConfig.maxBlockDepth) _confirmBlockDepth = confirmationConfig.maxBlockDepth;
    if (confirmationConfig.interval) _confirmInterval = confirmationConfig.interval;
    if (confirmationConfig.updateEachBlock) _confirmEachBlock = confirmationConfig.updateEachBlock;

    // Put messages on the confirmation queue
    wfRxEvent.on('messageProcessed', confirmMessage);
    wfTxEvent.on('messageProcessed', confirmMessage);

    // Update messages on confirmation queue at set configured interval
    setInterval(checkConfirmations, _confirmInterval);
    log.info(MODULELOG, `Messages are traced for confirmation at ${_confirmInterval} ms intervals until a block depth of ${_confirmBlockDepth}`);
}

/**
 * Put incoming message on the confirmation queue
 * @private
 * @param {wfMessage} wfMessage the incoming Whiteflag message
 */
function confirmMessage(wfMessage) {
    // Message type for logging
    let messageStr = `${type(wfMessage)} message`;
    if (wfMessage.MetaHeader.transceiveDirection === 'TX') messageStr = `sent ${messageStr}`;
    if (wfMessage.MetaHeader.transceiveDirection === 'RX') messageStr = `received ${messageStr}`;

    // Check for block number
    if (!wfMessage.MetaHeader.blockNumber) {
        return log.debug(MODULELOG, `Cannot put ${messageStr} on confirmation queue if not yet in a block: ${wfMessage.MetaHeader.transactionHash}`);
    }
    // Prepare message for queue
    const message = {
        transactionHash: wfMessage.MetaHeader.transactionHash,
        blockchain: wfMessage.MetaHeader.blockchain,
        blockNumber: wfMessage.MetaHeader.blockNumber,
        blockDepth: 0,
        confirmed: false
    };
    // Put on confirmation queue if blockchain is active
    _bcConfig.forEach(bcInstance => {
        if (bcInstance._enabled) {
            if (message.blockchain === bcInstance.name) {
                wfState.upsertQueueData('blockDepths', 'transactionHash', message);
                log.trace(MODULELOG, `Put ${messageStr} on confirmation queue: ${message.transactionHash}`);
            }
        }
    });
}

/**
 * Removes the message from the confirmation queue
 * @param {Object} message the message data on the confirmation queue
 */
function removeMessageConfirmation(message) {
    wfState.removeQueueData('blockDepths', 'transactionHash', message.transactionHash);
    if (message.confirmed === true) log.debug(MODULELOG, `Removed confirmed message from confirmation queue: ${message.transactionHash}`);
    if (message.confirmed === false) log.warn(MODULELOG, `Removed unconfirmed message from confirmation queue: ${message.transactionHash}`);
}

/**
 * Checks if block depth has changed for each message on the confirmation queue
 * @private
 */
function checkConfirmations() {
    wfState.getQueue('blockDepths', function blockchainGetQueueCb(err, confirmationQueue) {
        if (err) return log.error(MODULELOG, err.message);
        confirmationQueue.forEach(message => checkMessageConfirmation(message));
    });
}

/**
 * Checks the message conformation against current block height
 * @param {Object} message the message data on the confirmation queue
 */
function checkMessageConfirmation(message) {
    getBlockHeight(message.blockchain, function blockchainGetHeightCb(err, blockHeight) {
        if (err) return log.error(MODULELOG, err.message);

        // Check new block depth
        let blockDepth = blockHeight - message.blockNumber;
        if (blockDepth < 0) blockDepth = 0;
        if (blockDepth === message.blockDepth) return;
        message.blockDepth = blockDepth;

        // Check if block depth required for confirmation if reached
        if (message.blockDepth < _confirmBlockDepth) {
            wfState.upsertQueueData('blockDepths', 'transactionHash', message);
            if (_confirmEachBlock) updateMessageConfirmation(message);
            return;
        }
        // Double check block number with message duplicate from blockchain
        const bcInstance = _bcConfig.find(bcInstance => bcInstance.name === message.blockchain);
        if (!bcInstance._enabled) {
            return log.warn(MODULELOG, `Cannot check block depth for disabled blockchain: ${message.blockchain}`);
        }
        let wfQuery = {};
        wfQuery['MetaHeader.transactionHash'] = message.transactionHash;
        bcInstance._moduleImpl.getMessage(wfQuery, function blockchainTransactionConfirmCb(err, messageDuplicate) {
            if (err) return log.error(MODULELOG, err.message);

            // Check known block number against actual block number
            if (message.blockNumber !== messageDuplicate.MetaHeader.blockNumber) {
                message.blockNumber = messageDuplicate.MetaHeader.blockNumber;
                return wfState.upsertQueueData('blockDepths', 'transactionHash', message);
            }
            // Message is confirmed
            message.confirmed = true;
            log.debug(MODULELOG, `Message is now ${message.blockDepth} blocks deep and confirmed: ${message.transactionHash}`);
            updateMessageConfirmation(message);
        });
    });
}

/**
 * Updates the Whiteflag message confirmation data in the datastore
 * @private
 * @param {Object} message the message data on the confirmation queue
 * @emits module:lib/protocol/events.rxEvent:messageUpdated
 * @emits module:lib/protocol/events.txEvent:messageUpdated
 */
function updateMessageConfirmation(message) {
    // Construct query and retrieve message grom database
    let wfQuery = {};
    wfQuery['MetaHeader.transactionHash'] = message.transactionHash;
    wfQuery['MetaHeader.blockchain'] = message.blockchain;
    wfApiDatastores.getMessages(wfQuery, function blockchainGetMessageDbCb(err, wfMessages, count) {
        if (err) return log.error(MODULELOG, err.message);

        // Remove from queue if message not exactly matches one message in primary datastore
        if (count !== 1 || wfMessages.length === 0) return removeMessageConfirmation(message);

        // Update message
        const wfMessage = wfMessages[0];
        if (wfMessage.MetaHeader.transactionHash === message.transactionHash) {
            // Update meteaheader with block depth
            wfMessage.MetaHeader.blockDepth = message.blockDepth;

            // When message is confirmed: update metaheader and remove from queue
            if (message.confirmed) {
                wfMessage.MetaHeader.confirmed = message.confirmed;
                removeMessageConfirmation(message);
            }
            // Trigger message update action, e.g. datastore
            if (wfMessage.MetaHeader.transceiveDirection === 'RX') wfRxEvent.emit('messageUpdated', wfMessage);
            if (wfMessage.MetaHeader.transceiveDirection === 'TX') wfTxEvent.emit('messageUpdated', wfMessage);
        }
    });
}

/**
 * Helper function to get current blockchain height from state
 * @private
 * @param {string} blockchain the name of the blockchain to het
 * @param {function(Error, highestBlock)} callback function to be called upon completion
 * @typedef {number} highestBlock
 */
function getBlockHeight(blockchain, callback) {
    wfState.getBlockchainData(blockchain, function blockchainGetDataCb(err, blockchainSate) {
        if (!err && !blockchainSate) err = new Error(`Blockchain ${blockchain} does not exist in state`);
        if (err) return callback(err);
        if (!blockchainSate.status?.highestBlock) {
            return callback(new Error(`Blockchain state of ${blockchain} does not contain highest block`));
        }
        return callback(null, blockchainSate.status.highestBlock);
    });
}
