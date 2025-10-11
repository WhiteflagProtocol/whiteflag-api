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
    getAddress,
    getPublicKey,
    getKeypair,
    getKeyring,
    sign: getSignature,
    verify: verifySignature,
    test: {
        createAccountEntry,
        createKeypair,
        generateSignature,
        testSignature,
    }
};

// Node.js core and external modules //
const { randomBytes } = require('crypto');
const { Keyring } = require('@polkadot/keyring');
const dotCrypto = require('@polkadot/util-crypto');

// Common internal functions and classes //
const log = require('../../_common/logger');
const object = require('../../_common/objects');
const { zeroise } = require('../../_common/crypto');
const { ignore } = require('../../_common/processing');
const { ProcessingError } = require('../../_common/errors');
const { hexToBuffer,
        hexToU8a,
        u8aToHex } = require('../../_common/encoding');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Common blockchain functions //
const { getPrivateKeyId } = require('../_common/keys');
const { noHexPrefix,
        noPubkeyHexPrefix } = require('../_common/format');

// Fennel sub-modules //
const fnlRpc = require('./rpc');

// Module constants //
const MODULELOG = 'fennel';
const STATUSINTERVAL = 60000; // Every minute
const SEEDBYTELENGTH = 32;
const SIGNALGORITHM = 'sr25519';

// Module variables //
let _fnlChain;
let _fnlState;
let _fnlKeyring;
let _accountScheduleId;

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
    _fnlKeyring = new Keyring({ type: SIGNALGORITHM });

    // If configured, create new account if none exists
    if (fnlConfig.createAccount && _fnlState.accounts.length === 0) {
        createAccount(null)
        .then(account => {
            log.info(MODULELOG, `Automatically created first ${_fnlChain} account: ${account.address}`);
        })
        .catch(err => log.warn(MODULELOG, err.message));
    }
    // Periodically update account balances
    scheduleAccountsUpdate();

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
            account = createAccountEntry(seed);
        } catch(err) {
            seed = undefined;
            log.error(MODULELOG, `Error while creating new ${_fnlChain} account: ${err.message}`);
            return reject(err);
        }
        if (seed) {
            seed = undefined;
            updateAccountStatus(account)
        } else {
            account.balance = 0;
            account.transactionCount = 0;
        }
        // Check for existing account and store account
        getAccount(account.address)
        .then(existingAccount => {
            if (existingAccount.address === account.address) {
                return reject(new ProcessingError(`The ${_fnlChain} account already exists: ${account.address}`, null, 'WF_API_RESOURCE_CONFLICT'));
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
 * Updates Fennel blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/fennel.updateAccount
 * @param {wfAccount} account the account information including address to be updated
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
        // Reschedule account updates and return result
        scheduleAccountsUpdate();
        return resolve(account);
    });
}

/**
 * Derives a Fennel address from a public key
 * @function getAddress
 * @alias module:lib/blockchains/fennel/accounts.getAddress
 * @param {string} fnlPublicKey a hexadecimal encoded public key
 * @returns {string} the Fennel address
 */
function getAddress(fnlPublicKey) {
    let fnlAddress;
    try {
        fnlAddress = dotCrypto.encodeAddress(hexToU8a(fnlPublicKey));
    } catch(err) {
        return Promise.reject(err);
    }
    return Promise.resolve(fnlAddress);
}

/**
 * Derives a public key from a Fennel address
 * @function getPublicKey
 * @alias module:lib/blockchains/fennel/accounts.getPublicKey
 * @param {string} fnlAddress a Fennel address
 * @returns {string} the hexadecimal encoded public key
 */
function getPublicKey(fnlAddress) {
    let fnlPublicKey;
    try {
        fnlPublicKey = noPubkeyHexPrefix(u8aToHex(dotCrypto.decodeAddress(fnlAddress)));
    } catch(err) {
        return Promise.reject(err);
    }
    return Promise.resolve(fnlPublicKey);
}

