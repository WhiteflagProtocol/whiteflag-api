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
    updateUtxosSpent: updateAccountUtxosSpent,
    updateBalance: updateAccountBalance,
    processBlockUtxos
};

// Node.js core and external modules //
const bitcoin = require('bitcoinjs-lib');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const object = require('../../common/objects');
const { hash } = require('../../common/crypto');
const { ignore } = require('../../common/processing');
const { ProcessingError } = require('../../common/errors');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Bitcoin sub-modules //
const btcRpc = require('./rpc');

// Module constants //
const ACCOUNTSYNCDELAY = 10000;
const SATOSHI = 100000000;
const KEYIDLENGTH = 12;

// Module variables //
let _btcName = 'bitcoin';
let _btcState;
let _transactionBatchSize = 128;

/**
 * Initialises Bitcoin accounts management
 * @function initAccounts
 * @alias module:lib/blockchains/bitcoin/accounts.init
 * @param {Object} btcConfig the Bitcoin blockchain configuration
 * @param {Object} btcState the Bitcoin blockchain state
 */
async function initAccounts(btcConfig, btcState) {
    _btcName = btcConfig.name;
    _btcState = btcState;
    log.trace(_btcName, 'Initialising Bitcoin accounts management...');

    // Wallet synchronisation parameters
    if (btcConfig.transactionBatchSize) _transactionBatchSize = btcConfig.transactionBatchSize;

    // If configured, create new account if none exists
    if (btcConfig.createAccount && _btcState.accounts.length === 0) {
        createAccount(null)
        .then(account => {
            log.info(_btcName, `Bitcoin account created automatically: ${account.address}`);
        })
        .catch(err => log.warn(_btcName, err.message));
    } else {
        // Upgrade data structure of existing accounts
        for (let account of _btcState.accounts) {
            upgradeAccountData(account);
        }
    }
    // Start synchronisation of all accounts
    setTimeout(synchroniseAccounts, ACCOUNTSYNCDELAY);

    // All done
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
        let account = _btcState.accounts.find(item => item.address === address);
        if (!account) {
            return reject(new ProcessingError(`The ${_btcName} account does not exist: ${address}`, null, 'WF_API_NO_RESOURCE'));
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
                return reject(new ProcessingError(`The ${_btcName} account cannot be used because it is currently syncing at block: ${account.lastBlock}/${_btcState.status.currentBlock}`, null, 'WF_API_NOT_AVAILABLE'));
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
 * @param {string} [wif] hexadecimal string with with private key in Wallet Import Format (WIF)
 * @returns {Promise} resolves to the account data
 */
async function createAccount(wif = null) {
    return new Promise((resolve, reject) => {
        let account;
        try {
            if (wif !== null) {
                log.trace(_btcName, 'Creating Bitcoin account from WIF');
                account = createAccountEntry(bitcoin.ECPair.fromWif(wif, _btcState.parameters.network));
            } else {
                log.trace(_btcName, 'Creating new Bitcoin account with generated keys');
                account = createAccountEntry(bitcoin.ECPair.makeRandom({ network: _btcState.parameters.network }));
                btcRpc.getBlockCount()
                .then(highestBlock => {
                    account.firstBlock = highestBlock;
                    account.lastBlock = highestBlock;
                });
            }
            // Hopefully the garbage collector will do its work
            wif = undefined;
        } catch(err) {
            wif = undefined;
            log.error(_btcName, `Error while creating new Bitcoin account: ${err.message}`);
            return reject(err);
        }
        // Check for existing account and store account
        getAccount(account.address)
        .then(existingAccount => {
            if (existingAccount.address === account.address) {
                return reject(new ProcessingError(`The ${_btcName} account already exists: ${account.address}`, null, 'WF_API_RESOURCE_CONFLICT'));
            }
        })
        .catch(err => ignore(err)); // all good if account does not yet exist

        // Save and return result
        upsertAccount(account);
        return resolve(account);
    });
}

/**
 * Updates a Bitcoin blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/bitcoin/accounts.update
 * @param {string} account the account information object with updated information
 * @returns {Promise} resolves to the account data
 */
function updateAccount(account) {
    log.trace(_btcName, `Updating Bitcoin account: ${account.address}`);
    return new Promise((resolve, reject) => {
        // Update only if account exists
        getAccount(account.address)
        .then(existingAccount => {
            // Double check addresses
            if (existingAccount.address !== account.address) {
                return reject(new Error(`Address of ${_btcName} account in state does not correspond with updated account data address`));
            }
            // Upsert updated account data
            try {
                upsertAccount(account);
            } catch(err) {
                return reject(new Error(`Could not update ${_btcName} account: ${err.message}`));
            }
            return resolve(account);
        })
        .catch(err => reject(err));
    });
}

/**
 * Deletes a Bitcoin blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/bitcoin/accounts.delete
 * @param {string} address the address of the account information object with updated informationto be deleted
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function deleteAccount(address) {
    log.trace(_btcName, `Deleting Bitcoin account: ${address}`);

    return new Promise((resolve, reject) => {
        // Get index of account in state
        const index = _btcState.accounts.findIndex(item => item.address === address);
        if (index < 0) {
            return reject(new ProcessingError(`Could not find ${_btcName} account: ${address}`, null, 'WF_API_NO_RESOURCE'));
        }
        // Remove account from state after double check
        const account = _btcState.accounts[index];
        if (account.address === address) {
            _btcState.accounts.splice(index, 1);
            wfState.updateBlockchainData(_btcName, _btcState);
        } else {
            return reject(new Error(`Could not not delete ${_btcName} account: ${address}`));
        }
        // Log and return result
        return resolve(account);
    });
}

/**
 * Updates the status of the UTXOs for an account
 * @function updateAccountUtxos
 * @alias module:lib/blockchains/bitcoin/accounts.updateUtxos
 * @param {Object} account the Bitcoin account
 * @param {Array} spentUtxos the UTXOs spent by a transaction
 * @returns {Object} the updated account
 */
 function updateAccountUtxosSpent(account, spentUtxos) {
    // Check account UTXOs against the provided UTXOs
    spentUtxos.forEach(spentUtxo => {
        account.utxos.forEach(utxo => {
            if (utxo.txid === spentUtxo.txid) {
                utxo.spent = true;
            }
        });
    });
    updateAccountBalance(account);
}

/**
 * Updates the account balance based on unspent UTXOs
 * @function updateAccountBalance
 * @param {Object} account the account to be updated
 */
 function updateAccountBalance(account) {
    // Get unspent UTXOs
    let unspentUtxos = [];
    for (let utxo of account.utxos) {
        if (!utxo.spent) unspentUtxos.push(utxo);
    }
    // Sum unspent UTXOs
    account.balance = (unspentUtxos.reduce((accumulator, utxo) => {
        return accumulator + utxo.value;
    }, 0));
    upsertAccount(account);
}

/**
 * Processes block to check for incoming UTXOs for each account
 * @function processBlockUtxos
 * @alias module:lib/blockchains/bitcoin/accounts.processBlockUtxos
 * @param {number} blockNumber the blocknumer
 * @param {Object} block the full block including transactions
 */
function processBlockUtxos(blockNumber, block) {
    for (let account of _btcState.accounts) {
        // Only process the next block and if not already syncing
        if (account.syncing === true) break;
        if (account.lastBlock === (blockNumber - 1)) {
            processAccountTransactions(0, block.tx, account)
            .then(() => {
                account.lastBlock = blockNumber;
            })
            .catch(err => {
                log.warn(_btcName, `Error processing block ${blockNumber} to check UTXOs for account ${account.address}: ${err.message}`);
                return scheduleSynchroniseAccount(account.address);
            });
        } else {
            // This block is not the next block, so strart syncing
            synchroniseAccount(account);
        }
    }
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Create Bitcoin account entry from Bitcoin key pair
 * @private
 * @param {Object} bcKeypair a cryptographic key pair for Bitcoin
 * @returns {Object} the account data
 */
function createAccountEntry(bcKeypair) {
    return {
        address: bitcoin.payments.p2pkh({
            pubkey: bcKeypair.publicKey,
            network: _btcState.parameters.network
        }).address,
        publicKey: bcKeypair.publicKey.toString('hex'),
        privateKey: bcKeypair.privateKey.toString('hex'),
        balance: 0,
        firstBlock: 1,
        lastBlock: 0,
        syncing: false,
        utxos: []
    };
}

/**
 * Upgrades Bitcoin account data structure to current version
 * @private
 * @param {Object} account the account data
 */
function upgradeAccountData(account) {
    // Upgrade UTXO spent values
    for (let utxo of account.utxos) {
        if (typeof utxo.spent === 'string' || utxo.spent instanceof String) {
            if (utxo.spent === 'UNSPENT') utxo.spent = false;
            if (utxo.spent === 'SPENT') utxo.spent = true;
            if (utxo.spent === 'SPENTVERIFIED') utxo.spent = true;
            if (utxo.spent === 'NEEDSVERIFICATION') utxo.spent = true;
        }
        utxo.index = +utxo.index;
    }
    return account;
}

/**
 * Updates or inserts an Bitcoin account in the blockchain state without private key
 * @private
 * @param {Object} account Bitcoin account to be upserted
 */
function upsertAccount(account) {
    // Securely store the private key in state
    if (Object.prototype.hasOwnProperty.call(account, 'privateKey')) {
        const privateKeyId = hash(_btcName + account.address, KEYIDLENGTH);
        wfState.upsertKey('blockchainKeys', privateKeyId, account.privateKey.toString('hex'));
        delete account.privateKey;
    }
    // Inserting or updating
    let existingAccount = _btcState.accounts.find(item => item.address === account.address);
    if (!existingAccount) {
        // Insert new account
        _btcState.accounts.push(account);
    } else {
        // Update account
        object.update(account, existingAccount);
    }
    wfState.updateBlockchainData(_btcName, _btcState);
}

/**
 * Starts synchronisation of all accounts
 * @private
 */
function synchroniseAccounts() {
    for (let account of _btcState.accounts) {
        scheduleSynchroniseAccount(account.address);
    }
}

/**
 * Schedules synchronisation of the specified account
 * @private
 */
function scheduleSynchroniseAccount(address) {
    getAccount(address)
    .then(account => {
        setTimeout(function timeoutSynchroniseAccountCb() {
            synchroniseAccount(account);
        }, ACCOUNTSYNCDELAY);
    })
    .catch(err => {
        log.warn(_btcName, `Rescheduling synchronisation of account ${address} after error: ${err.message}`);
        return scheduleSynchroniseAccount(address);
    });
}

/**
 * Syncronises an account with the blockchain by looking for utxos
 * @private
 * @param {Object} account the account to synchronise
 */
function synchroniseAccount(account) {
    // To sync or not to sync
    if (account.lastBlock >= _btcState.status.currentBlock) {
        if (account.syncing) {
            log.info(_btcName, `Completed synchronisation of account ${account.address} at block: ${account.lastBlock}/${_btcState.status.highestBlock}`);
            account.syncing = false;
        }
        return Promise.resolve();
    }
    if (!account.syncing) {
        log.info(_btcName, `Starting synchronisation of account ${account.address} from block: ${account.lastBlock}/${_btcState.status.highestBlock}`);
        account.syncing = true;
    }
    // Get next block
    let thisBlock = account.lastBlock + 1;
    log.trace(_btcName, `Synchronising account ${account.address} with block: ${thisBlock}/${_btcState.status.highestBlock}`);
    btcRpc.getBlockByNumber(thisBlock, true)
    .then(block => {
        return processAccountTransactions(0, block.tx, account);
    })
    .then(() => {
        account.lastBlock = thisBlock;
        return synchroniseAccount(account);
    })
    .catch(err => {
        log.warn(_btcName, `Rescheduling synchronisation of account ${account.address} after failure to process block ${thisBlock}: ${err.message}`);
        return scheduleSynchroniseAccount(account.address);
    });
}

/**
 * Processes the transactions of a Bitcoin block
 * @private
 * @param {number} index the transaction in the array to process
 * @param {Array} transactions the transactions to process
 * @param {Object} account the account to check transaction for
 * @returns {Promise} resolves if all transactions are successfully processed
 */
 function processAccountTransactions(index, transactions, account) {
    // Get transaction batch of Promises in an array to check transactions for UTXOs
    let transactionBatch = createTransactionBatch(index, transactions, account);
    if (transactionBatch.length < 1) return Promise.resolve();

    // Resolve all transaction promises in the batch
    return Promise.all(transactionBatch)
    .then(data => {
        ignore(data);

        // Next batch
        let nextIndex = index + _transactionBatchSize;
        if (nextIndex >= transactions.length) return Promise.resolve();
        return processAccountTransactions(nextIndex, transactions, account);
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Combines multiple transactions from a Bitcoin block as promises in an array for batch processing
 * @private
 * @param {number} index the transaction in the array to process
 * @param {Array} transactions the transactions to process
 * @param {Object} account the account to check transaction for
 * @return {Array} Array with transaction Promises
 */
function createTransactionBatch(index, transactions, account) {
    let transactionBatch = [];
    for (
        let i = index;
        i < Math.min(index + _transactionBatchSize, transactions.length);
        i++
    ) {
        // Get a promise for the next transaction
        transactionBatch.push(
            new Promise(resolve => {
                processTransaction(transactions[i], account);
                return resolve();
            })
        );
    }
    return transactionBatch;
}

/**
 * Checks a list of transactions for utxos related to an account
 * @private
 * @param {Object} transaction the transaction to check for UTXOs
 * @param {Object} account the account to check the transaction for
 */
 function processTransaction(transaction, account) {
    // Check transaction for received UTXOs
    for (let index in transaction.vout) {
        if (typeof transaction.vout[index].scriptPubKey.addresses !== 'undefined') {
            checkAccountUtxosReceived(transaction, index, account);
        }
    }
    // Check transaction for spent UTXOs
    for (let index in transaction.vin) {
        if (typeof transaction.vin[index].txid !== 'undefined') {
            checkAccountUtxosSpent(transaction, index, account);
        }
    }
}

/**
 * Checks a transaction and processes a received utxo for an account
 * @private
 * @param {Object} transaction the transaction to check
 * @param {Object} index the UTXO index within the transaction
 * @param {Object} account the account to check against
 */
function checkAccountUtxosReceived(transaction, index, account) {
    if (account.address === transaction.vout[index].scriptPubKey.addresses[0]) {
        if (!account.utxos.some(utxo => utxo.txid === transaction.txid)) {
            let utxo = {
                txid: transaction.txid,
                index: +index,
                value: parseInt((transaction.vout[index].value * SATOSHI).toFixed(0)),
                spent: false
            };
            log.info(_btcName, `Received ${utxo.value} satoshis on account: ${account.address}`);
            account.utxos.push(utxo);
            updateAccountBalance(account);
        }
    }
}

/**
 * Checks a transaction and processes a spent utxo for an account
 * @private
 * @param {Object} transaction the transaction to check
 * @param {Object} index the UTXO index within the transaction
 * @param {Object} account the account to check against
 */
function checkAccountUtxosSpent(transaction, index, account) {
    for (let utxo of account.utxos) {
        if (utxo.txid === transaction.vin[index].txid
            && +transaction.vin[index].vout === +utxo.index
        ) {
            log.info(_btcName, `Spent ${utxo.value} satoshis from account: ${account.address}`);
            utxo.spent = transaction.txid;
            updateAccountBalance(account);
        }
    }
}
