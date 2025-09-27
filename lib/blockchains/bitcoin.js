'use strict';
/**
 * @module lib/blockchains/bitcoin
 * @summary Whiteflag API Bitcoin blockchain implementation
 * @description Module to use Bitcoin as underlying blockchain for Whiteflag
 * @todo The Bitcoin moduele has not been maintained and needs updating
 * @tutorial modules
 * @tutorial bitcoin
 */
module.exports = {
    // Bitcoin blockchain functionsns
    init: initBitcoin,
    sendMessage,
    getMessage,
    requestKeys,
    requestSignature,
    verifySignature,
    getBinaryAddress,
    transferFunds,
    createAccount,
    updateAccount,
    deleteAccount
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');
const bs58 = require('bs58');

// Common internal functions and classes //
const log = require('../_common/logger');
const { ignore } = require('../_common/processing');
const { ProcessingError, ProtocolError } = require('../_common/errors');
const { hexToBuffer } = require('../_common/encoding');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Common blockchain functions //
const { getEmptyState } = require('./_common/state');
const { noKeyHexPrefix } = require('./_common/format');
const { getPrivateKeyId } = require('./_common/keys');
const { createJWS, verifyJWS } = require('./_common/crypto');

// Bitcoin sub-modules //
const btcRpc = require('./bitcoin/rpc');
const btcAccounts = require('./bitcoin/accounts');
const btcListener = require('./bitcoin/listener');
const btcTransactions = require('./bitcoin/transactions');

// Module constants //
const MODULELOG = 'bitcoin';
const SIGNALGORITHM = 'ES256';
const SIGNKEYTYPE = 'secp256k1';

// Module variables //
let _btcChain = 'bitcoin';
let _btcState = {};
let _transactionValue = 0;

/**
 * Initialises the Bitcoin blockchain
 * @function initBitcoin
 * @alias module:lib/blockchains/bitcoin.init
 * @param {Object} btcConfig the Bitcoin blockchain configuration
 * @param {bcInitCb} callback function to be called after intitialising Bitcoin
 */
function initBitcoin(btcConfig, callback) {
    log.trace(MODULELOG, 'Initialising the Bitcoin blockchain');
    _btcChain = btcConfig.name;

    // Get Bitcoin blockchain state
    wfState.getBlockchainData(_btcChain, function blockchainsGetStateDb(err, btcState) {
        if (err) return callback(err, _btcChain);
        if (!btcState) {
            log.info(MODULELOG, `Creating new ${_btcChain} entry in internal state`);
            btcState = getEmptyState();
            wfState.updateBlockchainData(_btcChain, btcState);
        }
        _btcState = btcState;

        // Determine network parameters
        if (btcConfig.testnet) {
            _btcState.parameters.network = bitcoin.networks.testnet;
            log.info(MODULELOG, 'Configured to use the Bitcoin test network');
        } else {
            _btcState.parameters.network = bitcoin.networks.bitcoin;
            log.info(MODULELOG, 'Configured to use the Bitcoin main network');
        }
        // Initialise sub-modules
        btcAccounts.init(btcConfig, _btcState)
        .then(() => btcRpc.init(btcConfig, _btcState))
        .then(() => btcTransactions.init(btcConfig, _btcState))
        .then(() => btcListener.init(btcConfig, _btcState))
        .then(() => {
            wfState.updateBlockchainData(_btcChain, _btcState);
            return callback(null, _btcChain);
        })
        .catch(err => callback(err, _btcChain));
    });
}

/**
 * Sends an encoded message on the Bitcoin blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/bitcoin.sendMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be sent on Bitcoin
 * @param {bcSendTransactionCb} callback function to be called after sending Whiteflag message
 * @todo Return blocknumber
 */
function sendMessage(wfMessage, callback) {
    btcAccounts.check(wfMessage.MetaHeader.originatorAddress)
    .then(account => {
        const toAddress = account.address;
        const encodedMessage = hexToBuffer(wfMessage.MetaHeader.encodedMessage);
        return btcTransactions.send(account, toAddress, _transactionValue, encodedMessage);
    })
    .then(transactionHash => callback(null, transactionHash))
    .catch(err => {
        log.error(MODULELOG, `Error sending Whiteflag message: ${err.message}`);
        callback(err);
    });
}

/**
 * Performs a simple query to find a message on Bitcoin by transaction hash
 * @function getMessage
 * @alias module:lib/blockchains/bitcoin.getMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {bcGetMessageCb} callback function to be called after Whiteflag message lookup
 */
function getMessage(wfQuery, callback) {
    const transactionHash = wfQuery['MetaHeader.transactionHash'];
    btcTransactions.get(transactionHash)
    .then(transaction => {
        const block = btcRpc.getBlockByHash(transaction.blockhash);
        return btcTransactions.extractMessage(transaction, block.height, block.time);
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
 * Requests the Bitcoin address and correctly encoded pubic key of an originator
 * @function requestKeys
 * @alias module:lib/blockchains/bitcoin.requestKeys
 * @param {string} btcPublicKey the raw hex public key of the originator
 * @param {bcRequestKeysCb} callback function to be called upon completion
 */
function requestKeys(btcPublicKey, callback) {
    log.trace(MODULELOG, `Getting address and encoded keys for ${_btcChain} public key: ${btcPublicKey}`);
    let originatorKeys = {
        address: null,
        publicKey: {
            hex: noKeyHexPrefix(btcPublicKey)
        }
    };
    btcAccounts.getAddress(noKeyHexPrefix(btcPublicKey))
    .then(btcAddress => {
        originatorKeys.address = btcAddress;
    })
    .catch(err => {
        log.error(MODULELOG, `Could not determine ${_btcChain} address: ${err.message}`);
        return callback(err);
    });
    return callback(null, originatorKeys);
}

/**
 * Requests a Whiteflag signature for the specified Bitcoin address
 * @todo Refactor to use with new JWS functions and native blockchain signature
 * @function requestSignature
 * @alias module:lib/blockchains/bitcoin.requestSignature
 * @param {wfSignPayload} wfSignPayload the JWS payload for the Whiteflag signature
 * @param {authRequestSignatureCb} callback function to be called upon completion
 */
function requestSignature(wfSignPayload, callback) {
    log.trace(MODULELOG, `Generating Whiteflag authentication signature: ${JSON.stringify(wfSignPayload)}`);

    // Get Bitcoin account and address
    btcAccounts.get(wfSignPayload.addr)
    .then(account => {
        // Get private key and create signature
        const privateKeyId = getPrivateKeyId(_btcChain, account.address);
        wfState.getKey('blockchainKeys', privateKeyId, function bcGetKeyCb(err, btcPrivateKey) {
            if (err) return callback(err);
            if (!btcPrivateKey) {
                return callback(new ProcessingError(`No private key available for address ${account.address}`, null, 'WF_API_PROCESSING_ERROR'));
            }
            // Create signature
            let wfSignature;
            try {
                wfSignature = createJWS(wfSignPayload, btcPrivateKey, SIGNKEYTYPE, SIGNALGORITHM);
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
 * Verifies a Whiteflag signature for the specified Bitcoin public key
 * @todo Refactor to use with new JWS functions and native blockchain signature
 * @function verifySignature
 * @alias module:lib/blockchains/bitcoin.verifySignature
 * @param {wfSignature} wfSignature the Whiteflag authentication signature
 * @param {string} btcAddress the address of the Whiteflag signature
 * @param {string} btcPublicKey the Bitcoin public key to verify against
 * @param {authVerifySignatureCb} callback function to be called upon completion
 */
function verifySignature(wfSignature, btcAddress, btcPublicKey, callback) {
    log.trace(MODULELOG, `Verifying Whiteflag authentication signature against public key ${btcPublicKey}: ${JSON.stringify(wfSignature)}`);

    // Verify the signature
    let result;
    try {
        result = verifyJWS(wfSignature, btcPublicKey, SIGNKEYTYPE);
    } catch(err) {
        if (err instanceof ProtocolError) {
            return callback(new ProtocolError(`Invalid Whiteflag authentication signature`, err.message, 'WF_SIGN_ERROR'));
        }
        log.error(MODULELOG, `Could not verify Whiteflag authentication signature: ${err.message}`);
        return callback(err);
    }
    //TODO: Check public key and address
    ignore(btcAddress);
    return callback(null, result);
}

/**
 * Returns a Bitcoin address in binary encoded form
 * @function getBinaryAddress
 * @alias module:lib/blockchains/bitcoin.getBinaryAddress
 * @param {string} btcAddress the Bitcoin blockchain address
 * @param {blockchainBinaryAddressCb} callback function to be called upon completion
 */
function getBinaryAddress(btcAddress, callback) {
    let addressBuffer;
    try {
        bitcoin.address.toOutputScript(btcAddress, _btcState.parameters.network);
        addressBuffer = bs58.decode(btcAddress);
    } catch(err) {
        return callback(new ProcessingError(`Invalid ${_btcChain} address: ${btcAddress}`, err.message, 'WF_API_PROCESSING_ERROR'));
    }
    return callback(null, addressBuffer);
}

/**
 * Transfers bitcoin from one Bitcoin address to an other address
 * @todo Return blocknumber
 * @function transferFunds
 * @alias module:lib/blockchains/bitcoin.transferFunds
 * @param {Object} transfer the transaction details for the funds transfer
 * @param {bcSendTransactionCb} callback function to be called upon completion
 */
function transferFunds(transfer, callback) {
    log.trace(MODULELOG, `Transferring funds: ${JSON.stringify(transfer)}`);
    btcAccounts.check(transfer.fromAddress)
    .then(account => {
        const toAddress = transfer.toAddress;
        const amount = transfer.value;
        return btcTransactions.send(account, toAddress, amount, null, callback);
    })
    .then(txHash => callback(null, txHash))
    .catch(err => {
        log.error(MODULELOG, `Error transferring funds: ${err.message}`);
        return callback(err);
    });
}

/**
 * Creates a new Bitcoin blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/bitcoin.createAccount
 * @param {string} [wif] the private key in Wallet Input Format
 * @param {bcAccountCb} callback function to be called upon completion
 */
function createAccount(wif = null, callback) {
    btcAccounts.create(wif)
    .then(account => {
        log.info(MODULELOG, `Created ${_btcChain} account: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}

 /**
 * Updates Bitcoin blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/bitcoin.updateAccount
 * @param {Object} account the account information including address to be updated
 * @param {bcAccountCb} callback function to be called upon completion
 */
function updateAccount(account, callback) {
    btcAccounts.update(account)
    .then(() => {
        log.info(MODULELOG, `Updated ${_btcChain} account: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}

/**
 * Deletes Bitcoin blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/bitcoin.deleteAccount
 * @param {string} btcAddress the address of the account to be deleted
 * @param {bcAccountCb} callback function to be called upon completion
 */
function deleteAccount(btcAddress, callback) {
    btcAccounts.delete(btcAddress)
    .then(account => {
        log.info(MODULELOG, `Deleted ${_btcChain} account: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}
