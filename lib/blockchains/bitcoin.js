'use strict';
/**
 * @module lib/blockchains/bitcoin
 * @summary Whiteflag API Bitcoin blockchain implementation
 * @description Module to use Bitcoin as underlying blockchain for Whiteflag
 * @tutorial modules
 * @tutorial bitcoin
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
const KeyEncoder = require('key-encoder').default;

// Whiteflag common functions and classes //
const log = require('../common/logger');
const { hash } = require('../common/crypto');
const { ProcessingError } = require('../common/errors');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Whiteflag common blockchain functions //
const { getEmptyState } = require('./common/state');
const { createSignature } = require('./common/crypto');

// Bitcoin sub-modules //
const btcRpc = require('./bitcoin/rpc');
const btcAccounts = require('./bitcoin/accounts');
const btcListener = require('./bitcoin/listener');
const btcTransactions = require('./bitcoin/transactions');

// Module constants //
const KEYIDLENGTH = 12;
const SIGNALGORITHM = 'ES256';
const SIGNKEYTYPE = 'secp256k1';
const BINENCODING = 'hex';

// Module variables //
let _blockchainName = 'bitcoin';
let _btcState = {};
let _transactionValue = 0;

/**
 * Initialises the Bitcoin blockchain
 * @function initBitcoin
 * @alias module:lib/blockchains/bitcoin.init
 * @param {Object} btcConfig the Bitcoin blockchain configuration
 * @param {blockchainInitCb} callback function to be called after intitialising Bitcoin
 */
