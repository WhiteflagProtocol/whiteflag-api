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
    init: initBlockchains,
    scanBlocks,
    sendMessage,
    getMessage,
    requestSignature,
    verifySignature,
    getBinaryAddress,
    transferFunds,
    createAccount,
    updateAccount,
    deleteAccount
};

/* Type defintitions */
/**
 * @typedef {Object} wfAccount A Whiteflag account object
 * @property {string} address the address as encoded for that specific blokchain
 * @property {string} publicKey the hexedecimal encoded public key
 * @property {string} privateKey the hexedecimal encoded private key
 * @property {number} transactionCount the number of transaction sent by the account
 * @property {number} balance the current balance of the account
 */

/**
 * @typedef {Object} wfTransfer A blockchain value transfer
 * @property {string} fromAddress the address of the account to send tokens from
 * @property {string} toAddress the address to send tokens to
 * @property {number} value tha value or number of tokens to be sent
 */

/* Node.js core and external modules */
const fs = require('fs');
const toml = require('toml');
const jsonValidate = require('jsonschema').validate;

/* Common internal functions and classes */
const log = require('./_common/logger');
const arr = require('./_common/arrays');
const { type } = require('./protocol/_common/messages');
const { hexToBuffer } = require('./_common/encoding');
const { ProcessingError,
        ProtocolError } = require('./_common/errors');

/* Whiteflag modules */
const wfState = require('./protocol/state');
const wfDatastores = require('./datastores');
const wfRxEvent = require('./protocol/events').rxEvent;
const wfTxEvent = require('./protocol/events').txEvent;

/* Module constants */
const MODULELOG = 'blockchains';
const WFCONFDIR = process.env.WFCONFDIR || './config';
const BCCONFFILE = WFCONFDIR + '/blockchains.toml';
const BCMODULEDIR = './blockchains/';
const MAXBLOCKSCAN = 100;
const bcConfigSchema = JSON.parse(fs.readFileSync('./lib/blockchains/_static/blockchains.config.schema.json'));

/* Module variables */
let _blockchains = [];
let _bcConfig = [];
let _confirmMessages = false;
let _confirmInterval = 10000;
let _confirmBlockDepth = 8;
let _confirmEachBlock = false;
let _confirmDoubleCheck = false;

/* MAIN MODULE FUNCTIONS */
/**
 * Initialises configured blockchains
 * @function initBlockchains
 * @alias module:lib/blockchains.init
 * @param {blockhainsInitCb} callback function called on completion
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
    _blockchains = arr.pluck(_bcConfig, 'name');
    log.debug(MODULELOG, `Configured blockchains in ${BCCONFFILE}: ` + JSON.stringify(_blockchains));

    // Initialise each enabled blockchain
    _bcConfig.forEach(bcInstance => {
        if (bcInstance._enabled) {
            /**
             * @callback bcInitCb
             * @param {Error} err any error
             * @param {string} blockchain the nemae of the blockchain
             */
            bcInstance._module.init(bcInstance, function bcInitCb(err, blockchain) {
                if (err) return log.error(MODULELOG, `Could not intialise ${blockchain}: ${err.message}`);
                return log.info(MODULELOG, `Initialised blockchain: ${blockchain}`);
            });
        }
    });
    initConfirmMessages(bcConfigData.confirmation);
    return callback(null, _blockchains);
}

/**
 * Scans a number of blocks for Whiteflag messages
 * @function scanBlocks
 * @alias module:lib/blockchains.scanBlocks
 * @param {number} firstBlock the starting block
 * @param {number} lastBlock the ending block
 * @param {string} blockchain the blockchain to scan
 * @param {bcScanBlocksCb} callback function called on completion
 */
function scanBlocks(firstBlock, lastBlock, blockchain, callback) {
    // Check parameters
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    if (!Number.isInteger(firstBlock) || !Number.isInteger(lastBlock)) {
        return callback(new ProcessingError('Invalid block numbers', null, 'WF_API_BAD_REQUEST'));
    }
    if (firstBlock < 1) {
        return callback(new ProcessingError('Starting block cannot be before first block', null, 'WF_API_BAD_REQUEST'));
    }
    if (firstBlock > lastBlock) {
        return callback(new ProcessingError('Starting block cannot be after ending block', null, 'WF_API_BAD_REQUEST'));
    }
    if ((lastBlock - firstBlock) > MAXBLOCKSCAN) {
        return callback(new ProcessingError(`Cannot scan more than ${MAXBLOCKSCAN} blocks at a time', null, 'WF_API_BAD_REQUEST`));
    }
    // Request keys from the correct blockchain
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            /**
             * @callback bcScanBlocksCb
             * @param {Error} err any error
             * @param {WfMessage[]} wfMessages an array of found Whiteflag messages
             */
            bcInstance._module.scanBlocks(firstBlock, lastBlock, callback);
        }
    });
}

