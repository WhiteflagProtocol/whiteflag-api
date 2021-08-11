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
    save: saveAccount
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
const bcRpc = require('./rpc');
const { UTXOSTATUS } = require('./common');
const { ignore } = require('../../common/processing');

// Module constants //
const SATOSHI = 100000000;

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
    log.trace(_blockchainName, 'Initialising Bitcoin accounts management...');
    return new Promise((resolve, reject) => {
        _blockchainName = bcConfig.name;
        _bcState = bcState;
        for (let account of _bcState.accounts) {
            synchronizeWallet(account);
        }
        resolve();
        ignore(reject); // This promise will never be rejected
    });
}

/**
 * Gets account data of a Bitcoin blockchain account by address
 * @function getAccount
 * @alias module:lib/blockchains/bitcoin/accounts.get
 * @param {string} address the Bitcoin account address
 * @param {function(err, account)} callback function called upon completion
 * @returns {Object} the account data
 */
function getAccount(address, callback) {
    let account = _bcState.accounts.find(item => item.address === address);
    if (!account) {
        return callback(new ProcessingError(`No ${_blockchainName} account found with address: ${address}`, null, 'WF_API_NO_RESOURCE'));
    }
    return callback(null, account);
}

/**
 * Verifies if an account exists and is not syncing
 * @function checkAccount
 * @alias module:lib/blockchains/bitcoin/accounts.check
 * @param {string} address the Bitcoin account address
 * @param {function(err, account)} callback function called upon completion
 * @returns {Object} balance of the account
 */
function checkAccount(address, callback) {
    getAccount(address, function getAccountCb(err, account) {
        if (err) return callback(err);
        if (account.walletSyncing === true) {
            return callback(new ProcessingError(`Account cannot be used because it is currently syncing at block: ${account.lastBlock}`, null, 'WF_API_NOT_AVAILABLE'));
        }
        return callback(null, account);
    });
}

/**
 * Creates a new Bitcoin account from an existing or a new key pair
 * @function createAccount
 * @alias module:lib/blockchains/bitcoin/accounts.create
 * @param {Object} wif Wallet Import Format
 * @param {blockchainCreateAccountCb} callback function to be called upon completion
 * @returns {Object} the account data
 */
function createAccount(wif, callback) {
    let account;
    if (wif !== null) {
        // Generate account from WIF
        account = generateAccount(bitcoin.ECPair.fromWif(wif, _bcState.parameters.network));
    } else {
        // Generate new account
        account = generateAccount(bitcoin.ECPair.makeRandom({ network: _bcState.parameters.network }));
        account.lastBlock = _bcState.status.currentBlock;
    }
    log.info(_blockchainName, `Blockchain account created: ${account.address}`);
    saveAccount(account);
    if (callback) return callback(null, account);
    return account;
}

/**
 * Updates a Bitcoin blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/bitcoin/accounts.update
 * @param account the account information object with updated information
 * @param {blockchainUpdateAccountCb} callback function to be called upon completion
 */
function updateAccount(account, callback) {
    let updatedAccount = getAccount(account.address);
    if (!updatedAccount) return callback(new ProcessingError(`No ${_blockchainName} account found with address: ${account.address}`));
    // Update state with new or updated account
    saveAccount(account);
    if (callback) return callback(null, account);
    return account;
}

/**
 * Deletes a Bitcoin blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/bitcoin/accounts.delete
 * @param address the address of the account information object with updated informationto be deleted
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function deleteAccount(address, callback) {
    // Get index of account
    const index = _bcState.accounts.findIndex(item => item.address === address);
    if (index < 0) {
        return callback(new ProcessingError(`Could not find ${_blockchainName} account: ${address}`, null, 'WF_API_NO_RESOURCE'));
    }
    // Remove account from state after double check
    const account = _bcState.accounts[index];
    if (account.address === address) {
        _bcState.accounts.splice(index, 1);
        wfState.updateBlockchainData(_blockchainName, _bcState);
    } else {
        return callback(new Error(`Could not not delete account: ${address}`));
    }
    // Log and return result
    log.info(_blockchainName, `Blockchain account deleted: ${address}`);
    if (callback) return callback(null, account);
    return account;
}

/**
 * Updates the Bitcoin blockchain state with a new or updated account
 * @function saveAccount
 * @alias module:lib/blockchains/bitcoin/accounts.save
 * @param {Object} account the account data
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

// PRIVATE MODULE FUNCTIONS //
/**
 * Syncronizes the wallet by looking for utxos
 * @private
 */
function synchronizeWallet(account) {
    try {
        for (let thisBlock = account.lastBlock; thisBlock <= _bcState.status.currentBlock; thisBlock++) {
            log.trace(_blockchainName, `Synchronizing account ${account.address} with block: ${account.lastBlock}/${_bcState.status.currentBlock}`);
            account.walletSyncing = true;
            account.lastBlock = thisBlock;
            bcRpc.getBlockIncludingTransactions(thisBlock)
            .then(function processTransactionsForAccount(block) {
                if (block !== null) {
                    processAccountTransactions(block.tx, account);
                    account.lastBlock = thisBlock;
                }
            });
        }
    } catch(err) {
        log.error(_blockchainName, 'Error synchronizing wallet: ' + err.message);
        setTimeout(function timeoutCb() {
            synchronizeWallet(account);
        }, _walletSyncronisationFailTimeout);
    }
    log.info(_blockchainName, `Completed synchronizing account ${account.address} at block: ${account.lastBlock}/${_bcState.status.currentBlock}`);
    account.walletSyncing = false;
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
                for (let indexIn of Object.keys(transaction.vin)) {
                    if (typeof transaction.vin[indexIn].txid !== 'undefined') {
                        for (let otherAccount of _bcState.accounts) {
                            checkAccountUtxoSpent(transaction, otherAccount, indexIn);
                        }
                    }
                }
            }
        }
    }
}

/**
 * checks if a transactions contains an utxo that is received for an account, if a tansaction is received the balance is calculated and the account is saved
 * @param {Object} transaction the transaction to check
 * @param {Object} account the account to check against
 * @param {Object} index index of the transaction
 * @private
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
 * Checks if a transaction contains an utxo for an account; if the tansaction has spent, the balance is calculated and the account is saved
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
        walletSyncing: false,
        utxos: []
    };
}

