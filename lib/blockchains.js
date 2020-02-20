'use strict';
/**
 * @module lib/blockchains
 * @summary Whiteflag API blockchains module
 * @description Module with the blockchain abstraction layer to connect with multiple blockchains
 */
module.exports = {
    // Blockchain functions
    init: initBlockchains,
    sendMessage,
    lookupMessage,
    queryTransactions,
    requestSignature,
    requestKeys,
    getBinaryAddress,
    transfer,
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
let _confirmationConfig = {};
let _confirmMessages = false;
let _confirmationInterval = 10000;
let _confirmationBlockDepth = 8;
let _confirmEachBlock = false;

// MAIN MODULE FUNCTIONS //
/**
 * Initialises configured blockchains
 * @function initBlockchains
 * @alias module:lib/blockchains.init
 * @param {function} callback function to be called upon completion
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
            _confirmationConfig = bcConfigData.confirmation;

            // Get array of names of configured blockchains
            _blockchains = array.pluck(_blockchainsConfig, 'name');
            log.info(MODULELOG, `Configuration read from ${BCCONFFILE}: ` + JSON.stringify(_blockchains));

            // Get array of names of blockchains in the internal state
            let blockchainsInState = Object.keys(_blockchainsState);
            log.trace(MODULELOG, 'Blockchains in internal state: ' + JSON.stringify(blockchainsInState));

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
            _blockchainsConfig.forEach(bcConfig => {
                if (bcConfig._enabled) {
                    bcConfig._moduleImpl.init(bcConfig, blockchainInitCb);
                }
            });
            // Initiliase transcation confirmation
            if (_confirmationConfig.enabled) _confirmMessages = _confirmationConfig.enabled;
            if (_confirmMessages) {
                if (_confirmationConfig.maxBlockDepth) _confirmationBlockDepth = _confirmationConfig.maxBlockDepth;
                if (_confirmationConfig.interval) _confirmationInterval = _confirmationConfig.interval;
                if (_confirmationConfig.updateEachBlock) _confirmEachBlock = _confirmationConfig.updateEachBlock;
                initConfirmMessages();
            }
            // Done initialising blockchains
            return callback(null, _blockchains);
        } else {
            return callback(new Error(`Could not parse configuration in ${BCCONFFILE}`));
        }
    });
    /**
     * Callback after intitialising specific blockchain module
     * @callback blockchainInitCb
     * @param {object} err error object if any error
     * @param {string} blockchain name of the blockchain
     */
    function blockchainInitCb(err, blockchain) {
        if (err) {
            log.error(MODULELOG, `Cannot intialise ${blockchain}: ${err.message}`);
        }
        log.info(MODULELOG, `Initialised blockchain: ${blockchain}`);
    }
}

/**
 * Sends an encoded message to the blockchain defined in the metaheader
 * @function sendMessage
 * @alias module:lib/blockchains.sendMessage
 * @param {object} wfMessage the Whiteflag message to be sent on the blockchain
 * @param {function} callback function to be called upon completion
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
    _blockchainsConfig.forEach(bcConfig => {
        // Get configuration and call init function for this blockchain
        if (bcConfig.name === wfMessage.MetaHeader.blockchain) {
            if (bcConfig._enabled) {
                bcConfig._moduleImpl.sendMessage(wfMessage, blockchainSendMessageCb);
            } else {
                return callback(new ProcessingError(`Blockchain not active: ${bcConfig.name}`, null, 'WF_API_NOT_AVAILABLE'), wfMessage);
            }
        }
    });
    /**
     * Callback after sending Whiteflag message
     * @callback blockchainSendMessageCb
     * @param {object} err error object if any error
     * @param {string} transactionHash the transaction hash of the sent message
     */
    function blockchainSendMessageCb(err, transactionHash, blockNumber) {
        if (err) {
            wfMessage.MetaHeader.transmissionSuccess = false;
            return callback(err, wfMessage);
        }
        wfMessage.MetaHeader.transmissionSuccess = true;
        wfMessage.MetaHeader.transactionHash = transactionHash;
        wfMessage.MetaHeader.blockNumber = blockNumber;
        return callback(null, wfMessage);
    }
}

/**
 * Performs a simple query to find a message by transaction hash
 * @function lookupMessage
 * @alias module:lib/blockchains.lookupMessage
 * @param {object} wfQuery the property of the transaction to look up
 * @param {function} callback function to be called upon completion
 */