/**
 * Sends an encoded message to the blockchain defined in the metaheader
 * @function sendMessage
 * @alias module:lib/blockchains.sendMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be sent on the blockchain
 * @param {bcSendTransactionCb} callback function called on completion
 */
function sendMessage(wfMessage, callback) {
    // Check message parameters
    if (!Object.hasOwn(wfMessage, 'MetaHeader')) {
        return callback(new ProtocolError('Missing metaheader', null, 'WF_METAHEADER_ERROR'), wfMessage);
    }
    let { MetaHeader: meta } = wfMessage;

    // Check blockchain
    if (!meta.blockchain) {
        meta.transmissionSuccess = false;
        return callback(new ProtocolError('Blockchain not specified in message metaheader', null, 'WF_METAHEADER_ERROR'), wfMessage);
    }
    if (!_blockchains.includes(meta.blockchain)) {
        meta.transmissionSuccess = false;
        return callback(new ProcessingError(`Unsupported blockchain: ${meta.blockchain}`, null, 'WF_API_NOT_IMPLEMENTED'), wfMessage);
    }
    // Check other required data
    if (!meta.originatorAddress) {
        return callback(new ProtocolError('No address for blockchain account specified in metaheader', null, 'WF_METAHEADER_ERROR'));
    }
    if (!meta.encodedMessage) {
        return callback(new ProtocolError('No encoded message in metaheader', null, 'WF_METAHEADER_ERROR'));
    }
    // Request correct blockchain to make the transfer
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === meta.blockchain) {
            if (!bcInstance._enabled) {
                meta.transmissionSuccess = false;
                return callback(new ProcessingError(`Blockchain not active: ${bcInstance.name}`, null, 'WF_API_NOT_AVAILABLE'), wfMessage);
            }
            /**
             * @callback bcSendTransactionCb
             * @param {Error} err any error
             * @param {string} transactionHash the transaction hash of the transaction
             * @param {number} blockNumber the block number of the transaction
             */
            bcInstance._module.sendMessage(wfMessage, function bcSendMessageCb(err, transactionHash, blockNumber) {
                if (err) {
                    meta.transmissionSuccess = false;
                    return callback(err, wfMessage);
                }
                meta.transmissionSuccess = true;
                if (transactionHash) meta.transactionHash = transactionHash;
                if (blockNumber) meta.blockNumber = blockNumber;
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
 * @param {bcGetMessageCb} callback function called on completion
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
            bcInstance._module.getMessage(wfQuery, callback);
        }
    });
}

/**
 * Requests a Whiteflag signature for a specific blockchain address
 * @function requestSignature
 * @alias module:lib/blockchains.requestSignature
 * @param {Object} signPayload the JWS payload for the Whiteflag signature
 * @param {string} blockchain the blockchain for which the signature is requested
 * @param {authRequestSignatureCb} callback function called on completion
 */
function requestSignature(signPayload, blockchain, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    // Request signature from the correct blockchain
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._module.requestSignature(signPayload, callback);
        }
    });
}

/**
 * Requests a Whiteflag signature for a specific blockchain address
 * @function verifySignature
 * @alias module:lib/blockchains.verifySignature
 * @param {Object} wfSignature the Whiteflag authentication signature
 * @param {string} signAddress the blockchain address in the signature
 * @param {string} orgPubkey the public key to verify the signature against
 * @param {string} blockchain the blockchain for which the signature is verified
 * @param {authVerifySignatureCb} callback function called on completion
 */
function verifySignature(wfSignature, signAddress, orgPubkey, blockchain, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    // Request signature from the correct blockchain
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._module.verifySignature(wfSignature, signAddress, orgPubkey, callback);
        }
    });
}

/**
 * Requests a blockchain address in binary encoded form
 * @function getBinaryAddress
 * @alias module:lib/blockchains.requestgetBinaryAddressKeys
 * @param {string} address the blockchain address
 * @param {string} blockchain the blockchain for which the binary encoded address is requested
 * @param {bcSendTransactionCb} callback function called on completion
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
    /**
     * @callback bcBinaryAddressCb
     * @param {Error} err any error
     * @param {Buffer} address the binary blockchain address
     */
    _bcConfig.forEach(bcInstance => {
        // Get configuration and call init function for this blockchain
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._module.getBinaryAddress(address, callback);
        }
    });
}

