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
    scanBlocks,
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
    wfState.getBlockchainData(blockchain, function endpointGetBlockchainCb(err, bcState = null) {
        // Create response body and preserve information before responding
        let resBody = response.createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err && !bcState) err = new ProcessingError(`Blockchain ${blockchain} does not exist`, null, 'WF_API_NO_RESOURCE');
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.info = array.addItem(resBody.meta.info, `Current ${blockchain} state`);
        }
        return response.sendIndicative(res, err, resBody, bcState, callback);
    });
}

/**
 * Scans a number of blocks for Whiteflag messages
 * @function getBlockchain
 * @alias module:lib/operations/blockchains.scanBlocks
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function scanBlocks(req, res, operationId, callback) {
    const blockchain = req.params.blockchain;
    let resBody = response.createBody(req, operationId);

    // Check query
    let queryErrors = []
    if (!req.query?.from) queryErrors.push('Query parameter \'from\' is missing');
    if (!req.query?.to) queryErrors.push('Query parameter \'to\' is missing');
    if (queryErrors.length > 0) {
        const err = new ProcessingError('Request is not a valid query', queryErrors, 'WF_API_BAD_REQUEST');
        return response.sendImperative(res, err, resBody, null, callback)
    }
    // Scan blocks
    wfApiBlockchains.scanBlocks(Number(req.query.from), Number(req.query.to), blockchain, function endpointScanBlocksCb(err, wfMessages = []) {
        // Prepare response
        let resData = [];
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.query = req.query;
            resBody.meta.info = array.addItem(resBody.meta.info, `Found ${wfMessages.length} Whiteflag messages on the blockchain between blocks ${req.query.from} and ${req.query.to}`);
            resData = wfMessages;
        }
        // Send response using common endpoint response function
        return response.sendIndicative(res, err, resBody, resData, callback);
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
    wfState.getBlockchainData(blockchain, function endpointGetAccountsCb(err, bcState = null) {
        // Create response body and preserve information before responding
        let resData = [];
        let resBody = response.createBody(req, operationId);

        // Extract account data from blockchain state
        if (!err && !bcState) err = new ProcessingError(`Blockchain ${blockchain} does not exist`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.blockchain = blockchain;
        if (!err && !bcState.accounts) err = new Error(`Could not retrieve accounts for ${blockchain}`);
        if (!err) {
            resData = array.pluck(bcState.accounts, 'address') || [];
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
    wfState.getBlockchainData(blockchain, function endpointGetAccountCb(err, bcState = null) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = response.createBody(req, operationId);

        // Get the requested account object
        if (!err && !bcState) err = new ProcessingError(`Blockchain ${blockchain} does not exist`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.blockchain = blockchain;
        if (!err && !bcState.accounts) err = new Error(`Could not retrieve accounts for ${blockchain}`);
        if (!err) {
            const index = bcState.accounts.findIndex(
                item => item.address.toLowerCase() === address.toLowerCase()
            );
            if (index < 0) {
                err = new ProcessingError(`Blockchain account ${address} does not exist`, null, 'WF_API_NO_RESOURCE');
            } else {
                resBody.meta.account = address;
                resBody.meta.info = array.addItem(resBody.meta.info, 'Blockchain account details');
                resData = bcState.accounts[index];
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

        // Check results
        if (result.address) {
            resBody.meta.resource = `/blockchains/${blockchain}/accounts/${result.address}`;
        } else if (!err) err = new Error('Could not determine address of created blockchain account');
        if (!err) {
            resData = result;
            resBody.meta.blockchain = blockchain;
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
    wfApiBlockchains.transferFunds(transfer, address, blockchain, function endpointTransferFundsCb(err, txHash, blockNumber) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = response.createBody(req, operationId);

        // Check results and send response using common endpoint response function
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.account = address;
            resData = transfer;
            if (txHash) resData.transactionHash = txHash;
                else resBody.meta.warnings = array.addItem(resBody.meta.warnings, 'Could not retrieve transaction hash');
            if (blockNumber) resData.blockNumber = blockNumber;
        }
        return response.sendImperative(res, err, resBody, resData, callback);
    });
}