function lookupMessage(wfQuery = {}, callback) {
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
    _blockchainsConfig.forEach(bcConfig => {
        // Get configuration and call init function for this blockchain
        if (bcConfig.name === wfQuery['MetaHeader.blockchain']) {
            if (bcConfig._enabled) {
                bcConfig._moduleImpl.lookupMessage(wfQuery, blockchainLookupMessageCb);
            } else {
                return callback(new ProcessingError(`Blockchain not active: ${bcConfig.name}`, null, 'WF_API_NOT_AVAILABLE'));
            }
        }
    });
    /**
     * Callback after Whiteflag message lookup
     * @callback blockchainLookupMessageCb
     * @param {object} err error object if any error
     * @param {array} wfMessage the Whiteflag message if found
     */
    function blockchainLookupMessageCb(err, wfMessage) {
        if (err) return callback(err, null);
        return callback(null, wfMessage);
    }
}

/**
 * Performs a complex query to find one or more blockchain transactions
 * @function queryTransactions
 * @alias module:lib/blockchains.queryTransactions
 * @param {object} wfQuery the properties of the transactions to look up
 * @param {function} callback function to be called upon completion
 */
function queryTransactions(wfQuery = {}, callback) {
    // Check query parameters
    let queryErrors = [];
    if (!wfQuery['MetaHeader.blockchain']) queryErrors.push('Blockchain not specified in query');
    if (queryErrors.length > 0) {
        return callback(new ProcessingError('Invalid message query', queryErrors, 'WF_API_BAD_REQUEST'));
    }
    // Check blockchain
    if (!_blockchains.includes(wfQuery['MetaHeader.blockchain'])) {
        return callback(new ProcessingError(`Unsupported blockchain: ${wfQuery['MetaHeader.blockchain']}`, null, 'WF_API_NOT_IMPLEMENTED'));
    }
    // TODO: request the correct blockchain to perform query and process result
    let err = new ProcessingError('Complex blockchain queries not implemented', null, 'WF_API_NOT_IMPLEMENTED');
    let wfMessages = [];

    // Callback with any error and signature
    return callback(err, wfMessages);
}

/**
 * Requests a Whiteflag signature for a specific blockchain address
 * @function requestSignature
 * @alias module:lib/blockchains.requestSignature
 * @param {object} signPayload the JWS payload for the Whiteflag signature
 * @param {string} blockchain the blockchain for which the signature is requested
 * @param {function} callback function to be called upon completion
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
    _blockchainsConfig.forEach(bcConfig => {
        // Get configuration and call init function for this blockchain
        if (bcConfig.name === blockchain) {
            if (bcConfig._enabled) {
                bcConfig._moduleImpl.requestSignature(signPayload, blockchainRequestSignatureCb);
            } else {
                return callback(new ProcessingError(`Blockchain not active: ${bcConfig.name}`, null, 'WF_API_NOT_AVAILABLE'));
            }
        }
    });
    /**
     * Callback returning the Whiteflag signature
     * @callback blockchainRequestSignatureCb
     * @param {object} err error object if any error
     * @param {object} wfSignature Whiteflag signature
     */
    function blockchainRequestSignatureCb(err, wfSignature) {
        if (err) return callback(err);
        return callback(null, wfSignature);
    }
}

/**
 * Requests the address and correctly encoded pubic key for an originator
 * @function requestKeys
 * @alias module:lib/blockchains.requestKeys
 * @param {string} originatorPubKey the raw hex public key of the originator
 * @param {string} blockchain the blockchain for which the address and keys are requested
 * @param {function} callback function to be called upon completion
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
    _blockchainsConfig.forEach(bcConfig => {
        // Get configuration and call init function for this blockchain
        if (bcConfig.name === blockchain) {
            if (bcConfig._enabled) {
                bcConfig._moduleImpl.requestKeys(originatorPubKey, blockchainRequestKeysCb);
            } else {
                return callback(new ProcessingError(`Blockchain not active: ${bcConfig.name}`, null, 'WF_API_NOT_AVAILABLE'));
            }
        }
    });
    /**
     * Callback returning the originator keys
     * @callback blockchainRequestKeysCb
     * @param {object} err error object if any error
     * @param {object} originatorKeyObj the originator address and keys
     */
    function blockchainRequestKeysCb(err, originatorKeys) {
        if (err) return callback(err, null);
        return callback(null, originatorKeys);
    }
}