function initBitcoin(btcConfig, callback) {
    log.trace(_blockchainName, 'Initialising the Bitcoin blockchain');

    // Preserve the name of the blockchain
    _blockchainName = btcConfig.name;

    // Get Bitcoin blockchain state
    wfState.getBlockchainData(_blockchainName, function blockchainsGetStateDb(err, btcState) {
        if (err) return callback(err, _blockchainName);

        // Check and preserve Bitcoin state
        if (!btcState) {
            log.info(_blockchainName, 'Creating new Bitcoin entry in internal state');
            btcState = getEmptyState();
            wfState.updateBlockchainData(_blockchainName, btcState);
        }
        _btcState = btcState;

        // Determine network parameters
        if (btcConfig.testnet) {
            _btcState.parameters.network = bitcoin.networks.testnet;
            log.info(_blockchainName, 'Configured to use the Bitcoin test network');
        } else {
            _btcState.parameters.network = bitcoin.networks.bitcoin;
            log.info(_blockchainName, 'Configured to use the Bitcoin main network');
        }
        // Initialise sub-modules
        btcRpc.init(btcConfig, _btcState)
        .then(() => btcTransactions.init(btcConfig, _btcState))
        .then(() => btcListener.init(btcConfig, _btcState))
        .then(() => btcAccounts.init(btcConfig, _btcState))
        .then(() => wfState.updateBlockchainData(_blockchainName, _btcState))
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
 * @todo Return blocknumber
 */
function sendMessage(wfMessage, callback) {
    btcAccounts.check(wfMessage.MetaHeader.originatorAddress)
    .then(account => {
        const toAddress = account.address;
        const encodedMessage = Buffer.from(wfMessage.MetaHeader.encodedMessage, 'hex');
        return btcTransactions.send(account, toAddress, _transactionValue, encodedMessage);
    })
    .then(transactionHash => callback(null, transactionHash))
    .catch(err => {
        log.error(_blockchainName, `Error sending Whiteflag message: ${err.message}`);
        callback(err);
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
    let transaction;
    btcTransactions.get(transactionHash)
    .then(rawTransaction => {
        transaction = rawTransaction;
        return btcRpc.getBlockByHash(rawTransaction.blockhash);
    })
    .then(block => {
        return btcTransactions.extractMessage(transaction, block.height, block.time);
    })
    .then(wfMessage => callback(null, wfMessage))
    .catch(err => {
        if (err instanceof ProcessingError) {
            log.debug(_blockchainName, `No Whiteflag message with transaction hash ${transactionHash} found: ${err.message}`);
        } else {
            log.error(_blockchainName, `Error retrieving Whiteflag message with transaction hash ${transactionHash}: ${err.message}`);
        }
        return callback(err, null);
    });
}

/**
 * Requests a Whiteflag signature for a specific Bitcoin address
 * @function requestSignature
 * @alias module:lib/blockchains/bitcoin.requestSignature
 * @param {wfSignaturePayload} payload the JWS payload for the Whiteflag signature
 * @param {blockchainRequestSignatureCb} callback function to be called upon completion
 */
function requestSignature(payload, callback) {
    log.trace(_blockchainName, `Generating signature: ${JSON.stringify(payload)}`);

    // Get Ethereum account, address and private key
    btcAccounts.get(payload.addr)
    .then(account => {
        payload.addr = account.address;
        const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
        wfState.getKey('blockchainKeys', privateKeyId, function bcGetKeyCb(keyErr, privateKey) {
            if (keyErr) return callback(keyErr);

            // Create JSON serialization of JWS token from array
            let wfSignature;
            try {
                wfSignature = createSignature(payload, privateKey, SIGNKEYTYPE, SIGNALGORITHM);
            } catch(err) {
                log.error(_blockchainName, `Could not not sign payload: ${err.message}`);
                return callback(err);
            }
            // Callback with any error and signature
            return callback(null, wfSignature);
        });
    })
    .catch(err => callback(err));
}

/**
 * Requests the Bitcoin address and correctly encoded pubic key of an originator
 * @function requestKeys
 * @alias module:lib/blockchains/bitcoin.requestKeys
 * @param {string} publicKey the raw hex public key of the originator
 * @param {blockchainRequestKeysCb} callback function to be called upon completion
 */
function requestKeys(publicKey, callback) {
    log.trace(_blockchainName, `Getting address and encoded keys for public key: ${publicKey}`);

    // Create data structure for requested keys
    let originatorKeys = {
        address: null,
        publicKey: {
            hex: null,
            pem: null
        }
    };
    try {
        // Bitcoin public key in HEX and PEM encoding
        const keyEncoder = new KeyEncoder(SIGNKEYTYPE);
        const publicKeyBuffer = Buffer.from(publicKey, BINENCODING);
        originatorKeys.publicKey.hex = publicKeyBuffer.toString(BINENCODING);
        originatorKeys.publicKey.pem = keyEncoder.encodePublic(originatorKeys.publicKey.hex, 'raw', 'pem');

        // Bitcoin address
        const { address } = bitcoin.payments.p2pkh({
            pubkey: publicKeyBuffer,
            network: _btcState.parameters.network
        });
        originatorKeys.address = address;
    } catch(err) {
        log.error(_blockchainName, `Could not get key and address: ${err.message}`);
        return callback(err);
    }
    return callback(null, originatorKeys);
}

/**
 * Returns a Bitcoin address in binary encoded form
 * @param {string} address the Bitcoin blockchain address
 * @param {blockchainBinaryAddressCb} callback function to be called upon completion
 */
function getBinaryAddress(address, callback) {
    let addressBuffer;
    try {
        bitcoin.address.toOutputScript(address, _btcState.parameters.network);
        addressBuffer = bs58.decode(address);
    } catch(err) {
        return callback(new ProcessingError(`Invalid Bitcoin address: ${address}`, err.message, 'WF_API_PROCESSING_ERROR'));
    }
    return callback(null, addressBuffer);
}

/**
 * Transfers bitcoin from one Bitcoin address to an other address
 * @function transferFunds
 * @alias module:lib/blockchains/bitcoin.transferFunds
 * @param {Object} transfer the transaction details for the funds transfer
 * @param {blockchainSendTransactionCb} callback function to be called upon completion
 * @todo Return blocknumber
 */
function transferFunds(transfer, callback) {
    log.trace(_blockchainName, `Transferring funds: ${JSON.stringify(transfer)}`);
    btcAccounts.check(transfer.fromAddress)
    .then(account => {
        const toAddress = transfer.toAddress;
        const amount = transfer.value;
        return btcTransactions.send(account, toAddress, amount, null, callback);
    })
    .then(txHash => callback(null, txHash))
    .catch(err => {
        log.error(_blockchainName, `Error transferring funds: ${err.message}`);
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
    btcAccounts.create(wif)
    .then(account => {
        log.info(_blockchainName, `Bitcoin account created: ${account.address}`);
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
    btcAccounts.update(account)
    .then(() => {
        log.info(_blockchainName, `Bitcoin account updated: ${account.address}`);
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
    btcAccounts.delete(address)
    .then(account => {
        log.info(_blockchainName, `Bitcoin account deleted: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}

