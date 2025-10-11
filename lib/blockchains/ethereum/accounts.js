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
    delete: deleteAccount,
    test: {
        createAccountEntry
    }
};

// Node.js core and external modules //
const crypto = require('crypto');
const web3Accounts = require('web3-eth-accounts');
const web3Utils = require('web3-utils');

// Common internal functions and classes //
const log = require('../../_common/logger');
const object = require('../../_common/objects');
const { ignore } = require('../../_common/processing');
const { ProcessingError } = require('../../_common/errors');
const { bufferToHex, hexToBuffer } = require('../../_common/encoding');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Common blockchain functions //
const { getPrivateKeyId } = require('../_common/keys');
const { withHexPrefix,
        noHexPrefix,
        noAddressHexPrefix,
        noPubkeyHexPrefix
    } = require('../_common/format');

// Ethereum sub-modules //
const ethRpc = require('./rpc');

// Module constants //
const MODULELOG = 'ethereum';
const STATUSINTERVAL = 60000; // Every minute

// Module variables //
let _ethChain;
let _ethState;
let _accountScheduleId;

/**
 * Initialises Ethereum accounts management
 * @function initAccounts
 * @alias module:lib/blockchains/ethereum/accounts.init
 * @param {Object} ethConfig the Ethereum blockchain configuration
 * @param {Object} ethState the Ethereum blockchain state
 * @param {Object} ethApi the Ethereum Web3 API instance
 * @returns {Promise} resolves if succesfully initialised
 */
