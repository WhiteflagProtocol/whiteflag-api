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
        createAccount(null)
        .then(account => {
            log.info(_blockchainName, `Ethereum account created automatically: ${account.address}`);
        })
        .catch(err => log.warn(_blockchainName, err.message));
    }
    // Periodically update account balances
    updateAccounts(); setInterval(updateAccounts, STATUSINTERVAL);

    // Succesfully completed initialisation
    return Promise.resolve();
}

/**
 * Gets Ethereum account from the blockchain state by address
 * @function getAccount
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
        let account;
        try {
            if (privateKey) {
                log.trace(_blockchainName, 'Creating Ethereum account from existing private key');
                account = generateAccount(_web3.eth.accounts.privateKeyToAccount(formatHexEthereum(privateKey)));
                updateAccountBalance(account);
                updateAccountTransactions(account);
            } else {
                log.trace(_blockchainName, 'Creating new Ethereum account with generated keys');
                account = generateAccount(_web3.eth.accounts.create(crypto.randomBytes(64)));
                account.balance = 0;
                account.transactionCount = 0;
            }
            // Hopefully the garbage collector will do its work
            privateKey = undefined;
        } catch(err) {
            privateKey = undefined;
            log.error(_blockchainName, `Error while creating new Ethereum account: ${err.message}`);
            return reject(err);
        }
        // Check for existing account and store account
        getAccount(account.address)
        .then(existingAccount => {
            if (existingAccount.address === account.address) {
                return reject(new ProcessingError(`The ${_blockchainName} account already exists: ${account.address}`, null, 'WF_API_RESOURCE_CONFLICT'));
            }
        })
        .catch(err => ignore(err)); // all good if account does not yet exist

        // Save and return result
        upsertAccount(account);
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
    log.trace(_blockchainName, `Updating Ethereum account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Update only if account exists
        getAccount(account.address)
        .then(existingAccount => {
            // Double check addresses
            if (existingAccount.address !== account.address) {
                return reject(new Error(`Address of ${_blockchainName} account in state does not correspond with updated account data address`));
            }
            // Upsert updated account data
            try {
                upsertAccount(account);
            } catch(err) {
                return reject(new Error(`Could not update ${_blockchainName} account: ${err.message}`));
            }
            return resolve(account);
        })
        .catch(err => reject(err));
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
    log.trace(_blockchainName, `Deleting Ethereum account: ${address}`);
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
            return reject(new Error(`Could not not delete ${_blockchainName} account: ${address}`));
        }
        // Log and return result
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
        Promise.all([
            updateAccountBalance(account),
            updateAccountTransactions(account)
        ])
        .then(() => {
            wfState.updateBlockchainData(_blockchainName, _ethState);
        });
    });
}

/**
 * Updates all Ethereum blockchain accounts
 * @private
 * @param {Object} account
 * @returns {Promise}
 */
function updateAccountBalance(account) {
    return ethRpc.getBalance(account.address)
    .then(balance => {
        account.balance = _web3.utils.fromWei(balance, 'ether');
        return Promise.resolve(account.balance);
    })
    .catch(err => log.warn(_blockchainName, `Could not update balance for account ${account.address}: ${err.message}`));
}

 /**
 * Updates all Ethereum blockchain accounts
 * @private
 * @param {Object} account
 * @returns {Promise}
 */
function updateAccountTransactions(account) {
    return ethRpc.getTransactionCount(account.address)
    .then(transactionCount => {
        account.transactionCount = transactionCount;
        return Promise.resolve(account.transactionCount);
    })
    .catch(err => log.warn(_blockchainName, `Could not update transaction count for account ${account.address}: ${err.message}`));
}

/**
 * Updates or inserts an Ethereum account in the blockchain state
 * @private
 * @param {Object} account Ethereum account to be upserted
 */
function upsertAccount(account) {
    // Securely store the private key in state
    if (Object.prototype.hasOwnProperty.call(account, 'privateKey')) {
        const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
        wfState.upsertKey('blockchainKeys', privateKeyId, formatHexApi(account.privateKey));
        delete account.privateKey;
    }
    // Inserting or updating
    let existingAccount = _ethState.accounts.find(item => item.address === account.address);
    if (!existingAccount) {
        // Insert new account
        _ethState.accounts.push(account);
        log.trace(_blockchainName, `New Ethereum account added to state: ${account.address}`);
    } else {
        // Update account
        object.update(account, existingAccount);
        log.trace(_blockchainName, `Ethereum account updated in state: ${account.address}`);
    }
    wfState.updateBlockchainData(_blockchainName, _ethState);
}

/**
 * Generate account from keypair
 * @private
 * @param {Object} newEthAccount a new Web3 Ethereum account
 * @returns {Object} the account data
 */
 function generateAccount(newEthAccount) {
    const publicKey = ethereumUtil.privateToPublic(Buffer.from(formatHexApi(newEthAccount.privateKey), BINENCODING));
    return {
        address: formatAddressApi(newEthAccount.address),
        publicKey: formatPubkeyApi(publicKey.toString(BINENCODING)),
        privateKey: formatHexApi(newEthAccount.privateKey),
        balance: null,
        transactionCount: null
    };
}
