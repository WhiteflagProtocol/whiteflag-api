'use strict';
/**
 * @module lib/blockchains/fennel/accounts
 * @summary Whiteflag API Fennel accounts module
 * @description Module for managing Fennel accounts for Whiteflag
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
const fnlCrypto = require('@polkadot/util-crypto');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const object = require('../../common/objects');
const { hash } = require('../../common/crypto');
const { ignore } = require('../../common/processing');
const { ProcessingError } = require('../../common/errors');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Fennel sub-modules //
const fnlRpc = require('./rpc');
const { noKeyHexPrefix,
        noPubkeyHexPrefix
    } = require('../common/format');

// Module constants //
const STATUSINTERVAL = 60000; // Every minute
const BINENCODING = 'hex';
const KEYIDLENGTH = 12;
const SEEDBYTELENGTH = 32;

// Module variables //
let _fnlName = 'fennel';
let _fnlState;

/**
 * Initialises Fennel accounts management
 * @function initAccounts
 * @alias module:lib/blockchains/fennel/accounts.init
 * @param {Object} fnlConfig the Fennel blockchain configuration
 * @param {Object} fnlState the Fennel blockchain state
 * @param {Object} fnlApi the Fennel API instance
 * @returns {Promise} resolves if succesfully initialised
 */
async function initAccounts(fnlConfig, fnlState) {
    _fnlName = fnlConfig.name;
    _fnlState = fnlState;
    log.trace(_fnlName, 'Initialising Fennel accounts management...');

    // If configured, create new account if none exists
    if (fnlConfig.createAccount && _fnlState.accounts.length === 0) {
        createAccount(null)
        .then(account => {
            log.info(_fnlName, `Fennel account created automatically: ${account.address}`);
        })
        .catch(err => log.warn(_fnlName, err.message));
    }
    // Periodically update account balances
    // WIP: updateAccounts(); setInterval(updateAccounts, STATUSINTERVAL);

    // Succesfully completed initialisation
    return Promise.resolve();
}

/**
 * Gets Fennel account from the blockchain state by address
 * @function getAccount
 * @alias module:lib/blockchains/fennel/accounts.get
 * @param {string} address the account address
 * @returns {Promise} resolves to the requested account
 */
