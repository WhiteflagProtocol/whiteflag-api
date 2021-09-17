'use strict';
/**
 * @module lib/blockchains/ethereum
 * @summary Whiteflag API Ethereum blockchain implementation
 * @description Module to use Ethereum as underlying blockchain for Whiteflag
 * @tutorial modules
 * @tutorial ethereum
 */
module.exports = {
    // Ethereum blockchain functions
    init: initEthereum,
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
const ethereumUtil = require('ethereumjs-util');
const keccak = require('keccak');
const KeyEncoder = require('key-encoder').default;
const jwt = require('jsonwebtoken');

// Whiteflag common functions and classes //
const log = require('../common/logger');
const { hash } = require('../common/crypto');
const { ProcessingError } = require('../common/errors');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Ethereum sub-modules //
const ethRpc = require('./ethereum/rpc');
const ethAccounts = require('./ethereum/accounts');
const ethListener = require('./ethereum/listener');
const ethTransactions = require('./ethereum/transactions');
const { formatHexEthereum, formatHexApi, formatAddressApi, formatPubkeyApi } = require('./common');

// Module constants //
const KEYIDLENGTH = 12;
const SIGNALGORITHM = 'ES256';
const SIGNKEYTYPE = 'secp256k1';
const BINENCODING = 'hex';

// Module variables //
let _blockchainName = 'ethereum';
let _ethState = {};
let _web3;
let _transactionValue = '0';

/**
 * Initialises the Ethereum blockchain
 * @function initEthereum
 * @alias module:lib/blockchains/ethereum.init
 * @param {Object} ethConfig the blockchain configuration
 * @param {blockchainInitCb} callback function to be called after intitialising Ethereum
 */
function initEthereum(ethConfig, callback) {
    log.trace(_blockchainName, 'Initialising the Ethereum blockchain...');

    // Preserve the name of the blockchain
    _blockchainName = ethConfig.name;

    // Get Ethereum blockchain state
    wfState.getBlockchainData(_blockchainName, function blockchainsGetStateDb(err, blockchainState) {
        if (err) return callback(err, _blockchainName);
        if (!blockchainState) {
            blockchainState = {
                parameters: {},
                status: {},
                accounts: []
            };
        }
        // Preserve state for module
        _ethState = blockchainState;

        // Connect to node, determine blocks, and start listener
        ethRpc.init(ethConfig, _ethState)
        .then(web3 => (_web3 = web3))
        .then(() => ethTransactions.init(ethConfig, _ethState, _web3))
        .then(() => ethListener.init(ethConfig, _ethState))
        .then(() => ethAccounts.init(ethConfig, _ethState, _web3))
        .then(() => wfState.updateBlockchainData(_blockchainName, _ethState))
        .then(() => callback(null, _blockchainName))
        .catch(initErr => callback(initErr, _blockchainName));
    });
}

/**
 * Sends an encoded message on the Ethereum blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/ethereum.sendMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be sent on Ethereum
 * @param {blockchainSendMessageCb} callback function to be called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    ethAccounts.get(wfMessage.MetaHeader.originatorAddress)
    .then(account => {
        return ethTransactions.send(account, account.address, _transactionValue, wfMessage.MetaHeader.encodedMessage);
    })
    .then((transactionHash, blockNumber) => {
        return callback(null, transactionHash, blockNumber);
    })
    .catch(err => {
        log.error(_blockchainName, `Error sending Whiteflag message: ${err.toString()}`);
        return callback(err);
    });
}

/**
 * Performs a simple query to find a message on Ethereum by transaction hash
 * @function getMessage
 * @alias module:lib/blockchains/ethereum.getMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {blockchainLookupMessageCb} callback function to be called after Whiteflag message lookup
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
            log.debug(_blockchainName, `Could not retrieve Whiteflag message: ${err.message}`);
        } else {
            log.error(_blockchainName, `Error retrieving Whiteflag message: ${err.message}`);
        }
        return callback(err);
    });
}

/**
 * Requests a Whiteflag signature for a specific Ethereum address
 * @function requestSignature
 * @alias module:lib/blockchains/ethereum.requestSignature
 * @param {wfSignaturePayload} signPayload the JWS payload for the Whiteflag signature
 * @param {blockchainRequestSignatureCb} callback function to be called upon completion
 */
function requestSignature(signPayload, callback) {
    log.trace(_blockchainName, `Generating signature: ${JSON.stringify(signPayload)}`);

    // Data structure
    let wfSignatureArray = [];
    let wfSignature = {
        protected: '',
        payload: '',
        signature: ''
    };
    // Get Ethereum account and address
    ethAccounts.getAccount(signPayload.addr)
    .then(account => {
        signPayload.addr = formatAddressApi(account.address);

        // Create JWS token and split into array
        const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
        wfState.getKey('blockchainKeys', privateKeyId, function ethGetKeyCb(keyErr, privateKey) {
            if (keyErr) return callback(keyErr);
            try {
                const keyEncoder = new KeyEncoder(SIGNKEYTYPE);
                const originatorPrivateKey = keyEncoder.encodePrivate(formatHexApi(privateKey), 'raw', 'pem');
                wfSignatureArray = jwt.sign(signPayload, originatorPrivateKey, { algorithm: SIGNALGORITHM }).split('.');
            } catch(err) {
                log.error(_blockchainName, `Could not not sign payload: ${err.message}`);
                return callback(err);
            }
            // Create JSON serialization of JWS token from array
            wfSignature.protected = wfSignatureArray[0];
            wfSignature.payload = wfSignatureArray[1];
            wfSignature.signature = wfSignatureArray[2];

            // Callback with any error and signature
            return callback(null, wfSignature);
        });
    })
    .catch(err => callback(err));
}

/**
 * Requests the Ethereum address and correctly encoded public key of an originator
 * @function requestKeys
 * @alias module:lib/blockchains/ethereum.requestKeys
 * @param {string} originatorPubKey the raw hex public key of the originator
 * @param {blockchainRequestKeysCb} callback function to be called upon completion
 */
function requestKeys(originatorPubKey, callback) {
    log.trace(_blockchainName, `Getting address and encoded keys for public key: ${originatorPubKey}`);

    // Create data structure with requested keys
    let originatorKeys = {};
    try {
        // Signature Key in PEM encoding
        const keyEncoder = new KeyEncoder(SIGNKEYTYPE);
        originatorKeys.pubkey = formatPubkeyApi(originatorPubKey);
        originatorKeys.pemkey = keyEncoder.encodePublic(originatorKeys.pubkey, 'raw', 'pem');

        // Keccak double check
        let keccakPubkeyBuffer;
        if (originatorKeys.pubkey.length === 130) keccakPubkeyBuffer = Buffer.from(originatorKeys.pubkey.substr(2), BINENCODING);
            else keccakPubkeyBuffer = Buffer.from(originatorKeys.pubkey, BINENCODING);
        originatorKeys.keccak = keccak('keccak256').update(keccakPubkeyBuffer).digest('hex');

        // Ethereum Address
        const pubkeyBuffer = Buffer.from(originatorKeys.pubkey, BINENCODING);
        originatorKeys.address = formatAddressApi(ethereumUtil.pubToAddress(pubkeyBuffer, true).toString(BINENCODING));
    } catch(err) {
        log.error(_blockchainName, `Could not get key and address: ${err.message}`);
        return callback(err);
    }
    return callback(null, originatorKeys);
}

/**
 * Returns an Ethereum address in binary encoded form
 * @param {string} address the blockchain address
 * @param {blockchainBinaryAddressCb} callback function to be called upon completion
 */
function getBinaryAddress(address, callback) {
    log.trace(_blockchainName, `Binary encoding address: ${address}`);
    if (_web3.utils.isAddress(formatHexEthereum(address))) {
        return callback(null, Buffer.from(formatAddressApi(address), BINENCODING));
    }
    return(new Error(`Invalid Ethereum address: ${formatHexEthereum(address)}`));
}

/**
 * Transfers ether from one Ethereum address to an other address
 * @function transferFunds
 * @alias module:lib/blockchains/ethereum.transferFunds
 * @param {Object} transfer the object with the transaction details to transfer funds
 * @param {blockchainTransferValueCb} callback function to be called upon completion
 */
function transferFunds(transfer, callback) {
    log.trace(_blockchainName, `Transferring funds: ${JSON.stringify(transfer)}`);
    ethAccounts.get(transfer.fromAddress)
    .then(account => {
        return ethTransactions.send(account, transfer.toAddress, transfer.value, '');
    })
    .then((transactionHash, blockNumber) => callback(null, transactionHash, blockNumber))
    .catch(err => callback(err));
}

/**
 * Creates a new Ethereum blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/ethereum.createAccount
 * @param {string} [privateKey] hexadecimal encoded private key
 * @param {blockchainCreateAccountCb} callback function to be called upon completion
 */
 function createAccount(privateKey, callback) {
    ethAccounts.create(privateKey)
    .then(account => {
        log.info(_blockchainName, `Blockchain account created: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}

 /**
 * Updates Ethereum blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/ethereum.updateAccount
 * @param {Object} account the account information including address to be updated
 * @param {blockchainUpdateAccountCb} callback function to be called upon completion
 */
function updateAccount(account, callback) {
    ethAccounts.update(account)
    .then(updatedAccount => {
        log.debug(_blockchainName, `Blockchain account updated: ${account.address}`);
        return callback(null, updatedAccount);
    })
    .catch(err => callback(err));
}

/**
 * Deletes Ethereum blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/ethereum.deleteAccount
 * @param {string} address the address of the account to be deleted
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function deleteAccount(address, callback) {
    ethAccounts.delete(address)
    .then(account => {
        log.info(_blockchainName, `Blockchain account deleted: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}