/**
 * @description Transfers value from one blockchain address to an other address
 * @function transferFunds
 * @alias module:lib/blockchains.transferFunds
 * @param {wfTransfer} transfer the object with the transaction details to transfer value
 * @param {string} address the address of the account from which to make the transfer from
 * @param {string} blockchain the blockchain on which the value must be transdered
 * @param {bcSendTransactionCb} callback function called on completion
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
    if (isNaN(Number(transfer.value))) transferErrors.push('Transfer value is not a valid number');
    if (transferErrors.length > 0) return callback(new ProcessingError('Invalid transfer request', transferErrors, 'WF_API_BAD_REQUEST'));

    // Request correct blockchain to make the transfer
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._module.transferFunds(transfer, callback);
        }
    });
}

/**
 * Creates blockchain account
 * @function createAccount
 * @alias module:lib/blockchains.createAccount
 * @param {string} blockchain the blockchain for which account needs to be created
 * @param {string} secret hexadecimal encoded blockchain dependent secret (e.g. private key, wif or seed)
 * @param {bcAccountCb} callback function called on completion
 */
function createAccount(blockchain, secret = null, callback) {
    // Check blockchain
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    // Request correct blockchain to create account
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    /**
     * Callback for blockchain account functions
     * @callback bcAccountCb
     * @param {Error} err any error
     * @param {wfAccount} result the result of the account action
     */
    _bcConfig.forEach(bcInstance => {
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._module.createAccount(secret, callback);
        }
    });
    secret = null;
}

/**
 * Updates blockchain account
 * @function updateAccount
 * @alias module:lib/blockchains.updateAccount
 * @param {wfAccount} account the blockchain account to be updated
 * @param {string} address the address of the account to be updated
 * @param {string} blockchain the blockchain for which the account needs to be updated
 * @param {bcAccountCb} callback function called on completion
 */
function updateAccount(account, address, blockchain, callback) {
    // Check blockchain and address
    if (!blockchain || !_blockchains.includes(blockchain)) {
        return reportUnsupported(blockchain, callback);
    }
    if (!address) {
        return callback(new ProcessingError('Missing blockchain address', null, 'WF_API_BAD_REQUEST'));
    }
    // Check request data
    let accountErrors = [];
    if (!account?.address) account.address = address;
    if (account.address !== address) accountErrors.push('Account addresses does not match blockchain account');
    if (accountErrors.length > 0) return callback(new ProcessingError('Invalid account update request', accountErrors, 'WF_API_BAD_REQUEST'));

    // Request correct blockchain to update account
    if (_bcConfig.length <= 0) return reportNoBlockchain(callback);
    _bcConfig.forEach(bcInstance => {
        if (bcInstance.name === blockchain) {
            if (!bcInstance._enabled) return reportNotActive(bcInstance.name, callback);
            bcInstance._module.updateAccount(account, callback);
        }
    });
}

/**
 * Deletes blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains.deleteAccount
 * @param {string} address the blockchain account address
 * @param {string} blockchain the blockchain for which the account needs to be deleted
 * @param {bcAccountCb} callback function called on completion
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
            bcInstance._module.deleteAccount(address, callback);
        }
    });
}

/* PRIVATE MODULE FUNCTIONS */
/* PRIVATE ERROR FUNCTIONS */
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

/* PRIVATE BLOCKCHAIN CONFIGURATION FUNCTIONS */
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
        let bcConfigErrors = validateConfig(bcConfigData);
        if (bcConfigErrors?.length > 0) {
            log.error(MODULELOG, 'Configuration errors: ' + JSON.stringify(bcConfigErrors));
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
        return [].concat(arr.pluck(jsonValidate(bcConfigData, bcConfigSchema).errors, 'stack'));
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
        bcInstance._module = require(BCMODULEDIR + bcInstance.module);
    } catch(err) {
        log.error(MODULELOG, `Module ${bcInstance.module} cannot be loaded: ${err.message}`);
        return false;
    }
    // Blockchain enabled
    return true;
}

/* PRIVATE MESSAGE CONFIRMATION FUNCTIONS */
/**
 * Initialise Whiteflag message transaction confirmation
 * @private
 * @param {Object} confirmation the confirmation paramters from the blockchain configuration
 */