/**
 * Requests a blockchain address in binary encoded form
 * @function getBinaryAddress
 * @alias module:lib/blockchains.requestgetBinaryAddressKeys
 * @param {string} address the blockchain address
 * @param {string} blockchain the blockchain for which the binary encoded address is requested
 * @param {function} callback function to be called upon completion
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
    _blockchainsConfig.forEach(bcConfig => {
        // Get configuration and call init function for this blockchain
        if (bcConfig.name === blockchain) {
            if (bcConfig._enabled) {
                bcConfig._moduleImpl.getBinaryAddress(address, blockchainBinaryAddressCb);
            } else {
                return callback(new ProcessingError(`Blockchain not active: ${bcConfig.name}`, null, 'WF_API_NOT_AVAILABLE'));
            }
        }
    });
    /**
     * Callback returning the originator keys
     * @callback blockchainBinaryAddressCb
     * @param {object} err error object if any error
     * @param {buffer} originatorKeyObj the originator address and keys
     */
    function blockchainBinaryAddressCb(err, binaryAddress) {
        if (err) return callback(err, null);
        return callback(null, binaryAddress);
    }
}

/**
 * Transfers value from one blockchain address to an other address
 * @function transfer
 * @alias module:lib/blockchains.transfer
 * @param {object} transfer the object with the transaction details to transfer value
 * @param {string} address the address of the account from which to make the transfer from
 * @param {string} blockchain the blockchain on which the value must be transdered
 * @param {function} callback function to be called upon completion
 */
function transfer(transfer = {}, address, blockchain, callback) {
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
    _blockchainsConfig.forEach(bcConfig => {
        if (bcConfig.name === blockchain) {
            if (bcConfig._enabled) {
                bcConfig._moduleImpl.transfer(transfer, blockchainTransferValueCb);
            } else {
                return callback(new ProcessingError(`Blockchain not active: ${bcConfig.name}`, null, 'WF_API_NOT_AVAILABLE'));
            }
        }
    });
    /**
     * Callback returning the transaction hash of the value transfer
     * @callback blockchainTransferValueCb
     * @param {object} err error object if any error
     * @param {string} transactionHash transaction hash
     */
    function blockchainTransferValueCb(err, transactionHash, blockNumber) {
        if (err) return callback(err);
        return callback(null, transactionHash, blockNumber);
    }
}

/**
 * Creates blockchain account
 * @function createAccount
 * @alias module:lib/blockchains.createAccount
 * @param {string} blockchain the blockchain for which account needs to be created
 * @param {string} privateKey hexadecimal encoded private key
 * @param {function} callback function to be called upon completion
 */
