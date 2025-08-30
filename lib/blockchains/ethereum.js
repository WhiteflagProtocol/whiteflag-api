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
const keccak = require('keccak');
const KeyEncoder = require('key-encoder').default;
const { pubToAddress}  = require('ethereumjs-util');

// Whiteflag common functions and classes //
const log = require('../common/logger');
const { hash } = require('../common/crypto');
const { ProcessingError } = require('../common/errors');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Whiteflag common blockchain functions //
const { getEmptyState } = require('./common/state');
const { createSignature } = require('./common/crypto');

// Ethereum sub-modules //
const ethRpc = require('./ethereum/rpc');
const ethAccounts = require('./ethereum/accounts');
const ethListener = require('./ethereum/listener');
const ethTransactions = require('./ethereum/transactions');
const { withHexPrefix,
        noKeyHexPrefix,
        noAddressHexPrefix,
        noPubkeyHexPrefix
    } = require('./common/format');

// Module constants //
const KEYIDLENGTH = 12;
const SIGNALGORITHM = 'ES256';
const SIGNKEYTYPE = 'secp256k1';
const BINENCODING = 'hex';

// Module variables //
let _ethName = 'ethereum';
let _ethState = {};
let _ethApi;
let _transactionValue = '0';

/**
 * Initialises the Ethereum blockchain
 * @function initEthereum
 * @alias module:lib/blockchains/ethereum.init
 * @param {Object} ethConfig the blockchain configuration
 * @param {blockchainInitCb} callback function to be called after intitialising Ethereum
 */
function initEthereum(ethConfig, callback) {
    _ethName = ethConfig.name;
    log.trace(_ethName, 'Initialising the Ethereum blockchain');

    // Get Ethereum blockchain state
    wfState.getBlockchainData(_ethName, function blockchainsGetStateDb(err, ethState) {
        if (err) return callback(err, _ethName);
        if (!ethState) {
            log.info(_ethName, 'Creating new Ethereum entry in internal state');
            ethState = getEmptyState();
            wfState.updateBlockchainData(_ethName, ethState);
        }
        _ethState = ethState;

        // Connect to node, determine blocks, and start listener
        ethRpc.init(ethConfig, _ethState)
        .then(ethApi => (_ethApi = ethApi))
        .then(() => ethTransactions.init(ethConfig, _ethState, _ethApi))
        .then(() => ethListener.init(ethConfig, _ethState))
        .then(() => ethAccounts.init(ethConfig, _ethState, _ethApi))
        .then(() => wfState.updateBlockchainData(_ethName, _ethState))
        .then(() => callback(null, _ethName))
        .catch(err => callback(err, _ethName));
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
        log.error(_ethName, `Error sending Whiteflag message: ${err.message}`);
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
            log.debug(_ethName, `No Whiteflag message with transaction hash ${transactionHash} found: ${err.message}`);
        } else {
            log.error(_ethName, `Error retrieving Whiteflag message with transaction hash ${transactionHash}: ${err.message}`);
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
    log.trace(_ethName, `Generating signature: ${JSON.stringify(payload)}`);

    // Get Ethereum account, address and private key
    ethAccounts.get(payload.addr)
    .then(account => {
        payload.addr = noAddressHexPrefix(account.address);
        const privateKeyId = hash(_ethName + account.address, KEYIDLENGTH);
        wfState.getKey('blockchainKeys', privateKeyId, function ethGetKeyCb(err, privateKey) {
            if (err) return callback(err);

            // Create signature
            let wfSignature;
            try {
                wfSignature = createSignature(payload, noKeyHexPrefix(privateKey), SIGNKEYTYPE, SIGNALGORITHM);
            } catch(err) {
                log.error(_ethName, `Could not not sign payload: ${err.message}`);
                return callback(err);
            }
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
    log.trace(_ethName, `Getting address and encoded keys for public key: ${publicKey}`);

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
        const orgPublicKey = originatorKeys.publicKey;
        const keyEncoder = new KeyEncoder(SIGNKEYTYPE);
        const publicKeyBuffer = Buffer.from(noPubkeyHexPrefix(publicKey), BINENCODING);
        orgPublicKey.hex = publicKeyBuffer.toString(BINENCODING);
        orgPublicKey.pem = keyEncoder.encodePublic(orgPublicKey.hex, 'raw', 'pem');

        // Keccak double check
        let keccakPubkeyBuffer;
        if (orgPublicKey.hex.length === 130) {
            keccakPubkeyBuffer = Buffer.from(orgPublicKey.hex.substring(2), BINENCODING);
        } else {
            keccakPubkeyBuffer = Buffer.from(orgPublicKey.hex, BINENCODING);
        }
        originatorKeys.check.keccak = keccak('keccak256').update(keccakPubkeyBuffer).digest('hex');

        // Ethereum Address
        originatorKeys.address = noAddressHexPrefix(pubToAddress(publicKeyBuffer, true).toString(BINENCODING));
    } catch(err) {
        log.error(_ethName, `Could not get key and address: ${err.message}`);
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
    if (_ethApi.utils.isAddress(withHexPrefix(address))) {
        return callback(null, Buffer.from(noAddressHexPrefix(address), BINENCODING));
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
    log.trace(_ethName, `Transferring funds: ${JSON.stringify(transfer)}`);
    ethAccounts.get(transfer.fromAddress)
    .then(account => {
        return ethTransactions.send(account, transfer.toAddress, transfer.value, '');
    })
    .then((transactionHash, blockNumber) => callback(null, transactionHash, blockNumber))
    .catch(err => {
        log.error(_ethName, `Error transferring funds: ${err.message}`);
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
        log.info(_ethName, `Ethereum account created: ${account.address}`);
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
        log.info(_ethName, `Ethereum account updated: ${account.address}`);
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
        log.info(_ethName, `Ethereum account deleted: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}
