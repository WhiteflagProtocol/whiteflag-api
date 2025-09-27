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
    verifySignature,
    createAccount,
    updateAccount,
    deleteAccount
};

// Node.js core and external modules //

// Common internal functions and classes //
const log = require('../_common/logger');
const jws = require('../_common/jws');
const { ignore } = require('../_common/processing');
const { ProcessingError, ProtocolError } = require('../_common/errors');
const { hexToBase64u, base64uToHex } = require('../_common/encoding');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Common blockchain functions //
const { getEmptyState } = require('./_common/state');
const { noKeyHexPrefix } = require('./_common/format')

// Fennel sub-modules //
const fnlRpc = require('./fennel/rpc');
const fnlAccounts = require('./fennel/accounts');
const fnlListener = require('./fennel/listener');

// Module constants //
const MODULELOG = 'fennel';
const SIGNALGORITHM = 'sr25519';

// Module variables //
let _fnlChain;
let _fnlState = {};

// MAIN MODULE FUNCTIONS //
/**
 * Initialises configured blockchains
 * @function initFennel
 * @alias module:lib/blockchains/fennel.init
 * @param {bcInitCb} callback function to be called after intitialising the blockchain
 */
function initFennel(fnConfig, callback) {
    log.trace(MODULELOG, 'Initialising the Fennel blockchain');
    _fnlChain = fnConfig.name;

    // Get Fennel blockchain state
    wfState.getBlockchainData(_fnlChain, function blockchainsGetStateDb(err, fnlState) {
        if (err) return callback(err, _fnlChain);
        if (!fnlState) {
            log.info(MODULELOG, `Creating new ${_fnlChain} entry in internal state`);
            fnlState = getEmptyState();
            wfState.updateBlockchainData(_fnlChain, fnlState);
        }
        _fnlState = fnlState;

        // Initialise sub-modules
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
 * @todo Implement funcion
 * @function sendMessage
 * @alias module:lib/blockchains/fennel.sendMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be sent on the blockchain
 * @param {bcSendMessageCb} callback function to be called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    ignore(wfMessage);
    return callback(new ProcessingError('Function not implemented for this blockchain', null, 'WF_API_NOT_IMPLEMENTED'), wfMessage);
}

/**
 * Performs a simple query to find a message by transaction hash
 * @todo Implement funcion
 * @function getMessage
 * @alias module:lib/blockchains/fennel.getMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {bcGetMessageCb} callback function to be called after Whiteflag message lookup
 */
function getMessage(wfQuery, callback) {
    const transactionHash = wfQuery['MetaHeader.transactionHash'];
    ignore(transactionHash);
    let wfMessage = null;
    return callback(new ProcessingError('Function not implemented for this blockchain', null, 'WF_API_NOT_IMPLEMENTED'), wfMessage);
}

/**
 * Requests the address and correctly encoded pubic key for an originator
 * @todo Implemenyt function
 * @function requestKeys
 * @alias module:lib/blockchains/fennel.requestKeys
 * @param {string} fnlPublicKey the raw hex public key of the originator
 * @param {bcRequestKeysCb} callback function to be called upon completion
 */
function requestKeys(fnlPublicKey, callback) {
    log.trace(MODULELOG, `Getting address for ${_fnlChain} public key: ${btcPublicKey}`);
    let originatorKeys = {
        address: null,
        publicKey: {
            hex: noKeyHexPrefix(fnlPublicKey)
        }
    };
    fnlAccounts.getAddress(noKeyHexPrefix(fnlPublicKey))
    .then(fnlAddress => {
        originatorKeys.address = fnlAddress;
    })
    .catch(err => {
        log.error(MODULELOG, `Could not determine ${_fnlChain} address: ${err.message}`);
        return callback(err);
    });
    return callback(null, originatorKeys);
}

/**
 * Requests a Whiteflag signature for a specific Fennel address
 * @todo Complete and test function
 * @function requestSignature
 * @alias module:lib/blockchains/fennel.requestSignature
 * @param {wfSignPayload} wfSignPayload the JWS payload for the Whiteflag signature
 * @param {authRequestSignatureCb} callback function to be called upon completion
 */
function requestSignature(wfSignPayload, callback) {
    log.trace(MODULELOG, `Generating Whiteflag authentication signature: ${JSON.stringify(wfSignPayload)}`);
    const input = jws.createSignInput(wfSignPayload, SIGNALGORITHM)
    fnlAccounts.sign(input, wfSignPayload.addr)
    .then(output => {
        const signature = hexToBase64u(output);
        const wfSignature = jws.createFlattened(input, signature);
        return callback(null, wfSignature);
    })
    .catch(err => {
        log.error(MODULELOG, `Could not not create Whiteflag authentication signature for address ${wfSignPayload.addr}: ${err.message}`);
        return callback(err);
    });
}

/** 
 * Verifies a Whiteflag signature for the Fennel blockchain
 * @todo Complete and test function
 * @function verifySignature
 * @alias module:lib/blockchains/fennel.verifySignature
 * @param {wfSignature} wfSignature the Whiteflag authentication signature
 * @param {string} fnlAddress the address of the Whiteflag signature
 * @param {string} fnlPublicKey the raw hex public key of the originator
 * @param {authVerifySignatureCb} callback function to be called upon completion
*/
function verifySignature(wfSignature, fnlAddress, fnlPublicKey, callback) {
    log.trace(MODULELOG, `Verifying Whiteflag authentication signature against public key ${fnlPublicKey}: ${JSON.stringify(wfSignature)}`);

    // Get input and signature from Whiteflag JWS object
    let input, signature;
    try {
        input = jws.serializeSignInput(wfSignature);
        signature = base64uToHex(wfSignature.signature);
    } catch(err) {
        return callback(new ProcessingError('Invalid Whiteflag authentication signature', err.message, 'WF_API_BAD_REQUEST'));
    }
    // Verify the signature
    let signErrors = [];
    fnlAccounts.verify(input, signature, fnlPublicKey)
    .then(valid => {
        if (!valid) signErrors.push('Signature does not match payload or public key');
        fnlAccounts.getAddress(noKeyHexPrefix(fnlPublicKey))
        .then(signAddress =>{
            if (signAddress !== fnlAddress) signErrors.push(`Public key address does not correspond with address in signature`);
            if (signErrors.length > 0) {
                return callback(new ProtocolError('Invalid Whiteflag authentication signature', signErrors, 'WF_SIGN_ERROR'), null);
            }
            return callback(null);
        })
        .catch(err => callback(err));
    })
    .catch(err => callback(err));
}

/**
 * Creates a new Fennel blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/fennel.createAccount
 * @param {string} [seed] hexadecimal encoded secret seed
 * @param {bcAccountCb} callback function to be called upon completion
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
 * @param {bcAccountCb} callback function to be called upon completion
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
 * @param {string} fnlAddress the address of the account to be deleted
 * @param {bcAccountCb} callback function to be called upon completion
 */
function deleteAccount(fnlAddress, callback) {
    fnlAccounts.delete(fnlAddress)
    .then(account => {
        log.info(MODULELOG, `Deleted ${_fnlChain} account: ${account.address}`);
        return callback(null, account);
    })
    .catch(err => callback(err));
}