function getAccount(address = null) {
    return new Promise((resolve, reject) => {
        let account = _fnlState.accounts.find(item => item.address === address);
        if (!account) {
            return reject(new ProcessingError(`No existing ${_fnlName} account with address: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        resolve(account);
    });
}

/**
 * Creates a new Fennel blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/fennel.createAccount
 * @param {string} [seed] hexadecimal encoded secret seed
 * @returns {Promise} resolves to newly created account
 */
function createAccount(seed = null) {
    return new Promise((resolve, reject) => {
        let account;
        try {
            if (seed) {
                log.trace(_fnlName, 'Creating Fennel account from existing private key');
                const seedBuffer = Buffer.from(seed, BINENCODING);
                account = createAccountEntry(fnlCrypto.sr25519PairFromSeed(seedBuffer));
                // WIP: updateAccountBalance(account);
                // WIP: updateAccountTransactions(account);
            } else {
                log.trace(_fnlName, 'Creating new Fennel account with generated secret key');
                const seedBuffer = crypto.randomBytes(SEEDBYTELENGTH);
                account = createAccountEntry(fnlCrypto.sr25519PairFromSeed(seedBuffer));
                account.balance = 0;
                account.transactionCount = 0;
            }
            // Hopefully the garbage collector will do its work
            seed = undefined;
        } catch(err) {
            seed = undefined;
            log.error(_fnlName, `Error while creating new Fennel account: ${err.message}`);
            return reject(err);
        }
        // Check for existing account and store account
        getAccount(account.address)
        .then(existingAccount => {
            if (existingAccount.address === account.address) {
                return reject(new ProcessingError(`The ${_fnlName} account already exists: ${account.address}`, null, 'WF_API_RESOURCE_CONFLICT'));
            }
        })
        .catch(err => ignore(err)); // all good if account does not yet exist

        // Save and return result
        upsertAccount(account);
        return resolve(account);
    });
}

/**
 * Updates Fennel blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/fennel.updateAccount
 * @param {Object} account the account information including address to be updated
 * @returns {Promise} resolves to updated account
 */
function updateAccount(account) {
    log.trace(_fnlName, `Updating Fennel account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Update only if account exists
        getAccount(account.address)
        .then(existingAccount => {
            // Double check addresses
            if (existingAccount.address !== account.address) {
                return reject(new Error(`Address of ${_fnlName} account in state does not correspond with updated account data address`));
            }
            // Upsert updated account data
            try {
                upsertAccount(account);
            } catch(err) {
                return reject(new Error(`Could not update ${_fnlName} account: ${err.message}`));
            }
            return resolve(account);
        })
        .catch(err => reject(err));
    });
}

/**
 * Deletes Fennel blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/fennel.deleteAccount
 * @param {string} address the address of the account to be deleted
 * @returns {Promise} resolves to updated account
 */
function deleteAccount(address) {
    log.trace(_fnlName, `Deleting Fennel account: ${address}`);
    return new Promise((resolve, reject) => {
        // Get index of account
        const index = _fnlState.accounts.findIndex(item => item.address === address);
        if (index < 0) {
            return reject(new ProcessingError(`Could not find ${_fnlName} account: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        // Remove account from state after double check
        const account = _fnlState.accounts[index];
        if (account.address === address) {
            _fnlState.accounts.splice(index, 1);
            wfState.updateBlockchainData(_fnlName, _fnlState);
        } else {
            return reject(new Error(`Could not not delete ${_fnlName} account: ${address}`));
        }
        // Log and return result
        return resolve(account);
    });
}

// PRIVATE ACCOUNT FUNCTIONS //
/**
 * Updates all Fennel blockchain accounts
 * @private
 */
function updateAccounts() {
    _fnlState.accounts.forEach(account => {
        Promise.all([
            updateAccountBalance(account),
            updateAccountTransactions(account)
        ])
        .then(() => {
            wfState.updateBlockchainData(_fnlName, _fnlState);
        });
    });
}

/**
 * Updates the balance of a Fennel blockchain account
 * @private
 * @param {Object} account
 * @returns {Promise}
 */
function updateAccountBalance(account) {
    log.trace(_fnlName, `Updating balance of account: ${account.address}`);
    return fnlRpc.getBalance(account.address)
    .then(balance => {
        account.balance = balance;
        return Promise.resolve(account.balance);
    })
    .catch(err => log.warn(_fnlName, `Could not update balance for account ${account.address}: ${err.message}`));
}

 /**
 * Updates the number of transactions of a Fennel blockchain account
 * @private
 * @param {Object} account
 * @returns {Promise}
 */
function updateAccountTransactions(account) {
    log.trace(_fnlName, `Updating transaction count of account: ${account.address}`);
    return fnlRpc.getTransactionCount(account.address)
    .then(transactionCount => {
        account.transactionCount = transactionCount;
        return Promise.resolve(account.transactionCount);
    })
    .catch(err => log.warn(_fnlName, `Could not update transaction count for account ${account.address}: ${err.message}`));
}

/**
 * Updates or inserts an Fennel account in the blockchain state
 * @private
 * @param {Object} account Fennel account to be upserted
 */
function upsertAccount(account) {
    // Securely store the private key in state
    if (Object.hasOwn(account, 'privateKey')) {
        const privateKeyId = hash(_fnlName + account.address, KEYIDLENGTH);
        wfState.upsertKey('blockchainKeys', privateKeyId, noKeyHexPrefix(account.privateKey));
        delete account.privateKey;
    }
    // Inserting or updating
    let existingAccount = _fnlState.accounts.find(item => item.address === account.address);
    if (!existingAccount) {
        // Insert new account
        _fnlState.accounts.push(account);
        log.trace(_fnlName, `New Fennel account added to state: ${account.address}`);
    } else {
        // Update account
        object.update(account, existingAccount);
        log.trace(_fnlName, `Fennel account updated in state: ${account.address}`);
    }
    wfState.updateBlockchainData(_fnlName, _fnlState);
}

/**
 * Create account entry from Fennel keypair
 * @private
 * @param {Object} keypair an sr25519 keypair for Fennel
 * @returns {Object} the account data
 */
 function createAccountEntry(keypair) {
    return {
        address: fnlCrypto.encodeAddress(keypair.publicKey),
        publicKey: noPubkeyHexPrefix(Buffer.from(keypair.publicKey).toString('hex')),
        privateKey: noKeyHexPrefix(Buffer.from(keypair.secretKey).toString('hex')),
        balance: null,
        transactionCount: null
    };
}