function initConfirmMessages(confirmation) {
    // Clear queue from messages of disabled blockchains
    wfState.getQueue('blockDepths', function blockchainGetQueueCb(err, confirmQueue) {
        if (err) return log.error(MODULELOG, err.message);

        // Cycle through messages that persisted on queue
        confirmQueue.forEach(queuedMsg => {
            let knownBlockchain = false;

            // Check of blockchain exists and is active
            _bcConfig.forEach(bcInstance => {
                if (queuedMsg.blockchain === bcInstance.name) {
                    knownBlockchain = true;
                    if (!bcInstance._enabled) {
                        log.info(MODULELOG, `Removing message from confirmation queue because blockchain ${queuedMsg.blockchain} is not enabled: ${queuedMsg.transactionHash}`);
                        return removeMessageConfirmation(queuedMsg);
                    }
                }
            });
            if (!knownBlockchain) {
                log.info(MODULELOG, `Removing message from confirmation queue because blockchain ${queuedMsg.blockchain} is not configured: ${queuedMsg.transactionHash}`);
                removeMessageConfirmation(queuedMsg);
            }
        });
    });
    // Check if confirmation is enabled
    if (confirmation?.enabled) {
        _confirmMessages = confirmation.enabled;
    } else {
        return log.info(MODULELOG, 'Messages are not tracked for confirmation');
    }
    // Get confirmation parameters from configuration
    if (confirmation.maxBlockDepth) _confirmBlockDepth = confirmation.maxBlockDepth;
    if (confirmation.interval) _confirmInterval = confirmation.interval;
    if (confirmation.updateEachBlock) _confirmEachBlock = confirmation.updateEachBlock;
    if (confirmation.doubleCheck) _confirmDoubleCheck = confirmation.doubleCheck;

    // Put messages on the confirmation queue
    wfRxEvent.on('messageProcessed', confirmMessage);
    wfTxEvent.on('messageProcessed', confirmMessage);

    // Update messages on confirmation queue at set configured interval
    setInterval(checkConfirmations, _confirmInterval);
    log.info(MODULELOG, `Messages are tracked for confirmation at ${_confirmInterval} ms intervals until a block depth of ${_confirmBlockDepth}`);
}

/**
 * Put incoming message on the confirmation queue
 * @private
 * @param {wfMessage} wfMessage the incoming Whiteflag message
 */
function confirmMessage(wfMessage) {
    let { MetaHeader: meta } = wfMessage;

    // Message type for logging
    let msgTypeStr = `${type(wfMessage)} message`;
    if (meta.transceiveDirection === 'TX') msgTypeStr = `sent ${msgTypeStr}`;
    if (meta.transceiveDirection === 'RX') msgTypeStr = `received ${msgTypeStr}`;

    // Check for block number
    if (!meta.blockNumber) {
        return log.debug(MODULELOG, `Cannot put ${msgTypeStr} on confirmation queue if not yet in a block: ${meta.transactionHash}`);
    }
    // Prepare message for queue
    const queuedMsg = {
        transactionHash: meta.transactionHash,
        blockchain: meta.blockchain,
        blockNumber: meta.blockNumber,
        blockDepth: 0,
        confirmed: false
    };
    // Put on confirmation queue if blockchain is active
    _bcConfig.forEach(bcInstance => {
        if (bcInstance._enabled) {
            if (queuedMsg.blockchain === bcInstance.name) {
                wfState.upsertQueueData('blockDepths', 'transactionHash', queuedMsg);
                log.trace(MODULELOG, `Put ${msgTypeStr} on confirmation queue: ${queuedMsg.transactionHash}`);
            }
        }
    });
}

/**
 * Removes the message from the confirmation queue
 * @private
 * @param {Object} queuedMsg the message data on the confirmation queue
 */
function removeMessageConfirmation(queuedMsg) {
    wfState.removeQueueData('blockDepths', 'transactionHash', queuedMsg.transactionHash);
    if (queuedMsg.confirmed === true) log.debug(MODULELOG, `Removed confirmed message from confirmation queue: ${queuedMsg.transactionHash}`);
    if (queuedMsg.confirmed === false) log.warn(MODULELOG, `Removed unconfirmed message from confirmation queue: ${queuedMsg.transactionHash}`);
}

/**
 * Checks if block depth has changed for each message on the confirmation queue
 * @private
 */
function checkConfirmations() {
    wfState.getQueue('blockDepths', function blockchainGetQueueCb(err, confirmQueue) {
        if (err) return log.error(MODULELOG, err.message);
        confirmQueue.forEach(queuedMsg => checkMessageConfirmation(queuedMsg));
    });
}

/**
 * Checks the message conformation against current block height
 * @private
 * @param {Object} queuedMsg the message data on the confirmation queue
 */
