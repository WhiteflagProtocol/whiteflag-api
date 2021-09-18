'use strict';
/**
 * @module lib/blockchains/ethereum/accounts
 * @summary Whiteflag API Ethereum accounts module
 * @description Module for managing Ethereum accounts for Whiteflag
 */
module.exports = {
    init: initAccounts,
    get: getAccount,
    create: createAccount,
    update: updateAccount,
    delete: deleteAccount
};

// Node.js core and external modules //
const crypto = require('crypto');
const ethereumUtil = require('ethereumjs-util');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const object = require('../../common/objects');
const { hash } = require('../../common/crypto');
const { ignore } = require('../../common/processing');
const { ProcessingError } = require('../../common/errors');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Ethereum sub-modules //
const ethRpc = require('./rpc');
const { formatHexEthereum, formatHexApi, formatAddressApi, formatPubkeyApi } = require('./common');

// Module constants //
const STATUSINTERVAL = 60000; // Every minute
const BINENCODING = 'hex';
const KEYIDLENGTH = 12;

// Module variables //
let _blockchainName;
let _ethState;
let _web3;

/**
 * Initialises Ethereum accounts management
 * @function initAccounts
 * @alias module:lib/blockchains/ethereum/accounts.init
 * @param {Object} ethConfig the Ethereum blockchain configuration
 * @param {Object} ethState the Ethereum blockchain state
 * @param {Object} web3 the Ethereum Web3 instance
 * @returns {Promise} resolve if succesfully initialised
 */
async function initAccounts(ethConfig, ethState, web3) {
    _blockchainName = ethConfig.name;
    _ethState = ethState;
    _web3 = web3;
    log.trace(_blockchainName, 'Initialising Ethereum accounts management...');

    // If configured, create new account if none exists
    if (ethConfig.createAccount && _ethState.accounts.length === 0) {
        try {
            let account = await createAccount(null);
            ignore(account);
        } catch(err) {
            if (err) log.warn(_blockchainName, err.message);
        }
    }
    // Periodically update account balances
    updateAccounts(); setInterval(updateAccounts, STATUSINTERVAL);

    // Succesfully completed initialisation
    return Promise.resolve();
}

/**
 * Gets Ethereum account from the blockchain state by address
 * @alias module:lib/blockchains/ethereum/accounts.get
 * @param {string} address the account address
 * @returns {Promise} resolves to the requested account
 */
