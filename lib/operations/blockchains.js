'use strict';
/**
 * @module lib/operations/blockchains
 * @summary Whiteflag API blockchains endpoints handler module
 * @description Module with api blockchains endpoint handlers
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
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
const  arr = require('../_common/arrays');
const { ProcessingError } = require('../_common/errors');
const { createBody,
        sendImperative,
        sendIndicative } = require('./_common/response');

// Whiteflag modules //
const wfBlockchains = require('../blockchains');
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
    wfState.getBlockchains(function opsGetBlockchainsCb(err, blockchainsState = null) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId);
        let resData = [];

        // Send response using common endpoint response function
        if (!err && !blockchainsState) err = new Error('Could not retrieve blockchains');
        if (blockchainsState) {
            resBody.meta.info = arr.addItem(resBody.meta.info, 'Current blockchains in state');
            resData = Object.keys(blockchainsState);
        }
        return sendIndicative(res, err, resBody, resData, callback);
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
    wfState.getBlockchainData(blockchain, function opsGetBlockchainCb(err, bcState = null) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err && !bcState) err = new ProcessingError(`Blockchain ${blockchain} does not exist`, null, 'WF_API_NO_RESOURCE');
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.info = arr.addItem(resBody.meta.info, `Current ${blockchain} state`);
        }
        return sendIndicative(res, err, resBody, bcState, callback);
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
    let resBody = createBody(req, operationId);

    // Check query
    let queryErrors = []
    if (!req.query?.from) queryErrors.push('Query parameter \'from\' is missing');
    if (!req.query?.to) queryErrors.push('Query parameter \'to\' is missing');
    if (queryErrors.length > 0) {
        const err = new ProcessingError('Request is not a valid query', queryErrors, 'WF_API_BAD_REQUEST');
        return sendImperative(res, err, resBody, null, callback)
    }
    // Scan blocks
    wfBlockchains.scanBlocks(Number(req.query.from), Number(req.query.to), blockchain, function opsScanBlocksCb(err, wfMessages = []) {
        // Prepare response
        let resData = [];
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.query = req.query;
            resBody.meta.info = arr.addItem(resBody.meta.info, `Found ${wfMessages.length} Whiteflag messages on the blockchain between blocks ${req.query.from} and ${req.query.to}`);
            resData = wfMessages;
        }
        // Send response using common endpoint response function
        return sendIndicative(res, err, resBody, resData, callback);
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
    wfState.getBlockchainData(blockchain, function opsGetAccountsCb(err, bcState = null) {
        // Create response body and preserve information before responding
        let resData = [];
        let resBody = createBody(req, operationId);

        // Extract account data from blockchain state
        if (!err && !bcState) err = new ProcessingError(`Blockchain ${blockchain} does not exist`, null, 'WF_API_NO_RESOURCE');
        if (!err) resBody.meta.blockchain = blockchain;
        if (!err && !bcState.accounts) err = new Error(`Could not retrieve accounts for ${blockchain}`);
        if (!err) {
            resData = arr.pluck(bcState.accounts, 'address') || [];
            resBody.meta.info = arr.addItem(resBody.meta.info, `Blockchain accounts on ${blockchain}`);
        }
        // Send response using common endpoint response function
        return sendIndicative(res, err, resBody, resData, callback);
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
    wfState.getBlockchainData(blockchain, function opsGetAccountCb(err, bcState = null) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = createBody(req, operationId);

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
                resBody.meta.info = arr.addItem(resBody.meta.info, 'Blockchain account details');
                resData = bcState.accounts[index];
            }
        }
        // Send response using common endpoint response function
        return sendIndicative(res, err, resBody, resData, callback);
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
    wfBlockchains.createAccount(blockchain, secret, function opsCreateAccountCb(err, result) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = createBody(req, operationId);

        // Check results
        if (result?.address) {
            resBody.meta.resource = `/blockchains/${blockchain}/accounts/${result.address}`;
        } else if (!err) {
            err = new Error('Could not determine address of created blockchain account');
        }
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.account = result.address;
            resBody.meta.info = arr.addItem(resBody.meta.info, 'Blockchain account created');
            resData = result;
        }
        // Send response using common endpoint response function
        return sendImperative(res, err, resBody, resData, callback);
   });
   secret = null;
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
    wfBlockchains.updateAccount(account, address, blockchain, function opsUpdateAccountCb(err, result) {
         // Create response body and preserve information before responding
        let resData = {};
        let resBody = createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.account = address;
            if (result) {
                resBody.meta.info = arr.addItem(resBody.meta.info, 'Blockchain account updated');
                resData = result;
            } else {
                resBody.meta.warnings = arr.addItem(resBody.meta.warnings, 'Did not receive result of account update');
            }
        }
        return sendImperative(res, err, resBody, resData, callback);
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
    wfBlockchains.deleteAccount(address, blockchain, function opsDeleteAccountCb(err, result) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.account = address;
            if (result) {
                resBody.meta.info = arr.addItem(resBody.meta.info, 'Blockchain account deleted');
                resData = result;
            } else {
                resBody.meta.warnings = arr.addItem(resBody.meta.warnings, 'Did not receive result of account deletion');
            }
        }
        return sendImperative(res, err, resBody, resData, callback);
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
    wfAuthenticate.sign(signPayload, address, blockchain, function opsCreateSignatureCb(err, wfSignature, wfSignDecoded) {
        // Create response body and preserve information before responding
        let resBody = createBody(req, operationId);

        // Send response using common endpoint response function
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.account = address;
            if (!wfSignature || !wfSignDecoded) {
                err = new Error('Did not receive valid signature for blockchain account');
            }
        }
        if (wfSignDecoded) {
            resBody.meta.decoded = wfSignDecoded;
        }
        return sendImperative(res, err, resBody, wfSignature, callback);
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
    wfBlockchains.transferFunds(transfer, address, blockchain, function opsTransferFundsCb(err, txHash, blockNumber) {
        // Create response body and preserve information before responding
        let resData = {};
        let resBody = createBody(req, operationId);

        // Check results and send response using common endpoint response function
        if (!err) {
            resBody.meta.blockchain = blockchain;
            resBody.meta.account = address;
            resData = transfer;
            if (txHash) {
                resData.transactionHash = txHash;
            } else {
                resBody.meta.warnings = arr.addItem(resBody.meta.warnings, 'Could not retrieve transaction hash');
            }
            if (blockNumber) resData.blockNumber = blockNumber;
        }
        return sendImperative(res, err, resBody, resData, callback);
    });
}
