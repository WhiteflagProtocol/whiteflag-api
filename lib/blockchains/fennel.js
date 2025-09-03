'use strict';
/**
 * @module lib/blockchains/
 * @summary Whiteflag API Fennel parachain implementation
 * @description Module to use the Fennel parachain as underlying blockchain for Whiteflag
 * @tutorial modules
 * @tutorial fennel
 */
module.exports = {
    // Fennel parachain functions
    init: initFennel,
    sendMessage,
    getMessage,
    requestKeys,
    requestSignature,
    createAccount,
    updateAccount,
    deleteAccount
};

// Node.js core and external modules //

// Whiteflag common functions and classes //
const log = require('../common/logger');
const { ignore } = require('../common/processing');
const { ProcessingError, ProtocolError } = require('../common/errors');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Whiteflag common blockchain functions //
const { getEmptyState } = require('./common/state');

// Fennel sub-modules //
const fnlRpc = require('./fennel/rpc');
const fnlAccounts = require('./fennel/accounts');
const fnlListener = require('./fennel/listener');

// Module constants //
const MODULELOG = 'fennel';

// Module variables //
let _fnlChain;
let _fnlState = {};

// MAIN MODULE FUNCTIONS //
/**
 * Initialises configured blockchains
 * @function initFennel
 * @alias module:lib/blockchains/fennel.init
 * @param {blockchainInitCb} callback function to be called after intitialising the blockchain
 */
function initFennel(fnConfig, callback) {
    log.trace(MODULELOG, 'Initialising the Fennel blockchain');
    _fnlChain = fnConfig.name;

    wfState.getBlockchainData(_fnlChain, function blockchainsGetStateDb(err, fnlState) {
        if (err) return callback(err, _fnlChain);

        // Check and preserve Fennel state
        if (!fnlState) {
            log.info(MODULELOG, `Creating new ${_fnlChain} entry in internal state`);
            fnlState = getEmptyState();
            wfState.updateBlockchainData(_fnlChain, fnlState);
        }
        _fnlState = fnlState;

        // Connect to Fennel node
        fnlAccounts.init(fnConfig, _fnlState)
        .then(() => fnlRpc.init(fnConfig, _fnlState))
        .then(() => fnlListener.init(fnConfig, _fnlState))
        .then(() => {
            wfState.updateBlockchainData(_fnlChain, _fnlState);
            return callback(null, _fnlChain);
        })
        .catch((err) => callback(err, _fnlChain));
    });
}

/**
 * Sends an encoded message on the blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/.sendMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be sent on the blockchain
 * @param {blockchainSendMessageCb} callback function to be called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    // TODO: Do stuff to send message on Blockchain
    ignore(wfMessage);
    return callback(new ProcessingError('Function not implemented for this blockchain', null, 'WF_API_NOT_IMPLEMENTED'), wfMessage);
}

/**
 * Performs a simple query to find a message by transaction hash
 * @function getMessage
 * @alias module:lib/blockchains/.getMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {blockchainLookupMessageCb} callback function to be called after Whiteflag message lookup
 */
function getMessage(wfQuery, callback) {
    const transactionHash = wfQuery['MetaHeader.transactionHash'];
    // TODO: Do stuff to find message on blockchain
    ignore(transactionHash);
    let wfMessage = null;
    return callback(new ProcessingError('Function not implemented for this blockchain', null, 'WF_API_NOT_IMPLEMENTED'), wfMessage);
}

/**
 * Requests a Whiteflag signature for a specific blockchain address
 * @function requestSignature
 * @alias module:lib/blockchains/.requestSignature
 * @param {Object} signPayload the JWS payload for the Whiteflag signature
 * @param {blockchainRequestSignatureCb} callback function to be called upon completion
 */
function requestSignature(signPayload, callback) {
    // TODO: Do stuff to sign the payload with blockchain keys
    ignore(signPayload);
    let wfSignature = null;
    return callback(new ProcessingError('Function not implemented for this blockchain', null, 'WF_API_NOT_IMPLEMENTED'), wfSignature);
}

/**
 * Requests the address and correctly encoded pubic key for an originator
 * @function requestKeys
 * @alias module:lib/blockchains/.requestKeys
 * @param {string} originatorPubKey the raw hex public key of the originator
 * @param {blockchainRequestKeysCb} callback function to be called upon completion
 */
function requestKeys(originatorPubKey, callback) {
    // TODO: Do stuff to get the required keys
    ignore(originatorPubKey);
    let originatorKeys = null;
    return callback(null, originatorKeys);
}

/**
 * Creates a new Fennel blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/fennel.createAccount
 * @param {string} [seed] hexadecimal encoded secret seed
 * @param {blockchainCreateAccountCb} callback function to be called upon completion
 */
 function createAccount(seed, callback) {
    fnlAccounts.create(seed)
    .then(account => {
        log.info(MODULELOG, `Created ${_fnlChain} account: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}

 /**
 * Updates Fennel blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/fennel.updateAccount
 * @param {Object} account the account information including address to be updated
 * @param {blockchainUpdateAccountCb} callback function to be called upon completion
 */
function updateAccount(account, callback) {
    fnlAccounts.update(account)
    .then(updatedAccount => {
        log.info(MODULELOG, `Updated ${_fnlChain} account: ${account.address}`);
        return callback(null, updatedAccount);
    })
    .catch(err => callback(err));
}

/**
 * Deletes Fennel blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/fennel.deleteAccount
 * @param {string} address the address of the account to be deleted
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function deleteAccount(address, callback) {
    fnlAccounts.delete(address)
    .then(account => {
        log.info(MODULELOG, `Deletd ${_fnlChain} account: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}
