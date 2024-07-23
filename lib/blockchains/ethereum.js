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

// Whiteflag common functions and classes //
const log = require('../common/logger');
const { hash } = require('../common/crypto');
const { ProcessingError } = require('../common/errors');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Whiteflag common blockchain functions //
const { getEmptyState, createSignature } = require('./common/state');

// Ethereum sub-modules //
const ethRpc = require('./ethereum/rpc');
const ethAccounts = require('./ethereum/accounts');
const ethListener = require('./ethereum/listener');
const ethTransactions = require('./ethereum/transactions');
const { formatHexEthereum, formatHexApi, formatAddressApi, formatPubkeyApi } = require('./ethereum/common');

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
    _blockchainName = ethConfig.name;
    log.trace(_blockchainName, 'Initialising the Ethereum blockchain');

    // Get Ethereum blockchain state
    wfState.getBlockchainData(_blockchainName, function blockchainsGetStateDb(err, ethState) {
        if (err) return callback(err, _blockchainName);

        // Check and preserve Ethereum state
        if (!ethState) {
            log.info(_blockchainName, 'Creating new Ethereum entry in internal state');
            ethState = getEmptyState();
            wfState.updateBlockchainData(_blockchainName, ethState);
        }
        _ethState = ethState;

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
        const toAddress = account.address;
        const encodedMessage = wfMessage.MetaHeader.encodedMessage;
        return ethTransactions.send(account, toAddress, _transactionValue, encodedMessage);
    })
    .then((transactionHash, blockNumber) => {
        return callback(null, transactionHash, blockNumber);
    })
    .catch(err => {
        log.error(_blockchainName, `Error sending Whiteflag message: ${err.message}`);
        callback(err);
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
            log.debug(_blockchainName, `No Whiteflag message with transaction hash ${transactionHash} found: ${err.message}`);
        } else {
            log.error(_blockchainName, `Error retrieving Whiteflag message with transaction hash ${transactionHash}: ${err.message}`);
        }
        return callback(err, null);
    });
}

/**
 * Requests a Whiteflag signature for a specific Ethereum address
 * @function requestSignature
 * @alias module:lib/blockchains/ethereum.requestSignature
 * @param {wfSignaturePayload} payload the JWS payload for the Whiteflag signature
 * @param {blockchainRequestSignatureCb} callback function to be called upon completion
 */
function requestSignature(payload, callback) {
    log.trace(_blockchainName, `Generating signature: ${JSON.stringify(payload)}`);

    // Get Ethereum account, address and private key
    ethAccounts.get(payload.addr)
    .then(account => {
        payload.addr = formatAddressApi(account.address);
        const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
        wfState.getKey('blockchainKeys', privateKeyId, function ethGetKeyCb(keyErr, privateKey) {
            if (keyErr) return callback(keyErr);

            // Create JSON serialization of JWS token from array
            let wfSignature;
            try {
                wfSignature = createSignature(payload, formatHexApi(privateKey), SIGNKEYTYPE, SIGNALGORITHM);
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
 * Requests the Ethereum address and correctly encoded public key of an originator
 * @function requestKeys
 * @alias module:lib/blockchains/ethereum.requestKeys
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
        },
        check: {
            keccak: null
        }
    };
    try {
        // Ethereum public key in HEX and PEM encoding
        const keyEncoder = new KeyEncoder(SIGNKEYTYPE);
        const publicKeyBuffer = Buffer.from(formatPubkeyApi(publicKey), BINENCODING);
        originatorKeys.publicKey.hex = publicKeyBuffer.toString(BINENCODING);
        originatorKeys.publicKey.pem = keyEncoder.encodePublic(originatorKeys.publicKey.hex, 'raw', 'pem');

        // Keccak double check
        let keccakPubkeyBuffer;
        if (originatorKeys.publicKey.hex.length === 130) keccakPubkeyBuffer = Buffer.from(originatorKeys.publicKey.hex.substr(2), BINENCODING);
            else keccakPubkeyBuffer = Buffer.from(originatorKeys.publicKey.hex, BINENCODING);
        originatorKeys.check.keccak = keccak('keccak256').update(keccakPubkeyBuffer).digest('hex');

        // Ethereum Address
        originatorKeys.address = formatAddressApi(ethereumUtil.pubToAddress(publicKeyBuffer, true).toString(BINENCODING));
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
    if (_web3.utils.isAddress(formatHexEthereum(address))) {
        return callback(null, Buffer.from(formatAddressApi(address), BINENCODING));
    }
    return callback(new ProcessingError(`Invalid Ethereum address: ${address}`, null, 'WF_API_PROCESSING_ERROR'));
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
    .catch(err => {
        log.error(_blockchainName, `Error transferring funds: ${err.message}`);
        return callback(err);
    });
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
        log.info(_blockchainName, `Ethereum account created: ${account.address}`);
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
        log.info(_blockchainName, `Ethereum account updated: ${account.address}`);
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
        log.info(_blockchainName, `Ethereum account deleted: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}
