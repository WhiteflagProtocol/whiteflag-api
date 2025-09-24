'use strict';
/**
 * @module lib/operations/blockchains
 * @summary Whiteflag API blockchains endpoints handler module
 * @description Module with api blockchains endpoint handlers
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    // Endpoint handler functions
    getBlockchains,
    getBlockchain,
    transferFunds,
    getAccounts,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    createSignature
};

// Common internal functions and classes //
const response = require('../_common/httpres');
const array = require('../_common/arrays');
const { ProcessingError } = require('../_common/errors');

// Whiteflag modules //
const wfApiBlockchains = require('../blockchains');
const wfAuthenticate = require('../protocol/authenticate');
const wfState = require('../protocol/state');

// MAIN MODULE FUNCTIONS //
/**
 * Provides current state of all blockchains from state module
 * @function getBlockchains
 * @alias module:lib/operations/blockchains.getBlockchains
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getBlockchains(req, res, operationId, callback) {
    wfState.getBlockchains(function endpointGetBlockchainsCb(err, blockchainsState = null) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);
        let resData = [];

        // Send response using common endpoint response function
        if (!err && !blockchainsState) err = new Error('Could not retrieve blockchains');
        if (blockchainsState) {
            resBody.meta.info = array.addItem(resBody.meta.info, 'Current blockchains in state');
            resData = Object.keys(blockchainsState);
        }
        return response.sendIndicative(res, err, resBody, resData, callback);
    });
}

/**
 * Provides current blockchain state from state module
 * @function getBlockchain
 * @alias module:lib/operations/blockchains.getBlockchain
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getBlockchain(req, res, operationId, callback) {
    const blockchain = req.params.blockchain;
    wfState.getBlockchainData(blockchain, function endpointGetBlockchainCb(err, blockchainState = null) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err && !blockchainState) err = new ProcessingError(`Blockchain ${blockchain} does not exist`, null, 'WF_API_NO_RESOURCE');
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.info = array.addItem(resBody.meta.info, `Current ${blockchain} state`);
        }
        return response.sendIndicative(res, err, resBody, blockchainState, callback);
    });
}

/**
 * Provides all blockchain accounts from state module
 * @function getAccounts
 * @alias module:lib/operations/blockchains.getAccounts
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getAccounts(req, res, operationId, callback) {
    const blockchain = req.params.blockchain;
    wfState.getBlockchainData(blockchain, function endpointGetAccountsCb(err, blockchainState = null) {
        // Create response body and preserve information before responding
        let resData = [];
        let resBody = response.createBody(req, operationId);

        // Extract account data from blockchain state
        if (!err && !blockchainState) err = new ProcessingError(`Blockchain ${blockchain} does not exist`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.blockchain = blockchain;
        if (!err && !blockchainState.accounts) err = new Error(`Could not retrieve accounts for ${blockchain}`);
        if (!err) {
            resData = array.pluck(blockchainState.accounts, 'address') || [];
            resBody.meta.info = array.addItem(resBody.meta.info, `Blockchain accounts on ${blockchain}`);
        }
        // Send response using common endpoint response function
        return response.sendIndicative(res, err, resBody, resData, callback);
    });
}

/**
 * Provides specific blockchain account from state module
 * @function getAccount
 * @alias module:lib/operations/blockchains.getAccount
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function getAccount(req, res, operationId, callback) {
    const blockchain = req.params.blockchain;
    const address = req.params.account;
    wfState.getBlockchainData(blockchain, function endpointGetAccountCb(err, blockchainState = null) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = response.createBody(req, operationId);

        // Get the requested account object
        if (!err && !blockchainState) err = new ProcessingError(`Blockchain ${blockchain} does not exist`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.blockchain = blockchain;
        if (!err && !blockchainState.accounts) err = new Error(`Could not retrieve accounts for ${blockchain}`);
        if (!err) {
            const index = blockchainState.accounts.findIndex(
                item => item.address.toLowerCase() === address.toLowerCase()
            );
            if (index < 0) {
                err = new ProcessingError(`Blockchain account ${address} does not exist`, null, 'WF_API_NO_RESOURCE');
            } else {
                resBody.meta.account = address;
                resBody.meta.info = array.addItem(resBody.meta.info, 'Blockchain account details');
                resData = blockchainState.accounts[index];
            }
        }
        // Send response using common endpoint response function
        return response.sendIndicative(res, err, resBody, resData, callback);
    });
}

/**
 * Creates account on specified blockchain
 * @function createAccount
 * @alias module:lib/operations/blockchains.createAccount
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function createAccount(req, res, operationId, callback) {
    const blockchain = req.params.blockchain;
    let secret = req.body.secret || null;
    wfApiBlockchains.createAccount(blockchain, secret, function endpointCreateAccountCb(err, result = {}) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = response.createBody(req, operationId);
        resBody.meta.blockchain = blockchain;

        // Check results
        if (result.address) {
            resBody.meta.resource = `/blockchains/${blockchain}/accounts/${result.address}`;
        } else if (!err) err = new Error('Could not determine address of created blockchain account');
        if (!err) {
            resData = result;
            resBody.meta.account = result.address;
            resBody.meta.info = array.addItem(resBody.meta.info, 'Blockchain account created');
        }
        // Send response using common endpoint response function
        return response.sendImperative(res, err, resBody, resData, callback);
   });
   // Hopefully the garbage collector will do its work
   secret = undefined;
}

/**
 * Updates account on specified blockchain
 * @function updateAccount
 * @alias module:lib/operations/blockchains.updateAccount
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function updateAccount(req, res, operationId, callback) {
    const blockchain = req.params.blockchain;
    const address = req.params.account;
    const account = req.body;
    wfApiBlockchains.updateAccount(account, address, blockchain, function endpointUpdateAccountCb(err, result) {
         // Create response body and preserve information before responding
        let resData = {};
        let resBody = response.createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err && !result) resBody.meta.warnings = array.addItem(resBody.meta.warnings, 'No errors occured when updating blockchain account, but did not receive result');
        if (!err) resBody.meta.blockchain = blockchain;
        if (!err && result) {
            resData = result;
            resBody.meta.account = address;
            resBody.meta.info = array.addItem(resBody.meta.info, 'Blockchain account updated');
        }
        return response.sendImperative(res, err, resBody, resData, callback);
    });
}

/**
 * Deletes account on specified blockchain
 * @function deleteAccount
 * @alias module:lib/operations/blockchains.deleteAccount
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function deleteAccount(req, res, operationId, callback) {
    const blockchain = req.params.blockchain;
    const address = req.params.account;
    wfApiBlockchains.deleteAccount(address, blockchain, function endpointDeleteAccountCb(err, result) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = response.createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err && !result) resBody.meta.warnings = array.addItem(resBody.meta.warnings, 'No errors occured when deleting blockchain account, but did not receive result');
        if (!err) resBody.meta.blockchain = blockchain;
        if (!err && result) {
            resData = result;
            resBody.meta.account = address;
            resBody.meta.info = array.addItem(resBody.meta.info, 'Blockchain account deleted');
        }
        return response.sendImperative(res, err, resBody, resData, callback);
    });
}

/**
 * Requests a Whiteflag authentication signature
 * @function createSignature
 * @alias module:lib/operations/blockchains.createSignature
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function createSignature(req, res, operationId, callback) {
    const blockchain = req.params.blockchain;
    const address = req.params.account;
    const signPayload = req.body;
    wfAuthenticate.sign(signPayload, address, blockchain, function endpointCreateSignatureCb(err, wfSignature, wfSignDecoded) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err) resBody.meta.blockchain = blockchain;
        if (!err && (!wfSignature || !wfSignDecoded)) err = new Error('Did not receive valid signature from blockchain');
        if (wfSignDecoded) {
            resBody.meta.account = address;
            resBody.meta.decoded = wfSignDecoded;
        }
        return response.sendImperative(res, err, resBody, wfSignature, callback);
    });
}

/**
 * Transfers value from onse blockchain address to an other address
 * @function transferFunds
 * @alias module:lib/operations/blockchains.transferFunds
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function transferFunds(req, res, operationId, callback) {
    const blockchain = req.params.blockchain;
    const address = req.params.account;
    const transfer = req.body;
    wfApiBlockchains.transferFunds(transfer, address, blockchain, function endpointTransferFundsCb(err, txHash) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = response.createBody(req, operationId);
        resBody.meta.blockchain = blockchain;
        resBody.meta.account = address;

        // Send response using common endpoint response function
        if (!err) resBody.meta.transfer = transfer;
        if (!err && !txHash) err = new Error('Could not determine transaction hash after value transfer');
        if (txHash) {
            resData = { transactionHash: txHash };
            resBody.meta.info = array.addItem(resBody.meta.info, 'Value transfered');
        }
        return response.sendImperative(res, err, resBody, resData, callback);
    });
}
