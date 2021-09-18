'use strict';
/**
 * @module lib/blockchains/bitcoin/accounts
 * @summary Whiteflag API Bitcoin accounts module
 * @description Module for managing Bitcoin accounts for Whiteflag
 */
module.exports = {
    init: initAccounts,
    get: getAccount,
    check: checkAccount,
    create: createAccount,
    update: updateAccount,
    delete: deleteAccount,
    processBlock
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const object = require('../../common/objects');
const { ProcessingError } = require('../../common/errors');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Bitcoin sub-modules //
const bcCommon = require('./common');
const bcRpc = require('./rpc');

// Module constants //
const SATOSHI = 100000000;
const UTXOSTATUS = bcCommon.getUxtoStatuses();

// Module variables //
let _blockchainName;
let _bcState;
let _walletSyncronisationFailTimeout = 30000;

/**
 * Initialises Bitcoin accounts management
 * @function initAccounts
 * @alias module:lib/blockchains/bitcoin/accounts.init
 * @param {Object} bcConfig the Bitcoin blockchain configuration
 * @param {Object} bcState the Bitcoin blockchain state
 */
function initAccounts(bcConfig, bcState) {
    _blockchainName = bcConfig.name;
    _bcState = bcState;
    log.trace(_blockchainName, 'Initialising Bitcoin accounts management...');

    // Start synchronisation of all accounts
    for (let account of _bcState.accounts) {
        synchroniseAccount(account);
    }
    return Promise.resolve();
}

/**
 * Gets account data of a Bitcoin blockchain account by address
 * @function getAccount
 * @alias module:lib/blockchains/bitcoin/accounts.get
 * @param {string} address the Bitcoin account address
 * @returns {Promise} the account data
 */
function getAccount(address) {
    return new Promise((resolve, reject) => {
        let account = _bcState.accounts.find(item => item.address === address);
        if (!account) {
            return reject(new ProcessingError(`No ${_blockchainName} account found with address: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        resolve(account);
    });
}

/**
 * Verifies if an account exists and is not syncing
 * @function checkAccount
 * @alias module:lib/blockchains/bitcoin/accounts.check
 * @param {string} address the Bitcoin account address
 * @returns {Promise} the account data
 */
function checkAccount(address) {
    return new Promise((resolve, reject) => {
        getAccount(address)
        .then(account => {
            if (account.syncing === true) {
                return reject(new ProcessingError(`Account cannot be used because it is currently syncing at block: ${account.lastBlock}`, null, 'WF_API_NOT_AVAILABLE'));
            }
            resolve(account);
        })
        .catch(err => reject(err));
    });
}

/**
 * Creates a new Bitcoin account from an existing or a new key pair
 * @function createAccount
 * @alias module:lib/blockchains/bitcoin/accounts.create
 * @param {Object} wif Wallet Import Format
 * @returns {Promise} resolves to the account data
 */
function createAccount(wif = null) {
    return new Promise((resolve, reject) => {
        let account;
        try {
            if (wif !== null) {
                log.trace(_blockchainName, 'Creating account from WIF');
                account = generateAccount(bitcoin.ECPair.fromWif(wif, _bcState.parameters.network));
            } else {
                log.trace(_blockchainName, 'Creating new account with generated keys');
                account = generateAccount(bitcoin.ECPair.makeRandom({ network: _bcState.parameters.network }));
                account.lastBlock = _bcState.status.currentBlock;
            }
        } catch(err) {
            return reject(err);
        }
        saveAccount(account);
        resolve(account);
    });
}

/**
 * Updates a Bitcoin blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/bitcoin/accounts.update
 * @param account the account information object with updated information
 * @returns {Promise} resolves to the account data
 */
function updateAccount(account) {
    log.trace(_blockchainName, `Updating account: ${account.address}`);
    return new Promise((resolve, reject) => {
        getAccount(account.address)
        .then(account => {
            saveAccount(account);
            resolve(account);
        })
        .catch(err => reject(err));
    });
}

/**
 * Deletes a Bitcoin blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/bitcoin/accounts.delete
 * @param address the address of the account information object with updated informationto be deleted
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function deleteAccount(address) {
    log.trace(_blockchainName, `Deleting account: ${address}`);
    return new Promise((resolve, reject) => {
        // Get index of account in state
        const index = _bcState.accounts.findIndex(item => item.address === address);
        if (index < 0) {
            return reject(new ProcessingError(`Could not find ${_blockchainName} account: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        // Remove account from state after double check
        const account = _bcState.accounts[index];
        if (account.address === address) {
            _bcState.accounts.splice(index, 1);
            wfState.updateBlockchainData(_blockchainName, _bcState);
            return resolve(account);
        }
        reject(new Error(`Could not not delete account: ${address}`));
    });
}

/**
 * Processes transactions for each account to check for UTXOs
 * @function processBlock
 * @alias module:lib/blockchains/bitcoin/accounts.processBlock
 * @param {number} blockNumber the blocknumer
 * @param {Object} block the full block including transactions
 */
function processBlock(blockNumber, block) {
    // Check each account for UXTOs
    for (let account of _bcState.accounts) {
        // Con't process block if wallet is already syncing
        if (account.syncing === true) break;

        // Only process block if it is the next block, otherwise start syncing
        if (account.lastBlock === (blockNumber - 1)) {
            processAccountTransactions(block.tx, account);
            account.lastBlock = blockNumber;
        } else {
            synchroniseAccount(account);
        }
    }
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Updates the Bitcoin blockchain state with a new or updated account
 * @private
 * @param {Object} account the account data to save
 */
 function saveAccount(upsertAccount) {
    // Check if we are inserting or updating
    let stateAccount = _bcState.accounts.find(account => account.address === upsertAccount.address);
    if (!stateAccount) {
        // Insert new account
        _bcState.accounts.push(upsertAccount);
        log.info(_blockchainName, `Blockchain account added to state: ${upsertAccount.address}`);
    } else {
        // Update account
        object.update(upsertAccount, stateAccount);
        log.info(_blockchainName, `Blockchain account updated in state: ${upsertAccount.address}`);
    }
    wfState.updateBlockchainData(_blockchainName, _bcState);
}

/**
 * Syncronises the account by looking for utxos
 * @private
 * @param {Object} account the account to synchronise
 */
function synchroniseAccount(account) {
    for (let thisBlock = (account.lastBlock + 1); thisBlock <= _bcState.status.currentBlock; thisBlock++) {
        log.trace(_blockchainName, `Synchronizing account ${account.address} with block: ${account.lastBlock}/${_bcState.status.currentBlock}`);
        account.syncing = true;

        // Get next block
        bcRpc.getBlockByNumber(thisBlock, true)
        .then(block => {
            processAccountTransactions(block.tx, account);
            account.lastBlock = thisBlock;
        })
        .catch(err => {
            log.error(_blockchainName, `Error synchronizing wallet at block ${thisBlock}: ${err.message}`);
            setTimeout(function timeoutCb() {
                synchroniseAccount(account);
            }, _walletSyncronisationFailTimeout);
        });
    }
    account.syncing = false;
    log.info(_blockchainName, `Completed synchronizing of account ${account.address} at block: ${account.lastBlock}/${_bcState.status.currentBlock}`);
}

/**
 * Checks a list of transactions for utxos related to an account
 * @private
 * @param {Object} transactions the transactions to check
 * @param {Object} account the account to check for
 */
function processAccountTransactions(transactions, account) {
    for (let transaction of transactions) {
        for (let indexOut of Object.keys(transaction.vout)) {
            if (typeof transaction.vout[indexOut].scriptPubKey.addresses !== 'undefined') {
                checkAccountUtxoReceived(transaction, account, indexOut);
            }
        }
        // TODO: check is 
        for (let indexIn of Object.keys(transaction.vin)) {
            if (typeof transaction.vin[indexIn].txid !== 'undefined') {
                for (let otherAccount of _bcState.accounts) {
                    checkAccountUtxoSpent(transaction, otherAccount, indexIn);
                }
            }
        }
    }
}

/**
 * Checks a transaction and processes a received utxo for an account
 * @private
 * @param {Object} transaction the transaction to check
 * @param {Object} account the account to check against
 * @param {Object} index index of the transaction
 */
function checkAccountUtxoReceived(transaction, account, index) {
    if (account.address === transaction.vout[index].scriptPubKey.addresses[0]) {
        if (!account.utxos.some(utxo => utxo.txid === transaction.txid)) {
            let utxo = {
                txid: transaction.txid,
                index: index,
                value: parseInt((transaction.vout[index].value * SATOSHI).toFixed(0)),
                spent: UTXOSTATUS.UNSPENT
            };
            log.info(_blockchainName, 'Received ' + (transaction.vout[index].value * SATOSHI).toFixed(0) + ' on account: ' + account.address);
            account.utxos.push(utxo);
            account.balance = calculateAccountBalance(account);
            saveAccount(account);
        }
    }
}

/**
 * Checks a transaction and processes a spent utxo for an account
 * @private
 * @param {Object} transaction the transaction to check
 * @param {Object} account the account to check against
 * @param {Object} index index of the transaction
 */
function checkAccountUtxoSpent(transaction, account, index) {
    for (let utxo of account.utxos) {
        if (utxo.txid === transaction.vin[index].txid
            && transaction.vin[index].vout === utxo.index
            && utxo.spent !== UTXOSTATUS.SPENTVERIFIED
        ) {
            log.info(_blockchainName, 'Spent ' + utxo.value + ' from account: ' + account.address);
            utxo.spent = UTXOSTATUS.SPENTVERIFIED;
            calculateAccountBalance(account);
            saveAccount(account);
        }
    }
}

/**
 * Calculates the account balance based on unspent UTXOs
 * @private
 * @param {Object} account the Bitcoin account
 * @returns {Object} balance of the account
 * @TDOD Remove function and use the one in accounts submodule
 */
function calculateAccountBalance(account) {
    // Put unspent UTXOs in an array
    let unspentUtxos = [];
    for (let utxo of account.utxos) {
        if (utxo.spent === UTXOSTATUS.UNSPENT) {
            unspentUtxos.push(utxo);
        }
    }
    // Accumulate all UTXO values
    return unspentUtxos.reduce(function(accumulator, utxo) {
        return accumulator + utxo.value;
    }, 0);
}

/**
 * Generate account from keypair
 * @private
 * @param {Object} keyPair a cryptographic key pair for Bitcoin
 * @returns {Object} the account data
 */
function generateAccount(keyPair) {
    return {
        address: bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: _bcState.parameters.network
        }).address,
        publicKey: keyPair.publicKey.toString('hex'),
        privateKey: keyPair.privateKey.toString('hex'),
        wif: keyPair.toWif(),
        balance: 0,
        firstBlock: 0,
        lastBlock: 0,
        syncing: false,
        utxos: []
    };
}

