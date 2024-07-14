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
const { getEmptyState, createSignature } = require('./common');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Fennel sub-modules //
const fennelRpc = require('./fennel/rpc');

// Module variables //
let _blockchainName = 'fennel';
let _fennelState = {};

// MAIN MODULE FUNCTIONS //
/**
 * Initialises configured blockchains
 * @function initFennel
 * @alias module:lib/blockchains/fennel.init
 * @param {blockchainInitCb} callback function to be called after intitialising the blockchain
 */
function initFennel(fennelConfig, callback) {
    // Preserve name of the blockchain
    _blockchainName = fennelConfig.name;

    wfState.getBlockchainData(_blockchainName, function blockchainsGetStateDb(err, fennelState) {
        if (err) return callback(err, _blockchainName);

        // Check and preserve Fennel state
        if (!fennelState) {
            log.info(_blockchainName, 'Creating new Fennel entry in internal state');
            fennelState = getEmptyState();
            wfState.updateBlockchainData(_blockchainName, fennelState);
        }
        _fennelState = fennelState;

        // Connect to Fennel node
        fennelRpc.init(fennelConfig, _fennelState)
        .then(() => callback(null, _blockchainName))
        .catch(err => callback(new Error(`Could not connect to Fennel node: ${err.message}`), _blockchainName));
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
    // Check metaheader and encoded message
    if (!Object.hasOwn(wfMessage, 'MetaHeader')) {
        return callback(new ProtocolError('Missing metaheader', null, 'WF_METAHEADER_ERROR'));
    }
    if (!wfMessage.MetaHeader.encodedMessage) {
        return callback(new ProtocolError('No encoded message in metaheader', null, 'WF_METAHEADER_ERROR'));
    }
    if (wfMessage.MetaHeader.blockchain !== _blockchainName) {
        return callback(new ProcessingError(`Message metaheader contains wrong blockchain: ${wfMessage.MetaHeader.blockchain} instead of ${_blockchainName}`));
    }
    // TODO: Do stuff to send message on Blockchain
    ignore(wfMessage);
    wfMessage = null;

    // Callback with any error and updated message metaheader w/ transaction hash etc.
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
    // Check query parameters
    if (wfQuery['MetaHeader.blockchain'] !== _blockchainName) {
        return callback(new ProcessingError(`${_blockchainName}: Wrong blockchain specified in query: ${wfQuery['MetaHeader.blockchain']}`));
    }
    if (!wfQuery['MetaHeader.transactionHash']) {
        return callback(new ProcessingError(`${_blockchainName}: Transaction hash not specified in query`));
    }
    // TODO: Do stuff to find message on blockchain
    ignore(wfMessage);
    let wfMessage = null;

    // Callback with any error and looked up message
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
