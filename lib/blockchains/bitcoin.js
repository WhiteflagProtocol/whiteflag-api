'use strict';
/**
 * @module lib/blockchains/bitcoin
 * @summary Whiteflag API Bitcoin blockchain implementation
 * @description Module to use Bitcoin as underlying blockchain for Whiteflag
 * @TODO Add signature functions for authentication
 */
module.exports = {
    // Bitcoin blockchain functionsns
    init: initBitcoin,
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
const bitcoin = require('bitcoinjs-lib');
const bs58 = require('bs58');

// Whiteflag common functions and classes //
const log = require('../common/logger');
const { ProcessingError } = require('../common/errors');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Bitcoin sub-modules //
const bcRpc = require('./bitcoin/rpc');
const bcUtxo = require('./bitcoin/utxo');
const bcAccounts = require('./bitcoin/accounts');
const bcListener = require('./bitcoin/listener');
const bcTransactions = require('./bitcoin/transactions');

// Module variables //
let _blockchainName = 'bitcoin';
let _bcState = {};
let _testnet = true;

/**
 * Initialises the Bitcoin blockchain
 * @function initBitcoin
 * @alias module:lib/blockchains/bitcoin.init
 * @param {Object} bcConfig the Bitcoin blockchain configuration
 * @param {blockchainInitCb} callback function to be called after intitialising Bitcoin
 */
function initBitcoin(bcConfig, callback) {
    log.trace(_blockchainName, 'Initialising the Bitcoin blockchain...');

    // Preserve the name of the blockchain
    _blockchainName = bcConfig.name;

    // Get Bitcoin blockchain state
    wfState.getBlockchainData(_blockchainName, function blockchainsGetStateDb(err, bcState) {
        if (err) return callback(err, _blockchainName);
        if (!bcState) {
            bcState = {
                parameters: {},
                status: {},
                accounts: []
            };
        }
        // Preserve state for module
        _bcState = bcState;

        // Determine network parameters
        if (bcConfig.testnet) _testnet = bcConfig.testnet;
        if (_testnet) {
            _bcState.parameters.network = bitcoin.networks.testnet;
            log.info(_blockchainName, 'Configured to use the Bitcoin testnet');
        } else {
            _bcState.parameters.network = bitcoin.networks.bitcoin;
            log.info(_blockchainName, 'Configured to use the Bitcoin mainnet');
        }
        // Initialise sub-modules
        bcRpc.init(bcConfig, _bcState)
        .then(() => bcTransactions.init(bcConfig, _bcState))
        .then(() => bcListener.init(bcConfig, _bcState))
        .then(() => bcUtxo.init(bcConfig, _bcState))
        .then(() => bcAccounts.init(bcConfig, _bcState))
        .then(() => wfState.updateBlockchainData(_blockchainName, _bcState))
        .then(() => callback(null, _blockchainName))
        .catch(initErr => callback(initErr, _blockchainName));
    });
}

/**
 * Sends an encoded message on the Bitcoin blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/bitcoin.sendMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be sent on Bitcoin
 * @param {blockchainSendTransactionCb} callback function to be called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    bcAccounts.check(wfMessage.MetaHeader.originatorAddress)
    .then(account => {
        const toAddress = account.address;
        const encodedMessage = Buffer.from(wfMessage.MetaHeader.encodedMessage, 'hex');
        return bcTransactions.send(account, toAddress, 0, encodedMessage);
    })
    .then(txHash => callback(null, txHash))
    .catch(err => {
        log.error(_blockchainName, `Error sending Whiteflag message: ${err.toString()}`);
        return callback(err);
    });
}

/**
 * Performs a simple query to find a message on Bitcoin by transaction hash
 * @function getMessage
 * @alias module:lib/blockchains/bitcoin.getMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {blockchainLookupMessageCb} callback function to be called after Whiteflag message lookup
 */
function getMessage(wfQuery, callback) {
    const transactionHash = wfQuery['MetaHeader.transactionHash'];
    bcTransactions.get(transactionHash)
    .then(transaction => {
        return bcTransactions.extractMessage(transaction);
    })
    .then(wfMessage => callback(null, wfMessage))
    .catch(err => {
        if (err instanceof ProcessingError) {
            log.debug(_blockchainName, `No Whiteflag message found: ${err.toString()}`);
        } else {
            log.error(_blockchainName, `Error looking up Whiteflag message: ${err.toString()}`);
        }
        return callback(err);
    });
}

/**
 * Requests a Whiteflag signature for a specific Bitcoin address
 * @function requestSignature
 * @alias module:lib/blockchains/bitcoin.requestSignature
 * @param {wfSignaturePayload} signPayload the JWS payload for the Whiteflag signature
 * @param {blockchainRequestSignatureCb} callback function to be called upon completion
 */
function requestSignature(signPayload, callback) {
    return callback(new ProcessingError('Whiteflag signatures not yet implemented for Bitcoin', null, 'WF_API_NOT_IMPLEMENTED'));
}

/**
 * Requests the Bitcoin address and correctly encoded pubic key of an originator
 * @function requestKeys
 * @alias module:lib/blockchains/bitcoin.requestKeys
 * @param {string} originatorPubKey the raw hex public key of the originator
 * @param {blockchainRequestKeysCb} callback function to be called upon completion
 */
function requestKeys(originatorPubKey, callback) {
    return callback(new ProcessingError('Key and adress conversions not yet implemented for Bitcoin', null, 'WF_API_NOT_IMPLEMENTED'));
}

/**
 * Returns a Bitcoin address in binary encoded form
 * @param {string} address the Bitcoin blockchain address
 * @param {blockchainBinaryAddressCb} callback function to be called upon completion
 */
function getBinaryAddress(address, callback) {
    const addressBuffer = bs58.decode(address);
    return callback(null, addressBuffer);
}

/**
 * Transfers bitcoin from one Bitcoin address to an other address
 * @function transferFunds
 * @alias module:lib/blockchains/bitcoin.transferFunds
 * @param {Object} transfer the transaction details for the funds transfer
 * @param {blockchainSendTransactionCb} callback function to be called upon completion
 */
function transferFunds(transfer, callback) {
    bcAccounts.check(transfer.fromAddress)
    .then(account => {
        const toAddress = transfer.toAddress;
        const amount = transfer.value;
        return bcTransactions.send(account, toAddress, amount, null, callback);
    })
    .then(txHash => callback(null, txHash))
    .catch(err => {
        log.error(_blockchainName, `Error transferring funds: ${err.toString()}`);
        return callback(err);
    });
}


/**
 * Creates a new Bitcoin blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/bitcoin.createAccount
 * @param {string} [privateKey] hexadecimal encoded private key
 * @param {blockchainCreateAccountCb} callback function to be called upon completion
 */
function createAccount(wif, callback) {
    bcAccounts.create(wif)
    .then(account => {
        log.info(_blockchainName, `Blockchain account created: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}

 /**
 * Updates Bitcoin blockchain account attributes
 * @function updateAccount
 * @param {Object} account the account information including address to be updated
 * @alias module:lib/blockchains/bitcoin.updateAccount
 * @param {blockchainUpdateAccountCb} callback function to be called upon completion
 */
function updateAccount(account, callback) {
    bcAccounts.update(account)
    .then(account => {
        log.debug(_blockchainName, `Blockchain account updated: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}

/**
 * Deletes Bitcoin blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/bitcoin.deleteAccount
 * @param {string} address the address of the account to be deleted
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function deleteAccount(address, callback) {
    bcAccounts.delete(address)
    .then(account => {
        log.info(_blockchainName, `Blockchain account deleted: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}