function createAccount(blockchain, privateKey = null, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return callback(new ProcessingError(`Unsupported blockchain: ${blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'));
    }
    // Request correct blockchain to create account
    if (_blockchainsConfig.length <= 0) return callback(new Error('No blockchain configured'), null);
    _blockchainsConfig.forEach(bcConfig => {
        if (bcConfig.name === blockchain) {
            if (bcConfig._enabled) {
                bcConfig._moduleImpl.createAccount(privateKey, function blockchainCreateAccountCb(err, result) {
                    if (err) return callback(err);
                    return callback(null, result);
                });
            } else {
                return callback(new ProcessingError(`Blockchain not active: ${bcConfig.name}`, null, 'WF_API_NOT_AVAILABLE'));
            }
        }
    });
    // Hopefully the garbage collector will do its work
    privateKey = undefined;
}

/**
 * Updates blockchain account
 * @function updateAccount
 * @alias module:lib/blockchains.updateAccount
 * @param {object} account the blockchain account to be updated
 * @param {string} address the address of the account to be updated
 * @param {string} blockchain the blockchain for which the account needs to be updated
 * @param {function} callback function to be called upon completion
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
    _blockchainsConfig.forEach(bcConfig => {
        if (bcConfig.name === blockchain) {
            if (bcConfig._enabled) {
                bcConfig._moduleImpl.updateAccount(account, function blockchainUpdateAccountCb(err, result) {
                    if (err) return callback(err);
                    return callback(null, result);
                });
            } else {
                return callback(new ProcessingError(`Blockchain not active: ${bcConfig.name}`, null, 'WF_API_NOT_AVAILABLE'));
            }
        }
    });
}

/**
 * Deletes blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains.deleteAccount
 * @param {string} address the blockchain account address
 * @param {string} blockchain the blockchain for which the account needs to be deleted
 * @param {function} callback function to be called upon completion
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
    _blockchainsConfig.forEach(bcConfig => {
        if (bcConfig.name === blockchain) {
            if (bcConfig._enabled) {
                bcConfig._moduleImpl.deleteAccount(address, function blockchainDeleteAccountCb(err, result) {
                    if (err) return callback(err);
                    return callback(null, result);
                });
            } else {
                return callback(new ProcessingError(`Blockchain not active: ${bcConfig.name}`, null, 'WF_API_NOT_AVAILABLE'));
            }
        }
    });
}

// PRIVATE MODULE FUNCTIONS //
// PRIVATE BLOCKCHAIN CONFIGURATION FUNCTIONS //
/**
 * Parses the base elements of the configuration before processing the configuration of each blockchain
 * @private
 * @param {object} bcConfigData the blockchains configuration object read from file
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
            bcConfigData.blockchains.forEach(bcConfig => {
                bcConfig._enabled = enableBlockchain(bcConfig);
            });
            return true;
        }
    }
    return false;
}

/**
 * Validates the blockchain configuration against the blockchain configuration schema
 * @private
 * @param {object} bcConfigData the blockchains configuration object to be validated
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
 * @param {object} bcConfig the configuration of a specific blockchain
 * @returns {boolean} true if blockchain could be activated and module could be loaded, else false
 */
function enableBlockchain(bcConfig) {
    // Check if blockchain is set to active
    if (!bcConfig.active) return false;

    // Try loading the module to assure it exists
    try {
        bcConfig._moduleImpl = require(BCMODULEDIR + bcConfig.module);
    } catch(err) {
        log.warn(MODULELOG, `Module ${bcConfig.module} cannot be loaded: ${err.message}`);
        return false;
    }
    // Blockchain enabled
    return true;
}

// PRIVATE MESSAGE CONFIRMATION FUNCTIONS //
/**
 * Initialise Whiteflag message transaction confirmation
 * @private
 */
function initConfirmMessages() {
    // Put messages on the confirmation queue
    wfRxEvent.on('messageProcessed', confirmMessage);
    wfTxEvent.on('messageProcessed', confirmMessage);

    // Clear queue from messages of unenabled blockchains
    wfState.getQueue('blockDepths', function blockchainGetQueueCb(err, confirmationQueue) {
        if (err) return log.error(MODULELOG, err.message);

        // Cycle through blockchains
        _blockchainsConfig.forEach(bcConfig => {
            if (!bcConfig._enabled) {
                // Run through queue to remove messages of unenabled blockchain
                confirmationQueue.forEach(message => {
                    if (message.blockchain === bcConfig.name) {
                        removeMessageConfirmation(message);
                    }
                });
            }
        });
    });
    // Update message confirmation on queue
    setInterval(checkConfirmations, _confirmationInterval);

    // Log message confirmation start
    log.info(MODULELOG, `Scheduled message confirmation at ${_confirmationInterval} ms intervals`);
    log.info(MODULELOG, `Messages are traced until a block depth of ${_confirmationBlockDepth}`);
}

/**
 * Put incoming message on the confirmation queue
 * @private
 * @param {object} wfMessage the incoming Whiteflag message
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
 * @param {object} message the message data on the confirmation queue
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
 * @param {object} message the message data on the confirmation queue
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
        // Double check block number with data from blockchain
        const bcConfig = _blockchainsConfig.find(bcConfig => bcConfig.name === message.blockchain);
        if (!bcConfig._enabled) return;
        bcConfig._moduleImpl.getTransaction(message.transactionHash, function blockchainTransactionConfirmCb(err, wfMessage) {
            if (err) return log.error(MODULELOG, err.message);

            // Check known block number against actual block number
            if (message.blockNumber !== wfMessage.MetaHeader.blockNumber) {
                message.blockNumber = wfMessage.MetaHeader.blockNumber;
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
 * @param {object} message the message data on the confirmation queue
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
 * @param {function} callback function to be called upon completion
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