function checkMessageConfirmation(queuedMsg) {
    getBlockHeight(queuedMsg.blockchain, function blockchainGetHeightCb(err, blockHeight) {
        if (err) return log.error(MODULELOG, err.message);

        // Check new block depth
        let blockDepth = blockHeight - queuedMsg.blockNumber;
        if (blockDepth < 0) blockDepth = 0;
        if (blockDepth === queuedMsg.blockDepth) return;
        queuedMsg.blockDepth = blockDepth;

        // Check if block depth required for confirmation has been reached
        if (queuedMsg.blockDepth < _confirmBlockDepth) {
            wfState.upsertQueueData('blockDepths', 'transactionHash', queuedMsg);
            if (_confirmEachBlock) updateMessageConfirmation(queuedMsg);
            return;
        }
        // Confirm message
        if (!_confirmDoubleCheck) {
            queuedMsg.confirmed = true;
            log.debug(MODULELOG, `Message is now ${queuedMsg.blockDepth} blocks deep and confirmed: ${queuedMsg.transactionHash}`);
            return updateMessageConfirmation(queuedMsg);
        }
        // Double check block number with message duplicate from blockchain
        const bcInstance = _bcConfig.find(bcInstance => bcInstance.name === queuedMsg.blockchain);
        if (!bcInstance._enabled) {
            return log.warn(MODULELOG, `Cannot check block depth for disabled blockchain: ${queuedMsg.blockchain}`);
        }
        let wfQuery = {};
        wfQuery['MetaHeader.transactionHash'] = queuedMsg.transactionHash;
        bcInstance._module.getMessage(wfQuery, function blockchainTransactionConfirmCb(err, wfMessage) {
            if (err) return log.error(MODULELOG, err.message);

            // Check known block number against actual block number
            if (queuedMsg.blockNumber !== wfMessage.MetaHeader.blockNumber) {
                queuedMsg.blockNumber = wfMessage.MetaHeader.blockNumber;
                return wfState.upsertQueueData('blockDepths', 'transactionHash', queuedMsg);
            }
            // Message is confirmed
            queuedMsg.confirmed = true;
            log.debug(MODULELOG, `Message is now ${queuedMsg.blockDepth} blocks deep and confirmed: ${queuedMsg.transactionHash}`);
            updateMessageConfirmation(queuedMsg);
        });
    });
}

/**
 * Updates the Whiteflag message confirmation data in the datastore
 * @private
 * @param {Object} queuedMsg the message data on the confirmation queue
 * @emits module:lib/protocol/events.rxEvent:messageUpdated
 * @emits module:lib/protocol/events.txEvent:messageUpdated
 */
function updateMessageConfirmation(queuedMsg) {
    // Construct query and retrieve message grom database
    let wfQuery = {};
    wfQuery['MetaHeader.transactionHash'] = queuedMsg.transactionHash;
    wfQuery['MetaHeader.blockchain'] = queuedMsg.blockchain;
    wfDatastores.getMessages(wfQuery, function blockchainGetMessageDbCb(err, wfMessages, count) {
        if (err) return log.error(MODULELOG, err.message);

        // Remove from queue if message not exactly matches one message in primary datastore
        if (count !== 1 || wfMessages.length === 0) return removeMessageConfirmation(queuedMsg);

        // Update message
        const wfMessage = wfMessages[0];
        let { MetaHeader: meta } = wfMessage;
        if (meta.transactionHash === queuedMsg.transactionHash) {
            // Update meteaheader with block depth
            meta.blockDepth = queuedMsg.blockDepth;

            // When message is confirmed: update metaheader and remove from queue
            if (queuedMsg.confirmed) {
                meta.confirmed = queuedMsg.confirmed;
                removeMessageConfirmation(queuedMsg);
            }
            // Trigger message update action, e.g. datastore
            if (meta.transceiveDirection === 'RX') wfRxEvent.emit('messageUpdated', wfMessage);
            if (meta.transceiveDirection === 'TX') wfTxEvent.emit('messageUpdated', wfMessage);
        }
    });
}

/**
 * Helper function to get current blockchain height from state
 * @private
 * @param {string} blockchain the name of the blockchain to het
 * @param {getBlockHeightCb} callback function called on completion
 * @typedef {number} highestBlock
 */
function getBlockHeight(blockchain, callback) {
    wfState.getBlockchainData(blockchain, function blockchainGetDataCb(err, blockchainSate) {
        if (!err && !blockchainSate) err = new Error(`Blockchain ${blockchain} does not exist in state`);
        if (err) return callback(err);
        if (!blockchainSate.status?.highestBlock) {
            return callback(new Error(`Blockchain state of ${blockchain} does not contain highest block`));
        }
        /**
         * @callback getBlockHeightCb
         * @param {Error} err any error
         * @param {number} highestBlock the current heighest block
         */
        return callback(null, blockchainSate.status.highestBlock);
    });
}
