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
    delete: deleteAccount,
    sign: getSignature,
    verify: verifySignature
};

// Node.js core and external modules //
const crypto = require('crypto');
const fnlCrypto = require('@polkadot/util-crypto');

// Whiteflag common functions and classes //
const log = require('../../_common/logger');
const object = require('../../_common/objects');
const { hash, zeroise } = require('../../_common/crypto');
const { ignore } = require('../../_common/processing');
const { ProcessingError } = require('../../_common/errors');
const { hexToBuffer } = require('../../_common/encoding');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Fennel sub-modules //
const fnlRpc = require('./rpc');
const { noKeyHexPrefix,
        noPubkeyHexPrefix
    } = require('../_common/format');

// Module constants //
const MODULELOG = 'fennel';
const HEXENCODING= 'hex';
const STATUSINTERVAL = 60000; // Every minute
const KEYIDLENGTH = 12;
const SEEDBYTELENGTH = 32;

// Module variables //
let _fnlChain;
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
    log.trace(MODULELOG, 'Initialising Fennel accounts management');
    _fnlChain = fnlConfig.name;
    _fnlState = fnlState;

    // If configured, create new account if none exists
    if (fnlConfig.createAccount && _fnlState.accounts.length === 0) {
        createAccount(null)
        .then(account => {
            log.info(MODULELOG, `Automatically created first ${_fnlChain} account: ${account.address}`);
        })
        .catch(err => log.warn(MODULELOG, err.message));
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
            return reject(new ProcessingError(`No existing ${_fnlChain} account with address: ${address}`, null, 'WF_API_NO_RESOURCE'));
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
                log.trace(MODULELOG, `Creating ${_fnlChain} account from secret seed`);
                const seedBuffer = hexToBuffer(seed);
                account = createAccountEntry(fnlCrypto.sr25519PairFromSeed(seedBuffer));
                // WIP: updateAccountBalance(account)
                // WIP: updateAccountTransactions(account)
            } else {
                log.trace(MODULELOG, `Creating new ${_fnlChain} account with generated secret key`);
                const seedBuffer = crypto.randomBytes(SEEDBYTELENGTH);
                account = createAccountEntry(fnlCrypto.sr25519PairFromSeed(seedBuffer));
                account.balance = 0;
                account.transactionCount = 0;
            }
            // Hopefully the garbage collector will do its work
            seed = undefined;
        } catch(err) {
            seed = undefined;
            log.error(MODULELOG, `Error while creating new ${_fnlChain} account: ${err.message}`);
            return reject(err);
        }
        // Check for existing account and store account
        getAccount(account.address)
        .then(existingAccount => {
            if (existingAccount.address === account.address) {
                return reject(new ProcessingError(`The ${_fnlChain} account already exists: ${account.address}`, null, 'WF_API_RESOURCE_CONFLICT'));
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
    log.trace(MODULELOG, `Updating ${_fnlChain} account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Update only if account exists
        getAccount(account.address)
        .then(existingAccount => {
            // Double check addresses
            if (existingAccount.address !== account.address) {
                return reject(new Error(`Address of ${_fnlChain} account in state does not correspond with updated account data address`));
            }
            // Upsert updated account data
            try {
                upsertAccount(account);
            } catch(err) {
                return reject(new Error(`Could not update ${_fnlChain} account: ${err.message}`));
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
    log.trace(MODULELOG, `Deleting ${_fnlChain} account: ${address}`);
    return new Promise((resolve, reject) => {
        // Get index of account
        const index = _fnlState.accounts.findIndex(item => item.address === address);
        if (index < 0) {
            return reject(new ProcessingError(`Could not find ${_fnlChain} account: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        // Remove account from state after double check
        const account = _fnlState.accounts[index];
        if (account.address === address) {
            _fnlState.accounts.splice(index, 1);
            wfState.updateBlockchainData(_fnlChain, _fnlState);
        } else {
            return reject(new Error(`Could not not delete ${_fnlChain} account: ${address}`));
        }
        // Log and return result
        return resolve(account);
    });
}

/**
 * Signs an arbitrary input with an account's private key 
 * @todo Complete and test function
 * @function getSignature
 * @alias module:lib/blockchains/fennel.getSignature
 * @param {string} address the address of the account used to sign
 * @param {string} input the input to be signed 
 * @returns {Promise} resolves to the signature
 */
function getSignature(address, input) {
    log.trace(MODULELOG, `Generating signature for address: ${address}`);
    return new Promise((resolve, reject) => {
        getAccount(address)
        .then(account => {
            const privateKeyId = getPrivateKeyId(account.address);
            wfState.getKey('blockchainKeys', privateKeyId, function fnlGetKeyCb(err, privateKey) {
                if (err) reject(err);
                const keypair = createKeypair(account.publicKey, privateKey);
                const signature = toHex(fnlCrypto.sr25519Sign(input, keypair));
                zeroise(keypair.secretKey);
                return resolve(signature);
            });
        })
        .catch(err => reject(err));
    });
}

/**
 * Verifies if the signature is valid for the arbitrary input and address
 * @todo Complete and test function
 * @param {string} address the address of the account used to sign
 * @param {string} input the input that has been signed
 * @param {string} signature the signature to be verified
 * @returns {Promise} resoilves if signature is vlaid
 */
function verifySignature(address, input, signature) {
    return new Promise((resolve, reject) => {
        const publicKey = fnlCrypto.decodeAddress(address);
        const valid = fnlCrypto.sr25519Verify(
            input,
            hexToBuffer(signature),
            publicKey
        );
        if (valid) return resolve();
        return reject(new ProtocolError('Invalid Whiteflag authentication signature', null, 'WF_SIGN_ERROR'));
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
            wfState.updateBlockchainData(_fnlChain, _fnlState);
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
    log.trace(MODULELOG, `Updating balance of account: ${account.address}`);
    return fnlRpc.getBalance(account.address)
    .then(balance => {
        account.balance = balance;
        return Promise.resolve(account.balance);
    })
    .catch(err => log.warn(MODULELOG, `Could not update balance for account ${account.address}: ${err.message}`));
}

 /**
 * Updates the number of transactions of a Fennel blockchain account
 * @private
 * @param {Object} account
 * @returns {Promise}
 */
function updateAccountTransactions(account) {
    log.trace(MODULELOG, `Updating transaction count of ${_fnlChain} account: ${account.address}`);
    return fnlRpc.getTransactionCount(account.address)
    .then(transactionCount => {
        account.transactionCount = transactionCount;
        return Promise.resolve(account.transactionCount);
    })
    .catch(err => log.warn(MODULELOG, `Could not update transaction count for ${_fnlChain} account ${account.address}: ${err.message}`));
}

/**
 * Updates or inserts an Fennel account in the blockchain state
 * @private
 * @param {Object} account Fennel account to be upserted
 */
function upsertAccount(account) {
    // Securely store the private key in state
    if (Object.hasOwn(account, 'privateKey')) {
        const privateKeyId = getPrivateKeyId(account.address);
        wfState.upsertKey('blockchainKeys', privateKeyId, noKeyHexPrefix(account.privateKey));
        delete account.privateKey;
    }
    // Inserting or updating
    let existingAccount = _fnlState.accounts.find(item => item.address === account.address);
    if (!existingAccount) {
        // Insert new account
        _fnlState.accounts.push(account);
        log.trace(MODULELOG, `Added new ${_fnlChain} account to state: ${account.address}`);
    } else {
        // Update account
        object.update(account, existingAccount);
        log.trace(MODULELOG, `Updated ${_fnlChain} account in state: ${account.address}`);
    }
    wfState.updateBlockchainData(_fnlChain, _fnlState);
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
        publicKey: noPubkeyHexPrefix(toHex(keypair.publicKey)),
        privateKey: noKeyHexPrefix(toHex(keypair.secretKey)),
        balance: null,
        transactionCount: null
    };
}

/**
 * Creates a Polkadot keypair from hexadecimal keys
 * @param {string} publicKey 
 * @param {string} secretKey 
 * @returns {Uint8Array} a keypair
 */
function createKeypair(publicKey, secretKey) {
    return {
        publicKey: hexToBuffer(publicKey),
        secretKey: hexToBuffer(secretKey)
    };
}

/**
 * Gets the identifier to get private key from state
 * @private
 * @param {string} address the address of the account
 * @returns {string} a hexadecimal string with the private key id
 */
function getPrivateKeyId(address) {
    return hash(_fnlChain + address, KEYIDLENGTH);
}

/**
 * Encodes a Polkadot binary encoding into a hexadecimal string
 * @private
 * @param {Uint8Array} u8array the binary encoding used by Polkadot
 * @returns {string} a hexadecimal string
 */
function toHex(u8array) {
    return Buffer.from(u8array).toString(HEXENCODING);
}
