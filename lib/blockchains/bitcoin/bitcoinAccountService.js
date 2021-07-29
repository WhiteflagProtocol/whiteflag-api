const bitcoin = require('bitcoinjs-lib');
let _network;
let _blockchainName = 'bitcoin';
let _blockchainState = {};
const object = require('../../common/objects');
const wfState = require('../../protocol/state');
const { ProcessingError } = require('../../common/errors');


const log = require('../../common/logger');

module.exports = {
 generateNewAccount,
 generateAccountFromWif,
 createAccount,
 deleteAccount,
 saveAccount,
 updateAccount,
 setAccountServiceValues,
 getAccount
};

function setAccountServiceValues(blockchainState, network){
_network = network
 _blockchainState = blockchainState
}

/**
 * Updates Bitcoin blockchain account attributes
 * @function updateAccount
 * @alias module:lib/blockchains/bitcoin.updateAccount
 * @param {blockchainUpdateAccountCb} callback function to be called upon completion
 */
function updateAccount(account, callback) {
    let updateAccount = getAccount(account.address);
    if (!updateAccount) return callback(new ProcessingError(`No ${_blockchainName} account found with address: ${account.address}`));
    // Update state with new or updated account
    saveAccount(account);
    if (callback) return callback(null, account);
    return account;
}


/**
 * Deletes Bitcoin blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/bitcoin.deleteAccount
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function deleteAccount(address, callback) {
    // Get index of account
    const index = _blockchainState.accounts.findIndex(item => item.address === address);
    if (index < 0) {
        return callback(new ProcessingError(`Could not find ${_blockchainName} account: ${address}`, null, 'WF_API_NO_RESOURCE'));
    }
    // Remove account from state after double check
    const account = _blockchainState.accounts[index];
    if (account.address === address) {
        _blockchainState.accounts.splice(index, 1);
        wfState.updateBlockchainData(_blockchainName, _blockchainState);
    } else {
        return callback(new Error(`Could not not delete account: ${address}`));
    }
    // Log and return result
    log.info(_blockchainName, `Blockchain account deleted: ${address}`);
    return callback(null, account);
}

/**
 * Generates a new Bitcoin account
 * @returns {object} account
 */
function createAccount(wif, callback) {
    // Create Bitcoin account and store in state
    if (wif != null) {
        let account = generateAccountFromWif(wif)
        saveAccount(account)
        return account
    } else {
        let account = generateNewAccount();
        account.lastBlock =  _blockchainState.status.currentBlock 
        saveAccount(account);
        return account
    }
}

/**
 * Updates the Bitcoin blockchain state with new or updated account
 * @param {object} account
 */
function saveAccount(upsertAccount) {
    // Check if we are inserting or updating
    let stateAccount = _blockchainState.accounts.find(account => account.address === upsertAccount.address);
    if (!stateAccount) {
        // Insert new account
        _blockchainState.accounts.push(upsertAccount);
        log.info(_blockchainName, `Blockchain account added to state: ${upsertAccount.address}`);
    } else {
        // Update account
        object.update(upsertAccount, stateAccount);
        log.info(_blockchainName, `Blockchain account updated in state: ${upsertAccount.address}`);
    }
    wfState.updateBlockchainData(_blockchainName, _blockchainState);
}

/**
 * Gets account from the Bitcoin blockchain state by address
 * @param {string} address
 * @returns {object} account
 */
function getAccount(address) {
    let foundAccount = _blockchainState.accounts.find(account => {
        if (account.address === address) {
            return account;
        }
    });
    return foundAccount;
}

/**
 * Generates a new Bitcoin account
 * @private
 * @returns {object} account
 */
function generateNewAccount() {
    // Generate a keypair
    let keyPair = bitcoin.ECPair.makeRandom({ network: _network });

    let account = generateAccount(keyPair, _network)
    log.info(_blockchainName, `Blockchain account created: ${account.address}`);
    return account;
}

/**
 * Generates a new Bitcoin account from wif
 * @param {Object} wif
 * @private
 * @returns {object} account
 */
function generateAccountFromWif(wif) {

    let keyPair = bitcoin.ECPair.fromWIF(wif, _network)
    let account = generateAccount(keyPair, _network)

    return account;
}

/**
 * generate accoubt from keypair
* @param {Object} keyPair
 * @private
 * @returns {object} account
 */
function generateAccount(keyPair) {
    let account = {
        address: bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: _network
        }).address,
        publicKey: keyPair.publicKey.toString('hex'),
        privateKey: keyPair.privateKey.toString('hex'),
        wif: keyPair.toWIF(),
        balance: 0,
        firstBlock: 0,
        lastBlock: 0,
        walletSyncing: 'FALSE',
        utxos: []
    };
    return account;
}

