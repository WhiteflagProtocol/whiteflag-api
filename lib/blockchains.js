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

// Node.js core and external modules //
const fs = require('fs');
const toml = require('toml');
const jsonValidate = require('jsonschema').validate;

// Whiteflag common functions and classes //
const log = require('./common/logger');
const array = require('./common/arrays');
const { type } = require('./common/protocol');
const { ProcessingError, ProtocolError } = require('./common/errors');

// Whiteflag modules //
const wfState = require('./protocol/state');
const wfApiDatastores = require('./datastores');

// Whiteflag event emitters //
const wfRxEvent = require('./protocol/events').rxEvent;
const wfTxEvent = require('./protocol/events').txEvent;

// Module constants //
const MODULELOG = 'blockchains';
const BINENCODING = 'hex';
const WFCONFDIR = process.env.WFCONFDIR || './config';
const BCCONFFILE = WFCONFDIR + '/blockchains.toml';
const BCMODULEDIR = './blockchains/';
const wfBlockchainsConfigSchema = JSON.parse(fs.readFileSync('./lib/blockchains/static/blockchains.config.schema.json'));

// Module variables //
let _blockchains = [];
let _blockchainsState = {};
let _blockchainsConfig = [];
let _confirmMessages = false;
let _confirmationInterval = 10000;
let _confirmationBlockDepth = 8;
let _confirmEachBlock = false;

// MAIN MODULE FUNCTIONS //
/**
 * Initialises configured blockchains
 * @function initBlockchains
 * @alias module:lib/blockchains.init
 * @param {function(Error, blockchains)} callback function to be called upon completion
 * @typedef {Array} blockchains names of the configured blockchains
 */