/**
 * Gets a Polkadot keypair from hexadecimal keys
 * @function getKeypair
 * @alias module:lib/blockchains/fennel.getKeypair
 * @param {string} publicKey the hexadecimal public key
 * @param {string} secretKey the hexadecimal private key
 * @returns {Promise} resolves to a keypair
 */
function getKeypair(publicKey, secretKey) {
    return Promise.resolve(createKeypair(publicKey, secretKey))
}

/**
 * Gets a Polkadot keyring from an address
 * @param {string} address the address of the account used to sign
 * @returns {Promise} resolves to a keyring
 */
function getKeyring(address) {
    return new Promise((resolve, reject) => {
        let account = _fnlState.accounts.find(item => item.address === address);
        if (account) {
            getPrivateKey(account.address)
            .then(fnlPrivateKey => {
                return getKeypair(account.publicKey, fnlPrivateKey)
            })
            .then(keypair => {
                const originator = _fnlKeyring.addFromPair(keypair);
                return resolve(originator);
            })
            .catch(err => {
                return reject(err)
            });
        } else {
            try {
                const originator = _fnlKeyring.addFromAddress(address);
                return resolve(originator);
            } catch (err) {
                return reject(err);
            }
        }
    });
}

/**
 * Signs an arbitrary input with an account's private key 
 * @function getSignature
 * @alias module:lib/blockchains/fennel.getSignature
 * @param {string} input the input to be signed
 * @param {string} address the address of the account used to sign
 * @returns {Promise} resolves to the hexadecmial encoded signature
 */
function getSignature(input, address) {
    return new Promise((resolve, reject) => {
        let account = _fnlState.accounts.find(item => item.address === address);
        if (account) {
            log.trace(MODULELOG, `Signing input for address ${account.address}: ${input}`);
            getPrivateKey(account.address)
            .then(fnlPrivateKey => {
                const signature = generateSignature(input, account.publicKey, fnlPrivateKey);
                log.trace(MODULELOG, `Created signature for address ${account.address}: ${signature}`);
                return resolve(signature);
            })
            .catch(err => reject(err));
        } else {
            return reject(new ProcessingError(`No existing ${_fnlChain} account with address: ${address}`, null, 'WF_API_NO_RESOURCE')); 
        }
    });
}

/**
 * Verifies if the signature is valid for the arbitrary input and address
 * @param {string} input the input that has been signed
 * @param {string} signature the hexadecmial encoded signature to be verified
 * @param {string} publicKey the hexadecmial encoded public key of the signature
 * @returns {Promise} resoilves if signature is valid
 */
function verifySignature(input, signature, publicKey) {
    log.trace(MODULELOG, `Verifying signed input against public key ${publicKey}: ${input}`);
    try {
        const valid = testSignature(input, signature, publicKey);
        return Promise.resolve(valid);
    } catch(err) {
        return Promise.reject(new ProcessingError(`Error verifying signature: ${err.message}`, null, 'WF_SIGN_ERROR'));
    }
}

// PRIVATE ACCOUNT FUNCTIONS //
/**
 * Create account entry from secret seed or random
 * @private
 * @param {string} [seed] hexadecimal encoded secret seed
 * @returns {Object} the account data
 */
 function createAccountEntry(seed = null) {
    let seedBuffer;
    if (seed) {
        log.trace(MODULELOG, `Creating ${_fnlChain} account from secret seed`);
        seedBuffer = hexToBuffer(seed);
    } else {
        log.trace(MODULELOG, `Creating new ${_fnlChain} account with generated secret key`);
        seedBuffer = randomBytes(SEEDBYTELENGTH);
    }
    const keypair = dotCrypto.sr25519PairFromSeed(seedBuffer);
    zeroise(seedBuffer);
    return {
        address: dotCrypto.encodeAddress(keypair.publicKey),
        publicKey: noPubkeyHexPrefix(u8aToHex(keypair.publicKey)),
        privateKey: noHexPrefix(u8aToHex(keypair.secretKey)),
        balance: null,
        transactionCount: null
    };
}

