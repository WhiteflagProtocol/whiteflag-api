'use strict';
/**
 * @module lib/blockchains/ethereum
 * @summary Whiteflag API Ethereum blockchain implementation
 * @description Module to use Ethereum as underlying blockchain for Whiteflag
 * @todo The Ethereum module has not been maintained and needs evaluation
 * @tutorial modules
 * @tutorial ethereum
 */
module.exports = {
    init: initEthereum,
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

// Node.js core and external modules //
const { pubToAddress }  = require('ethereumjs-util');

// Common internal functions and classes //
const log = require('../_common/logger');
const { ignore } = require('../_common/processing');
const { ProcessingError,
        ProtocolError } = require('../_common/errors');
const { hexToBuffer,
        bufferToHex } = require('../_common/encoding');
const { withHexPrefix,
        noHexPrefix,
        noAddressHexPrefix } = require('../_common/format');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Common blockchain functions //
const { getEmptyState } = require('./_common/state');
const { getPrivateKeyId } = require('./_common/keys');
const { createJWS,
        verifyJWS } = require('./_common/crypto');

// Ethereum sub-modules //
const ethRpc = require('./ethereum/rpc');
const ethAccounts = require('./ethereum/accounts');
const ethListener = require('./ethereum/listener');
const ethTransactions = require('./ethereum/transactions');

// Module constants //
const MODULELOG = 'ethereum';
const SIGNALGORITHM = 'ES256';
const SIGNKEYTYPE = 'secp256k1';

// Module variables //
let _ethChain;
let _ethState = {};
let _ethApi;
let _transactionValue = '0';

/**
 * Initialises the Ethereum blockchain
 * @function initEthereum
 * @alias module:lib/blockchains/ethereum.init
 * @param {Object} ethConfig the blockchain configuration
 * @param {bcInitCb} callback function called after intitialising Ethereum
 */
function initEthereum(ethConfig, callback) {
    log.trace(MODULELOG, 'Initialising the Ethereum blockchain');
    _ethChain = ethConfig.name;

    // Get Ethereum blockchain state
    wfState.getBlockchainData(_ethChain, function blockchainsGetStateDb(err, ethState) {
        if (err) return callback(err, _ethChain);
        if (!ethState) {
            log.info(MODULELOG, `Creating new ${_ethChain} entry in internal state`);
            ethState = getEmptyState();
            wfState.updateBlockchainData(_ethChain, ethState);
        }
        _ethState = ethState;

        // Initialise sub-modules
        ethAccounts.init(ethConfig, _ethState)
        .then(() => ethRpc.init(ethConfig, _ethState))
        .then(ethApi => { _ethApi = ethApi })
        .then(() => ethTransactions.init(ethConfig, _ethState, _ethApi))
        .then(() => ethListener.init(ethConfig, _ethState))
        .then(() => {
            wfState.updateBlockchainData(_ethChain, _ethState);
            return callback(null, _ethChain);
        })
        .catch(err => callback(err, _ethChain));
    });
}

/**
 * Scans a number of blocks for Whiteflag messages
 * @function scanBlocks
 * @alias module:lib/ethereum.scanBlocks
 * @param {number} firstBlock the starting block
 * @param {number} lastBlock the ending block
 * @param {bcScanBlocksCb} callback function called on completion
 */
function scanBlocks(firstBlock, lastBlock, callback) {
    log.debug(MODULELOG, `Scanning block ${firstBlock} to ${lastBlock}`)
    ethListener.scanBlocks(firstBlock, lastBlock)
    .then(wfMessages => {
        return callback(null, wfMessages);
    })
    .catch(err => {
        return callback(err);
    });
}

/**
 * Sends an encoded message on the Ethereum blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/ethereum.sendMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be sent on Ethereum
 * @param {bcSendTransactionCb} callback function called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    ethAccounts.get(wfMessage.MetaHeader.originatorAddress)
    .then(account => {
        const toAddress = account.address;
        const encodedMessage = wfMessage.MetaHeader.encodedMessage;
        return ethTransactions.send(account, toAddress, _transactionValue, encodedMessage);
    })
    .then((transactionHash, blockNumber) => {
        return callback(null, transactionHash, blockNumber);
    })
    .catch(err => {
        log.error(MODULELOG, `Error sending Whiteflag message: ${err.message}`);
        callback(err);
    });
}

/**
 * Performs a simple query to find a message on Ethereum by transaction hash
 * @function getMessage
 * @alias module:lib/blockchains/ethereum.getMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {bcGetMessageCb} callback function called after Whiteflag message lookup
 */
function getMessage(wfQuery, callback) {
    const transactionHash = wfQuery['MetaHeader.transactionHash'];
    ethTransactions.get(transactionHash)
    .then(transaction => {
        return ethTransactions.extractMessage(transaction);
    })
    .then(wfMessage => callback(null, wfMessage))
    .catch(err => {
        if (err instanceof ProcessingError) {
            log.debug(MODULELOG, `No Whiteflag message with transaction hash ${transactionHash} found: ${err.message}`);
        } else {
            log.error(MODULELOG, `Error retrieving Whiteflag message with transaction hash ${transactionHash}: ${err.message}`);
        }
        return callback(err, null);
    });
}

/**
 * Requests a Whiteflag signature for the specified Ethereum address
 * @todo Refactor to use with new JWS functions and native blockchain signature
 * @function requestSignature
 * @alias module:lib/blockchains/ethereum.requestSignature
 * @param {wfSignPayload} wfSignPayload the JWS payload for the Whiteflag signature
 * @param {authRequestSignatureCb} callback function called on completion
 */
function requestSignature(wfSignPayload, callback) {
    log.trace(MODULELOG, `Generating Whiteflag authentication signature: ${JSON.stringify(wfSignPayload)}`);

    // Get Ethereum account and address
    ethAccounts.get(wfSignPayload.addr)
    .then(account => {
        // Get ensure correct address and get private key
        wfSignPayload.addr = noAddressHexPrefix(account.address);
        const privateKeyId = getPrivateKeyId(_ethChain, account.address);
        wfState.getKey('blockchainKeys', privateKeyId, function ethGetKeyCb(err, ethPrivateKey) {
            if (err) return callback(err);
            if (!ethPrivateKey) {
                return callback(new ProcessingError(`No private key available for address ${account.address}`, null, 'WF_API_PROCESSING_ERROR'));
            }
            // Create signature
            let wfSignature;
            try {
                wfSignature = createJWS(wfSignPayload, noHexPrefix(ethPrivateKey), SIGNKEYTYPE, SIGNALGORITHM);
            } catch(err) {
                log.error(MODULELOG, `Could not create Whiteflag authentication signature for address ${account.address}: ${err.message}`);
                return callback(err);
            }
            return callback(null, wfSignature);
        });
    })
    .catch(err => callback(err));
}

/**
 * Verifies a Whiteflag signature for the specified Ethereum public key
 * @todo Refactor to use with new JWS functions and native blockchain signature
 * @function verifySignature
 * @alias module:lib/blockchains/ethereum.verifySignature
 * @param {wfSignature} wfSignature the Whiteflag authentication signature
 * @param {string} ethAddress the address of the Whiteflag signature
 * @param {string} ethPublicKey the Ethereum public key to verify against
 * @param {authVerifySignatureCb} callback function called on completion
 */
function verifySignature(wfSignature, ethAddress, ethPublicKey, callback) {
    log.trace(MODULELOG, `Verifying Whiteflag authentication signature against public key ${ethPublicKey}: ${JSON.stringify(wfSignature)}`);

    // Verify the signature
    let result;
    try {
        result = verifyJWS(wfSignature, ethPublicKey, SIGNKEYTYPE);
    } catch(err) {
        if (err instanceof ProtocolError) {
            return callback(new ProtocolError(`Invalid Whiteflag authentication signature`, err.message, 'WF_SIGN_ERROR'));
        }
        log.error(MODULELOG, `Could not verify Whiteflag authentication signature: ${err.message}`);
        return callback(err);
    }
    //TODO: Check public key and address
    const publicKeyBuffer = hexToBuffer(ethPublicKey);
    const address = noAddressHexPrefix(bufferToHex(pubToAddress(publicKeyBuffer, true)));
    ignore(ethAddress, address);

    return callback(null, result);
}

/**
 * Returns an Ethereum address in binary encoded form
 * @function getBinaryAddress
 * @alias module:lib/blockchains/ethereum.getBinaryAddress
 * @param {string} ethAddress the blockchain address
 * @param {bcBinaryAddressCb} callback function called on completion
 */
function getBinaryAddress(ethAddress, callback) {
    if (_ethApi.utils.isAddress(withHexPrefix(ethAddress))) {
        return callback(null, hexToBuffer(noAddressHexPrefix(ethAddress)));
    }
    return callback(new ProcessingError(`Invalid ${_ethChain} address: ${ethAddress}`, null, 'WF_API_BAD_REQUEST'));
}

/**
 * Transfers ether from one Ethereum address to an other address
 * @function transferFunds
 * @alias module:lib/blockchains/ethereum.transferFunds
 * @param {wfTransfer} transfer the object with the transaction details to transfer funds
 * @param {bcSendTransactionCb} callback function called on completion
 */
function transferFunds(transfer, callback) {
    log.trace(MODULELOG, `Transferring funds: ${JSON.stringify(transfer)}`);
    ethAccounts.get(transfer.fromAddress)
    .then(account => {
        return ethTransactions.send(account, transfer.toAddress, transfer.value, '');
    })
    .then((transactionHash, blockNumber) => callback(null, transactionHash, blockNumber))
    .catch(err => {
        log.error(MODULELOG, `Error transferring funds: ${err.message}`);
        return callback(err);
    });
}

/**
 * Creates a new Ethereum blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/ethereum.createAccount
 * @param {string} [ethPrivateKey] hexadecimal string with private key (without 0x prefix)
 * @param {bcAccountCb} callback function called on completion
 */
 function createAccount(ethPrivateKey, callback) {
    ethAccounts.create(ethPrivateKey)
    .then(account => {
        log.info(MODULELOG, `Created ${_ethChain} account: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}

 /**
 * Updates Ethereum blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/ethereum.updateAccount
 * @param {wfAccount} account the account information including address to be updated
 * @param {bcAccountCb} callback function called on completion
 */
function updateAccount(account, callback) {
    ethAccounts.update(account)
    .then(updatedAccount => {
        log.info(MODULELOG, `Updated ${_ethChain} account: ${account.address}`);
        return callback(null, updatedAccount);
    })
    .catch(err => callback(err));
}

/**
 * Deletes Ethereum blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/ethereum.deleteAccount
 * @param {string} ethAddress the address of the account to be deleted
 * @param {bcAccountCb} callback function called on completion
 */
function deleteAccount(ethAddress, callback) {
    ethAccounts.delete(ethAddress)
    .then(account => {
        log.info(MODULELOG, `Deleted ${_ethChain} account: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}