function getAccount(address = null) {
    return new Promise((resolve, reject) => {
        let account = _ethState.accounts.find(item => item.address === address);
        if (!account) {
            return reject(new ProcessingError(`No existing ${_blockchainName} account with address: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        resolve(account);
    });
}

/**
 * Creates a new Ethereum blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/ethereum.createAccount
 * @param {string} [privateKey] hexadecimal encoded private key
 * @returns {Promise} resolves to newly created account
 */
function createAccount(privateKey) {
    return new Promise((resolve, reject) => {
        let newEthAccount;
        try {
            if (privateKey) {
                log.trace(_blockchainName, 'Creating account from existing private key');
                newEthAccount = _web3.eth.accounts.privateKeyToAccount(formatHexEthereum(privateKey));
            } else {
                log.trace(_blockchainName, 'Creating new account with generated keys');
                newEthAccount = _web3.eth.accounts.create(crypto.randomBytes(64));
            }
            // Hopefully the garbage collector will do its work
            privateKey = undefined;
        } catch(err) {
            privateKey = undefined;
            log.error(_blockchainName, `Error while creating new blockchain account: ${err.toString()}`);
            return reject(err);
        }
        // web3 does not expose public key; using ethereumjs-util instead
        const publicKey = ethereumUtil.privateToPublic(Buffer.from(formatHexApi(newEthAccount.privateKey), BINENCODING));
        const account = {
            address: formatAddressApi(newEthAccount.address),
            publicKey: formatPubkeyApi(publicKey.toString(BINENCODING)),
            transactionCount: 0
        };
        // Check for existing account and store account
        const existingAccount = getAccount(account.address);
        if (existingAccount && existingAccount.address === account.address) {
            return reject(new ProcessingError(`A ${_blockchainName} account with address ${account.address} already exists`, null, 'WF_API_RESOURCE_CONFLICT'));
        }
        upsertAccount(account);

        // Securely store the private key in state
        const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
        wfState.upsertKey('blockchainKeys', privateKeyId, formatHexApi(newEthAccount.privateKey));
        delete newEthAccount.privateKey;

        // Log and return result
        log.info(_blockchainName, `Blockchain account created: ${account.address}`);
        return resolve(account);
    });
}

/**
 * Updates Ethereum blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/ethereum.updateAccount
 * @param {Object} account the account information including address to be updated
 * @returns {Promise} resolves to updated account
 */
function updateAccount(account) {
    return new Promise((resolve, reject) => {
        if (!getAccount(account.address)) {
            return reject(new ProcessingError(`${_blockchainName} account does not exist: ${account.address}`), null, 'WF_API_NO_RESOURCE');
        }
        log.trace(_blockchainName, `Updating account: ${account.address}`);

        // Securely store the private key in state
        if (account.privateKey) {
            const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
            wfState.upsertKey('blockchainKeys', privateKeyId, formatHexApi(account.privateKey));
            delete account.privateKey;
        }
        // Update state with new or updated account
        try {
            upsertAccount(account);
        } catch(err) {
            return reject(new Error(`Could not update ${_blockchainName} account: ${err.message}`));
        }
        log.debug(_blockchainName, `Blockchain account updated: ${account.address}`);
        return resolve(account);
    });
}

/**
 * Deletes Ethereum blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/ethereum.deleteAccount
 * @param {string} address the address of the account to be deleted
 * @returns {Promise} resolves to updated account
 */
function deleteAccount(address) {
    log.trace(_blockchainName, `Deleting account: ${address}`);
    return new Promise((resolve, reject) => {
        // Get index of account
        const index = _ethState.accounts.findIndex(item => item.address === address);
        if (index < 0) {
            return reject(new ProcessingError(`Could not find ${_blockchainName} account: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        // Remove account from state after double check
        const account = _ethState.accounts[index];
        if (account.address === address) {
            _ethState.accounts.splice(index, 1);
            wfState.updateBlockchainData(_blockchainName, _ethState);
        } else {
            return reject(new Error(`Could not not delete account: ${address}`));
        }
        // Log and return result
        log.info(_blockchainName, `Blockchain account deleted: ${address}`);
        return resolve(account);
    });
}

// PRIVATE ACCOUNT FUNCTIONS //
/**
 * Updates all Ethereum blockchain accounts
 * @private
 */
 function updateAccounts() {
    _ethState.accounts.forEach(account => {
        ethRpc.getBalance(account.address)
        .then(balance => (account.balance = _web3.utils.fromWei(balance, 'ether')))
        .catch(err => log.warn(_blockchainName, `Could not update balance for account ${account.address}: ${err.message}`));

        ethRpc.getTransactionCount(account.address)
        .then(transactionCount => (account.transactionCount = transactionCount))
        .catch(err => log.warn(_blockchainName, `Could not update transaction count for account ${account.address}: ${err.message}`));
    });
    wfState.updateBlockchainData(_blockchainName, _ethState);
}

/**
 * Updates or inserts an Ethereum account in the blockchain state
 * @private
 * @param {Object} account Ethereum account to be upserted
 */
function upsertAccount(account) {
    // nserting or updating
    let stateAccount = _ethState.accounts.find(item => item.address === account.address);
    if (!stateAccount) {
        // Insert new account
        _ethState.accounts.push(account);
        log.trace(_blockchainName, `Blockchain account added to state: ${account.address}`);
    } else {
        // Update account
        object.update(account, stateAccount);
        log.trace(_blockchainName, `Blockchain account updated in state: ${account.address}`);
    }
    wfState.updateBlockchainData(_blockchainName, _ethState);
}