function initBlockchains(callback) {
    // Get the blockchain state
    wfState.getBlockchains(function blockchainsGetStateDb(err, blockchainsState) {
        if (err) return callback(err);
        _blockchainsState = blockchainsState;

        // Read the configuration file
        let bcConfigData = {};
        try {
            bcConfigData = toml.parse(fs.readFileSync(BCCONFFILE));
        } catch(err) {
            return callback(err);
        }
        // Parse config file and initialise each enabled blockchain
        if (parseConfig(bcConfigData)) {
            _blockchainsConfig = bcConfigData.blockchains;

            // Get array of names of configured blockchains
            _blockchains = array.pluck(_blockchainsConfig, 'name');
            log.info(MODULELOG, `Configured blockchains in ${BCCONFFILE}: ` + JSON.stringify(_blockchains));

            // Get array of names of blockchains in the internal state
            let blockchainsInState = Object.keys(_blockchainsState);
            log.debug(MODULELOG, 'Known blockchains in internal state: ' + JSON.stringify(blockchainsInState));

            // Ensure configured blockchains exist in the internal state
            _blockchains.forEach(blockchain => {
                if (!blockchainsInState.includes(blockchain)) {
                    log.trace(MODULELOG, `Adding ${blockchain} to internal state`);
                    _blockchainsState[blockchain] = {
                        parameters: {},
                        status: {},
                        accounts: []
                    };
                    wfState.updateBlockchainData(blockchain, _blockchainsState[blockchain]);
                }
            });
            // Initialise each enabled blockchain
            _blockchainsConfig.forEach(blockchainInstance => {
                if (blockchainInstance._enabled) {
                    blockchainInstance._moduleImpl.init(blockchainInstance, blockchainInitCb);
                }
            });
            // Initiliase transcation confirmation
            initConfirmMessages(bcConfigData.confirmation);

            // Done initialising blockchains
            return callback(null, _blockchains);
        } else {
            return callback(new Error(`Could not parse configuration in ${BCCONFFILE}`));
        }
    });
    /**
     * Callback after intitialising specific blockchain module
     * @callback blockchainInitCb
     * @param {Error} err error object if any error
     * @param {string} blockchain name of the blockchain
     */
    function blockchainInitCb(err, blockchain) {
        if (err) return log.error(MODULELOG, `Could not intialise ${blockchain}: ${err.message}`);
        return log.info(MODULELOG, `Initialised blockchain: ${blockchain}`);
    }
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
    if (!Object.prototype.hasOwnProperty.call(wfMessage, 'MetaHeader')) {
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
    if (_blockchainsConfig.length <= 0) return callback(new Error('No blockchain configured'), null);
    _blockchainsConfig.forEach(blockchainInstance => {
        // Get configuration and call init function for this blockchain
        if (blockchainInstance.name === wfMessage.MetaHeader.blockchain) {
            if (!blockchainInstance._enabled) return callback(new ProcessingError(`Blockchain not active: ${blockchainInstance.name}`, null, 'WF_API_NOT_AVAILABLE'), wfMessage);
            blockchainInstance._moduleImpl.sendMessage(wfMessage, function blockchainSendMessageCb(err, transactionHash, blockNumber) {
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
        return callback(new ProcessingError(`Unsupported blockchain: ${wfQuery['MetaHeader.blockchain']}`, null, 'WF_API_NOT_IMPLEMENTED'));
    }
    // Request correct blockchain to look up message
    if (_blockchainsConfig.length <= 0) return callback(new Error('No blockchain configured'), null);
    _blockchainsConfig.forEach(blockchainInstance => {
        // Get configuration and call init function for this blockchain
        if (blockchainInstance.name === wfQuery['MetaHeader.blockchain']) {
            if (!blockchainInstance._enabled) return callback(new ProcessingError(`Blockchain not active: ${blockchainInstance.name}`, null, 'WF_API_NOT_AVAILABLE'));
            blockchainInstance._moduleImpl.getMessage(wfQuery, callback);
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
 * @typedef {Object} wfSignature Whiteflag authentication signature
 */
function requestSignature(signPayload = {}, blockchain, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return callback(new ProcessingError(`Unsupported blockchain: ${blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'));
    }
    // Check request data
    let payloadErrors = [];
    if (!signPayload.addr) payloadErrors.push('No blockchain address specified in payload');
    if (!signPayload.orgname) payloadErrors.push('No originator name specified in payload');
    if (!signPayload.url) payloadErrors.push('No URL specified in payload');
    if (payloadErrors.length > 0) return callback(new ProcessingError('Invalid signature request', payloadErrors, 'WF_API_BAD_REQUEST'));

    // Request signature from the correct blockchain
    if (_blockchainsConfig.length <= 0) return callback(new Error('No blockchain configured'), null);
    _blockchainsConfig.forEach(blockchainInstance => {
        // Get configuration and call init function for this blockchain
        if (blockchainInstance.name === blockchain) {
            if (!blockchainInstance._enabled) return reportNotActive(callback, blockchainInstance.name);
            blockchainInstance._moduleImpl.requestSignature(signPayload, callback);
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
        return callback(new ProcessingError(`Unsupported blockchain: ${blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'));
    }
    if (!originatorPubKey) {
        return callback(new ProcessingError('Missing originator public key', null, 'WF_API_BAD_REQUEST'));
    }
    // Request keys from the correct blockchain
    if (_blockchainsConfig.length <= 0) return callback(new Error('No blockchain configured'), null);
    _blockchainsConfig.forEach(blockchainInstance => {
        // Get configuration and call init function for this blockchain
        if (blockchainInstance.name === blockchain) {
            if (!blockchainInstance._enabled) return reportNotActive(callback, blockchainInstance.name);
            blockchainInstance._moduleImpl.requestKeys(originatorPubKey, callback);
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
    if (_blockchainsConfig.length <= 0) return callback(null, Buffer.from(address, BINENCODING));

    // Check parameters
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return callback(new ProcessingError(`Unsupported blockchain: ${blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'));
    }
    if (!address) {
        return callback(new ProcessingError('Missing originator address', null, 'WF_API_BAD_REQUEST'));
    }
    // Request keys from the correct blockchain
    _blockchainsConfig.forEach(blockchainInstance => {
        // Get configuration and call init function for this blockchain
        if (blockchainInstance.name === blockchain) {
            if (!blockchainInstance._enabled) return reportNotActive(callback, blockchainInstance.name);
            blockchainInstance._moduleImpl.getBinaryAddress(address, callback);
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
        return callback(new ProcessingError(`Unsupported blockchain: ${blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'));
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
    if (_blockchainsConfig.length <= 0) return callback(new Error('No blockchain configured'), null);
    _blockchainsConfig.forEach(blockchainInstance => {
        if (blockchainInstance.name === blockchain) {
            if (!blockchainInstance._enabled) return reportNotActive(callback, blockchainInstance.name);
            blockchainInstance._moduleImpl.transfer(transfer, callback);
        }
    });
}

/**
 * Creates blockchain account
 * @function createAccount
 * @alias module:lib/blockchains.createAccount
 * @param {string} blockchain the blockchain for which account needs to be created
 * @param {string} privateKey hexadecimal encoded private key
 * @param {blockchainCreateAccountCb} callback function to be called upon completion
 * @typedef {function(Error, result)} blockchainCreateAccountCb
 * @typedef {Object} result
 */
function createAccount(blockchain, privateKey = null, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return callback(new ProcessingError(`Unsupported blockchain: ${blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'));
    }
    // Request correct blockchain to create account
    if (_blockchainsConfig.length <= 0) return callback(new Error('No blockchain configured'), null);
    _blockchainsConfig.forEach(blockchainInstance => {
        if (blockchainInstance.name === blockchain) {
            if (!blockchainInstance._enabled) return reportNotActive(callback, blockchainInstance.name);
            blockchainInstance._moduleImpl.createAccount(privateKey, callback);
        }
    });
    // Hopefully the garbage collector will do its work
    privateKey = undefined;
}

/**
 * Updates blockchain account
 * @function updateAccount
 * @alias module:lib/blockchains.updateAccount
 * @param {Object} account the blockchain account to be updated
 * @param {string} address the address of the account to be updated
 * @param {string} blockchain the blockchain for which the account needs to be updated
 * @param {blockchainCreateAccountCb} callback function to be called upon completion
 * @typedef {function(Error, result)} blockchainCreateAccountCb
 * @typedef {Object} result
 */
function updateAccount(account = {}, address, blockchain, callback) {
    // Check blockchain and address
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return callback(new ProcessingError(`Unsupported blockchain: ${blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'));
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
    if (_blockchainsConfig.length <= 0) return callback(new Error('No blockchain configured'), null);
    _blockchainsConfig.forEach(blockchainInstance => {
        if (blockchainInstance.name === blockchain) {
            if (!blockchainInstance._enabled) return reportNotActive(callback, blockchainInstance.name);
            blockchainInstance._moduleImpl.updateAccount(account, callback);
        }
    });
}

/**
 * Deletes blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains.deleteAccount
 * @param {string} address the blockchain account address
 * @param {string} blockchain the blockchain for which the account needs to be deleted
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 * @typedef {function(Error, result)} blockchainDeleteAccountCb
 * @typedef {Object} result
 */
function deleteAccount(address, blockchain, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return callback(new ProcessingError(`Unsupported blockchain: ${blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'));
    }
    // Check request data
    let accountErrors = [];
    if (!address) accountErrors.push('No account address specified');
    if (accountErrors.length > 0) return callback(new ProcessingError('Invalid account delete request', accountErrors, 'WF_API_BAD_REQUEST'));

    // Request correct blockchain to delete account
    if (_blockchainsConfig.length <= 0) return callback(new Error('No blockchain configured'), null);
    _blockchainsConfig.forEach(blockchainInstance => {
        if (blockchainInstance.name === blockchain) {
            if (!blockchainInstance._enabled) return reportNotActive(callback, blockchainInstance.name);
            blockchainInstance._moduleImpl.deleteAccount(address, callback);
        }
    });
}

// PRIVATE MODULE FUNCTIONS //
// PRIVATE ERROR FUNCTIONS //
/**
 * Calls callback with generic blockchain not active error message
 * @param {func} callback Callback function to be called
 * @param {String} blockchainName the name of the inactive blockchain
 */
function reportNotActive(callback, blockchainName) {
    return callback(new ProcessingError(`Blockchain not active: ${blockchainName}`, null, 'WF_API_NOT_AVAILABLE'));
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
    if (bcConfigData && bcConfigData.blockchains) {
        // Validate config file based on schema
        let blockchainsConfigErrors = validateConfig(bcConfigData);
        if (blockchainsConfigErrors && blockchainsConfigErrors.length > 0) {
            log.error(MODULELOG, 'Configuration errors: ' + JSON.stringify(blockchainsConfigErrors));
        } else {
            // Parse config of each blockchain
            bcConfigData.blockchains.forEach(blockchainInstance => {
                blockchainInstance._enabled = enableBlockchain(blockchainInstance);
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
 * @returns {array} validation errors, empty if no errors
 */
function validateConfig(bcConfigData) {
    try {
        return [].concat(array.pluck(jsonValidate(bcConfigData, wfBlockchainsConfigSchema).errors, 'stack'));
    } catch(err) {
        return [].push(err.message);
    }
}

/**
 * Enables a specific blockchain and loads module
 * @private
 * @param {Object} blockchainInstance the configuration of a specific blockchain
 * @returns {boolean} true if blockchain could be activated and module could be loaded, else false
 */
function enableBlockchain(blockchainInstance) {
    // Check if blockchain is set to active
    if (!blockchainInstance.active) {
        log.info(MODULELOG, `Blockchain deactivated in configuration: ${blockchainInstance.name}`);
        return false;
    }
    // Try loading the module to assure it exists
    try {
        blockchainInstance._moduleImpl = require(BCMODULEDIR + blockchainInstance.module);
    } catch(err) {
        log.error(MODULELOG, `Module ${blockchainInstance.module} cannot be loaded: ${err.message}`);
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
    if (confirmationConfig.enabled) _confirmMessages = confirmationConfig.enabled;
    if (!_confirmMessages) return log.info(MODULELOG, 'Messages are not traced for confirmation');
    if (confirmationConfig.maxBlockDepth) _confirmationBlockDepth = confirmationConfig.maxBlockDepth;
    if (confirmationConfig.interval) _confirmationInterval = confirmationConfig.interval;
    if (confirmationConfig.updateEachBlock) _confirmEachBlock = confirmationConfig.updateEachBlock;

    // Put messages on the confirmation queue
    wfRxEvent.on('messageProcessed', confirmMessage);
    wfTxEvent.on('messageProcessed', confirmMessage);

    // Clear queue from messages of unenabled blockchains
    wfState.getQueue('blockDepths', function blockchainGetQueueCb(err, confirmationQueue) {
        if (err) return log.error(MODULELOG, err.message);

        // Cycle through blockchains
        _blockchainsConfig.forEach(blockchainInstance => {
            if (!blockchainInstance._enabled) {
                // Run through queue to remove messages of unenabled blockchain
                confirmationQueue.forEach(message => {
                    if (message.blockchain === blockchainInstance.name) {
                        removeMessageConfirmation(message);
                    }
                });
            }
        });
    });
    // Update message confirmation on queue
    setInterval(checkConfirmations, _confirmationInterval);

    // Log message confirmation start
    log.info(MODULELOG, `Messages are traced for confirmation at ${_confirmationInterval} ms intervals until a block depth of ${_confirmationBlockDepth}`);
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
        return log.warn(MODULELOG, `Cannot confirm ${messageStr} without block number: ${wfMessage.MetaHeader.transactionHash}`);
    }
    // Put message on confirmation queue
    const message = {
        transactionHash: wfMessage.MetaHeader.transactionHash,
        blockchain: wfMessage.MetaHeader.blockchain,
        blockNumber: wfMessage.MetaHeader.blockNumber,
        blockDepth: 0,
        confirmed: false
    };
    wfState.upsertQueueData('blockDepths', 'transactionHash', message);
    log.trace(MODULELOG, `Put ${messageStr} on confirmation queue: ${message.transactionHash}`);
}

/**
 * Removes the message from the confirmation queue
 * @param {Object} message the message data on the confirmation queue
 */
function removeMessageConfirmation(message) {
    wfState.removeQueueData('blockDepths', 'transactionHash', message.transactionHash);
    if (message.confirmed === true) log.trace(MODULELOG, `Removed confirmed message from confirmation queue: ${message.transactionHash}`);
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
        if (message.blockDepth < _confirmationBlockDepth) {
            wfState.upsertQueueData('blockDepths', 'transactionHash', message);
            if (_confirmEachBlock) updateMessageConfirmation(message);
            return;
        }
        // Double check block number with message duplicate from blockchain
        const blockchainInstance = _blockchainsConfig.find(blockchainInstance => blockchainInstance.name === message.blockchain);
        if (!blockchainInstance._enabled) {
            return log.warn(MODULELOG, `Cannot check block depth for disabled blockchain: ${message.blockchain}`);
        }
        let wfQuery = {};
        wfQuery['MetaHeader.transactionHash'] = message.transactionHash;
        blockchainInstance._moduleImpl.getMessage(wfQuery, function blockchainTransactionConfirmCb(err, messageDuplicate) {
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
    wfState.getBlockchainData(blockchain, function ethGetBlockchainDataCb(err, blockchainSate) {
        if (!err && !blockchainSate) err = new Error(`Blockchain ${blockchain} does not exist in state`);
        if (err) return callback(err);
        if (!blockchainSate.status || !blockchainSate.status.highestBlock) {
            return callback(new Error(`Blockchain state of ${blockchain} does not contain highest block`));
        }
        return callback(null, blockchainSate.status.highestBlock);
    });
}
