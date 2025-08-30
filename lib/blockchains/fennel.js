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
    requestSignature
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
const fennelListener = require('./fennel/listener');

// Module variables //
let _fnlName = 'fennel';
let _fnlState = {};
let _fnlApi;

// MAIN MODULE FUNCTIONS //
/**
 * Initialises configured blockchains
 * @function initFennel
 * @alias module:lib/blockchains/fennel.init
 * @param {blockchainInitCb} callback function to be called after intitialising the blockchain
 */
function initFennel(fennelConfig, callback) {
    _fnlName = fennelConfig.name;
    log.trace(_fnlName, 'Initialising the Fennel blockchain');

    wfState.getBlockchainData(_fnlName, function blockchainsGetStateDb(err, fnlState) {
        if (err) return callback(err, _fnlName);

        // Check and preserve Fennel state
        if (!fnlState) {
            log.info(_fnlName, 'Creating new Fennel entry in internal state');
            fnlState = getEmptyState();
            wfState.updateBlockchainData(_fnlName, fnlState);
        }
        _fnlState = fnlState;

        // Connect to Fennel node
        fnlRpc.init(fennelConfig, _fnlState)
        .then(fnlApi => (_fnlApi = fnlApi))
        .then(() => fennelListener.init(fennelConfig, _fnlState))
        .then(() => callback(null, _fnlName))
        .catch(err => callback(err, _fnlName));
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