async function initAccounts(ethConfig, ethState) {
    log.trace(MODULELOG, 'Initialising Ethereum accounts management');
    _ethChain = ethConfig.name;
    _ethState = ethState;

    // If configured, create new account if none exists
    if (ethConfig.createAccount && _ethState.accounts.length === 0) {
        createAccount(null)
        .then(account => {
            log.info(MODULELOG, `Automatically created first ${_ethChain} account: ${account.address}`);
        })
        .catch(err => log.warn(MODULELOG, err.message));
    }
    // Periodically update account balances
    scheduleAccountsUpdate();

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
            return reject(new ProcessingError(`No existing ${_ethChain} account with address: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        resolve(account);
    });
}

/**
 * Creates a new Ethereum blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/ethereum.createAccount
 * @param {string} [privateKey] hexadecimal string with private key (without 0x prefix)
 * @returns {Promise} resolves to newly created account
 */
function createAccount(privateKey = null) {
    return new Promise((resolve, reject) => {
        let account;
        try {
            account = createAccountEntry(privateKey);
        } catch(err) {
            privateKey = undefined;
            log.error(MODULELOG, `Error while creating new ${_ethChain} account: ${err.message}`);
            return reject(err);
        }
        if (privateKey) {
            privateKey = undefined;
            updateAccountBalance(account);
            updateAccountTransactions(account);
        } else {
            account.balance = 0;
            account.transactionCount = 0;
        }
        // Check for existing account and store account
        getAccount(account.address)
        .then(existingAccount => {
            if (existingAccount.address === account.address) {
                return reject(new ProcessingError(`The ${_ethChain} account already exists: ${account.address}`, null, 'WF_API_RESOURCE_CONFLICT'));
            }
        })
        .catch(err => ignore(err)); // all good if account does not yet exist

        // Save account, reschedule account updates and return result
        upsertAccount(account);
        scheduleAccountsUpdate();
        return resolve(account);
    });
}

/**
 * Updates Ethereum blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/ethereum.updateAccount
 * @param {wfAccount} account the account information including address to be updated
 * @returns {Promise} resolves to updated account
 */
function updateAccount(account) {
    log.trace(MODULELOG, `Updating Ethereum account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Update only if account exists
        getAccount(account.address)
        .then(existingAccount => {
            // Double check addresses
            if (existingAccount.address !== account.address) {
                return reject(new Error(`Address of ${_ethChain} account in state does not correspond with updated account data address`));
            }
            // Upsert updated account data
            try {
                upsertAccount(account);
            } catch(err) {
                return reject(new Error(`Could not update ${_ethChain} account: ${err.message}`));
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
    log.trace(MODULELOG, `Deleting Ethereum account: ${address}`);
    return new Promise((resolve, reject) => {
        // Get index of account
        const index = _ethState.accounts.findIndex(item => item.address === address);
        if (index < 0) {
            return reject(new ProcessingError(`Could not find ${_ethChain} account: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        // Remove account from state after double check
        const account = _ethState.accounts[index];
        if (account.address === address) {
            _ethState.accounts.splice(index, 1);
            wfState.updateBlockchainData(_ethChain, _ethState);
        } else {
            return reject(new Error(`Could not not delete ${_ethChain} account: ${address}`));
        }
        // Reschedule account updates and return result
        scheduleAccountsUpdate();
        return resolve(account);
    });
}

// PRIVATE ACCOUNT FUNCTIONS //
/**
 * Create account entry from private key or random
 * @private
 * @param {string} [privateKey] hexadecimal string with private key (without 0x prefix)
 * @returns {Object} the account data
 */
 function createAccountEntry(privateKey = null) {
    let ethAccount;
    if (privateKey) {
        log.trace(MODULELOG, `Creating ${_ethChain} account from existing private key`);
        ethAccount = web3Accounts.privateKeyToAccount(withHexPrefix(privateKey));
    } else {
        log.trace(MODULELOG, `Creating new ${_ethChain} account with generated keys`);
        ethAccount = web3Accounts.create(crypto.randomBytes(64));
    }
    const publicKey = web3Accounts.privateKeyToPublicKey(hexToBuffer(noHexPrefix(ethAccount.privateKey)));
    return {
        address: noAddressHexPrefix(ethAccount.address),
        publicKey: noPubkeyHexPrefix(bufferToHex(publicKey)),
        privateKey: noHexPrefix(ethAccount.privateKey),
        balance: null,
        transactionCount: null
    };
}

/**
 * Stops any currently scheduled account updates and reschedules
 * @private
 */
function scheduleAccountsUpdate() {
    if (_accountScheduleId) clearInterval(_accountScheduleId);
    _accountScheduleId = setInterval(updateAccounts, STATUSINTERVAL);
}


/**
 * Updates all Ethereum blockchain accounts
 * @private
 */
function updateAccounts() {
    let updateBatch = [];
    _ethState.accounts.forEach(account => {
        updateBatch.push(updateAccountStatus(account));
    })
    return Promise.allSettled(updateBatch)
    .then(() => {
        wfState.updateBlockchainData(_ethChain, _ethState);
    });
}

/**
 * Updates a Ethereum blockchain account status
 * @private
 * @param {wfAccount} account the account to be updated
 * @returns {Promise}
 */
function updateAccountStatus(account) {
    log.trace(MODULELOG, `Updating balance and transaction count of account: ${account.address}`);
    return Promise.allSettled([
        updateAccountBalance(account),
        updateAccountTransactions(account)
    ]);
}

/**
 * Updates the balance of an Ethereum blockchain account
 * @private
 * @param {wfAccount} account
 * @returns {Promise}
 */
function updateAccountBalance(account) {
    log.trace(MODULELOG, `Updating balance of ${_ethChain} account: ${account.address}`);
    return ethRpc.getBalance(account.address)
    .then(balance => {
        const newBalance = web3Utils.fromWei(balance, 'ether')
        const diffBalance = newBalance - account.balance;
        if (diffBalance < 0) {
            log.info(MODULELOG, `Account ${account.address} spent ${-diffBalance} ether`);
        } else if (diffBalance > 0) {
            log.info(MODULELOG, `Account ${account.address} received ${diffBalance} ether`);
        }
        account.balance = newBalance;
        return Promise.resolve(account.balance);
    })
    .catch(err => log.warn(MODULELOG, `Could not update balance for account ${account.address}: ${err.message}`));
}

 /**
 * Updates the number of transactions of an Ethereum blockchain account
 * @private
 * @param {wfAccount} account
 * @returns {Promise}
 */
function updateAccountTransactions(account) {
    log.trace(MODULELOG, `Updating transaction count of ${_ethChain} account: ${account.address}`);
    return ethRpc.getTransactionCount(account.address)
    .then(transactionCount => {
        account.transactionCount = transactionCount;
        return Promise.resolve(account.transactionCount);
    })
    .catch(err => log.warn(MODULELOG, `Could not update transaction count for ${_ethChain} account ${account.address}: ${err.message}`));
}

/**
 * Updates or inserts an Ethereum account in the blockchain state
 * @private
 * @param {wfAccount} account Ethereum account to be upserted
 */
function upsertAccount(account) {
    // Securely store the private key in state
    if (Object.hasOwn(account, 'privateKey')) {
        const privateKeyId = getPrivateKeyId(_ethChain, noAddressHexPrefix(account.address));
        wfState.upsertKey('blockchainKeys', privateKeyId, noHexPrefix(account.privateKey));
        delete account.privateKey;
    }
    // Inserting or updating
    let existingAccount = _ethState.accounts.find(item => item.address === account.address);
    if (!existingAccount) {
        // Insert new account
        _ethState.accounts.push(account);
        log.trace(MODULELOG, `Added new ${_ethChain} account to state: ${account.address}`);
    } else {
        // Update account
        object.update(account, existingAccount);
        log.trace(MODULELOG, `Updated ${_ethChain} account in state: ${account.address}`);
    }
    wfState.updateBlockchainData(_ethChain, _ethState);
}