/**
 * Creates a Polkadot keypair from hexadecimal keys
 * @private
 * @param {string} publicKey the hexadecimal public key
 * @param {string} secretKey the hexadecimal private key
 * @returns {Object} a keypair
 */
function createKeypair(publicKey, secretKey) {
    return {
        publicKey: hexToU8a(publicKey),
        secretKey: hexToU8a(secretKey)
    };
}

/**
 * Get the private key of an account
 * @private
 * @param {string} address the address ssociated the private key
 */
function getPrivateKey(address) {
    return new Promise((resolve, reject) => {
        const privateKeyId = getPrivateKeyId(_fnlChain, address);
        wfState.getKey('blockchainKeys', privateKeyId, function fnlGetKeyCb(err, fnlPrivateKey) {
            if (err) reject(err);
            if (!fnlPrivateKey) return reject(new ProcessingError(`No private key available for address ${account.address}`, null, 'WF_API_PROCESSING_ERROR'));
            return resolve(fnlPrivateKey);
        });
    });
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
 * Updates all Fennel blockchain accounts status
 * @private
 */
function updateAccounts() {
    let updateBatch = [];
    _fnlState.accounts.forEach(account => {
        updateBatch.push(updateAccountStatus(account));
    });
    return Promise.allSettled(updateBatch)
    .then(() => {
        wfState.updateBlockchainData(_fnlChain, _fnlState);
    });
}

/**
 * Updates a Fennel blockchain account status
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
 * Updates the balance of a Fennel blockchain account
 * @private
 * @param {wfAccount} account
 * @returns {Promise}
 */
function updateAccountBalance(account) {
    return fnlRpc.getBalance(account.address)
    .then(balance => {
        const newBalance = Number(balance);
        const diffBalance = balance - account.balance;
        if (diffBalance < 0) {
            log.info(MODULELOG, `Account ${account.address} spent ${-diffBalance} tokens`);
        } else if (diffBalance > 0) {
            log.info(MODULELOG, `Account ${account.address} received ${diffBalance} tokens`);
        }
        account.balance = newBalance;
        return Promise.resolve(account.balance);
    })
    .catch(err => log.warn(MODULELOG, `Could not update balance for account ${account.address}: ${err.message}`));
}

 /**
 * Updates the number of transactions of a Fennel blockchain account
 * @private
 * @param {wfAccount} account
 * @returns {Promise}
 */
function updateAccountTransactions(account) {
    return fnlRpc.getTransactionCount(account.address)
    .then(transactionCount => {
        account.transactionCount = transactionCount;
        return Promise.resolve(account.transactionCount);
    })
    .catch(err => log.warn(MODULELOG, `Could not update transaction count for account ${account.address}: ${err.message}`));
}

/**
 * Updates or inserts an Fennel account in the blockchain state
 * @private
 * @param {wfAccount} account Fennel account to be upserted
 */
function upsertAccount(account) {
    // Securely store the private key in state
    if (Object.hasOwn(account, 'privateKey')) {
        const privateKeyId = getPrivateKeyId(_fnlChain, account.address);
        wfState.upsertKey('blockchainKeys', privateKeyId, noHexPrefix(account.privateKey));
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
 * Generate signature
 * @private
 * @param {string} input the input to be signed
 * @param {string} publicKey the hexadecimal encoded public key
 * @param {string} privateKey the hexadecimal encoded private key
 * @returns {string} the hexadecimal encoded signature
 */
function generateSignature(input, publicKey, privateKey) {
    const keypair = createKeypair(publicKey, privateKey);
    const signature = u8aToHex(dotCrypto.sr25519Sign(input, keypair));
    zeroise(keypair.secretKey);
    return signature;
}

/**
 * Test signature
 * @private
 * @param {string} input the signed input
 * @param {string} signature the hexadecimal encoded signature
 * @param {string} publicKey the hexadecimal encoded public key
 * @returns {boolean} true if valid, else false
 */
function testSignature(input, signature, publicKey) {
    return dotCrypto.sr25519Verify(input, hexToU8a(signature), hexToU8a(publicKey));
}
