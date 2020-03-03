'use strict';
/**
 * @module lib/blockchains/ethereum
 * @summary Whiteflag API Ethereum blockchain implementation
 * @description Module to use Ethereum as underlying blockchain for Whiteflag
 * @tutorial modules
 * @tutorial ethereum
 */
module.exports = {
    // Ethereum blockchain functions
    init: initEthereum,
    sendMessage,
    lookupMessage,
    getTransaction,
    requestSignature,
    requestKeys,
    getBinaryAddress,
    transfer,
    createAccount,
    updateAccount,
    deleteAccount
};

// Node.js core and external modules //
const crypto = require('crypto');
const Web3 = require('web3');
const EthereumTx = require('ethereumjs-tx').Transaction;
const ethereumUtil = require('ethereumjs-util');
const keccak = require('keccak');
const KeyEncoder = require('key-encoder');
const jwt = require('jsonwebtoken');

// Whiteflag common functions and classes //
const log = require('../common/logger');
const object = require('../common/objects');
const { hash, zeroise } = require('../common/crypto');
const { ProcessingError } = require('../common/errors');
const { timeoutPromise } = require('../common/processing');

// Whiteflag modules //
const wfState = require('../protocol/state');

// Whiteflag event emitters //
const wfRxEvent = require('../protocol/events').rxEvent;

// Module constants //
const KEYIDLENGTH = 12;
const SIGNALGORITHM = 'ES256';
const SIGNKEYTYPE = 'secp256k1';
const BINENCODING = 'hex';
const ETHHEXPREFIX = '0x';
const SECPUBKEYPREFIX = '04';
const STATUSINTERVAL = 60000;
const INFOINTERVAL = 3600000;
const WFINDENTIFIER = '5746';
const BLOCKSTACKSIZE = 100;
const MAXRETRIES = 8;

// Module variables //
let _web3;
let _blockchainName = 'ethereum';
let _chainID = 1;
let _blockchainState = {};
let _discoveredBlock = 0;
let _blockCursor = 0;
let _blockInterval = 5000;
let _blockRetrievalEnd = 0;
let _blockRetrievalRestart = 100;
let _blockMaxRetries = 100;
let _transactionBatchSize = 32;
let _transactionValue = '0';
let _traceRawTransaction = false;
let _rpcTimeout = 2000;
let _iterationCount = 0;
let _blockStackSize = 0;
let _blockRetryCount = 0;
let _skippedBlocks = 0;

/**
 * Initialises the Ethereum blockchain
 * @function initEthereum
 * @alias module:lib/blockchains/ethereum.init
 * @param {Object} bcConfig the blockchain configuration
 * @param {blockchainInitCb} callback function to be called after intitialising Ethereum
 */
function initEthereum(bcConfig, callback) {
    // Preserve the name of the blockchain
    _blockchainName = bcConfig.name;

    // Get Ethereum blockchain state
    wfState.getBlockchainData(_blockchainName, function blockchainsGetStateDb(err, blockchainState) {
        if (err) return callback(err, _blockchainName);
        if (!blockchainState) {
            blockchainState = {
                parameters: {},
                status: {},
                accounts: []
            };
        }
        // Preserve state for module
        _blockchainState = blockchainState;

        // Log all parameters
        if (_blockMaxRetries > 0) log.info(_blockchainName, `Maximum retries for processing a block is set to ${_blockMaxRetries} for each block`);
        log.info(_blockchainName, `Number of transactions in a block that are processed in parallel is set to ${_transactionBatchSize}`);
        log.info(_blockchainName, `Block retrieval interval is set to ${_blockInterval} ms`);
        log.info(_blockchainName, `Timeout of RPC calls to Ethereum node is set to ${_rpcTimeout} ms`);

        // Get Chain ID
        if (bcConfig.chainID) _chainID = bcConfig.chainID;
        _blockchainState.parameters.chainID = _chainID;
        log.info(_blockchainName, `Configured to use Ethereum Chain ID: ${_chainID}`);

        // Block retrieval parameters
        if (bcConfig.blockRetrievalRestart) _blockRetrievalRestart = bcConfig.blockRetrievalRestart;
        if (bcConfig.blockMaxRetries) _blockMaxRetries = bcConfig.blockMaxRetries;
        if (bcConfig.transactionBatchSize) _transactionBatchSize = bcConfig.transactionBatchSize;

        // Block interval time and RPC timeout period
        if (bcConfig.blockRetrievalInterval && bcConfig.blockRetrievalInterval > 500) {
            _blockInterval = bcConfig.blockRetrievalInterval;
        }
        if (bcConfig.rpcTimeout && bcConfig.rpcTimeout > 500) {
            _rpcTimeout = bcConfig.rpcTimeout;
        }
        // Initialise Ethereum with rpc paramters and ensure the api state is updated
        const rpcAuthURL = getNodeURL(bcConfig, false);
        const rpcCleanURL = getNodeURL(bcConfig, true); // no credentials
        _blockchainState.parameters.rpcURL = rpcCleanURL;
        log.trace(_blockchainName, `Setting up connection with Ethereum node ${rpcCleanURL}`);
        _web3 = new Web3(new Web3.providers.HttpProvider(rpcAuthURL));

        // Check connection by getting Network ID
        timeoutPromise(_web3.eth.net.getId(), 10000)
        .then(function web3GetNetIdResolve(networkID) {
            _blockchainState.parameters.networkID = networkID;
            log.info(_blockchainName, `Connected to Ethereum Network ID: ${networkID}`);
        }).catch(function web3GetNetIdError(err) {
            log.warn(_blockchainName, `Could not get Ethereum Network ID during initialisation: ${err.message}`);
        });
        // Initialise accounts
        initAccounts(bcConfig.createAccount);

        // Determine from where to where we want to retrieve blocks, and start listener
        timeoutPromise(_web3.eth.getBlockNumber(), 10000)
        .then(function web3GetBlockNumberResolve(highestBlock) {
            // Determine block retrieval range
            if (bcConfig.blockRetrievalStart && bcConfig.blockRetrievalStart > 0) {
                log.info(_blockchainName, `Starting block specified in configuration: ${bcConfig.blockRetrievalStart}`);
                _blockCursor = bcConfig.blockRetrievalStart - 1;
            }
            if (bcConfig.blockRetrievalEnd && bcConfig.blockRetrievalEnd > 0) {
                log.info(_blockchainName, `Ending block specified in configuration: ${bcConfig.blockRetrievalEnd}`);
                _blockRetrievalEnd = bcConfig.blockRetrievalEnd;
            }
            // Determine current block from where we want to retrieve next block
            if (_blockCursor < 1 && bcConfig.blockRetrievalStart < 1) {
                if (_blockchainState.status.currentBlock > 0) {
                    if ((highestBlock - _blockchainState.status.currentBlock) > _blockRetrievalRestart) {
                        let nextBlock = highestBlock - _blockRetrievalRestart;
                        _blockCursor = nextBlock - 1;
                        log.info(_blockchainName, `Resuming from block: ${nextBlock} (${_blockRetrievalRestart} blocks behind the highest block ${highestBlock} on node)`);
                    }
                    if ((highestBlock - _blockchainState.status.currentBlock) < _blockRetrievalRestart) {
                        _blockCursor = _blockchainState.status.currentBlock;
                        let nextBlock = _blockCursor + 1;
                        let arrearBlocks = highestBlock - nextBlock;
                        if (arrearBlocks < 0) {
                            log.info(_blockchainName, `Resuming from block: ${nextBlock} (when node catches up from its current highest block ${highestBlock})`);
                        } else {
                            log.info(_blockchainName, `Resuming from block: ${nextBlock} (${arrearBlocks} blocks behind the highest block ${highestBlock} on node)`);
                        }
                    }
                } else {
                    _blockCursor = highestBlock - 1;
                    log.info(_blockchainName, `Starting from highest block on node: ${highestBlock}`);
                }
            }
            // Initialise transaction listener
            initBlockchainListener();

            // Periodically node details, status information and account balances
            updateNodeInfo();
            setInterval(updateNodeInfo, INFOINTERVAL);
            updateNodeStatus();
            setInterval(updateNodeStatus, STATUSINTERVAL);
            updateAccounts();
            setInterval(updateAccounts, STATUSINTERVAL);

            // Done initialising
            wfState.updateBlockchainData(_blockchainName, _blockchainState);
            return callback(null, _blockchainName);
        }).catch(function web3GetBlockNumberError(err) {
            return callback(new Error(`Could not initialise transaction listener: ${err.message}`), _blockchainName);
        });
    });
}

/**
 * Sends an encoded message on the Ethereum blockchain
 * @function sendMessage
 * @alias module:lib/blockchains/ethereum.sendMessage
 * @param {wfMessage} wfMessage the Whiteflag message to be sent on Ethereum
 * @param {blockchainSendMessageCb} callback function to be called after sending Whiteflag message
 */
function sendMessage(wfMessage, callback) {
    // Get correct Ethereum account
    const account = getAccount(wfMessage.MetaHeader.originatorAddress);
    if (!account) return callback(new ProcessingError(`${_blockchainName} account does not exist: ${wfMessage.MetaHeader.originatorAddress}`));

    // Create and send Ethereum transaction
    sendTransaction(account, account.address, _transactionValue, wfMessage.MetaHeader.encodedMessage,
        function ethSendMessageCb(err, transactionHash, blockNumber) {
            if (err) return callback(err, _blockchainName);
            return callback(null, transactionHash, blockNumber);
        }
    );
}

/**
 * Performs a simple query to find a message on Ethereum by transaction hash
 * @function lookupMessage
 * @alias module:lib/blockchains/ethereum.lookupMessage
 * @param {Object} wfQuery the property of the transaction to look up
 * @param {blockchainLookupMessageCb} callback function to be called after Whiteflag message lookup
 */
function lookupMessage(wfQuery, callback) {
    log.trace(_blockchainName, 'Performing query: ' + JSON.stringify(wfQuery));

    // Currently, only transaction hash queries are performed
    const transactionHash = wfQuery['MetaHeader.transactionHash'];

    // Get transaction from blockchain node
    timeoutPromise(_web3.eth.getTransaction(ethFormatHex(transactionHash)), _rpcTimeout)
    .then(function ethGetTransactionResolve(transaction) {
        // Check resulting transaction
        if (!transaction) {
            return callback(new ProcessingError(`Transaction hash not found on ${_blockchainName}: ${transactionHash}`, null, 'WF_API_NO_DATA'));
        }
        if (!transaction.input || !transaction.input.startsWith(ETHHEXPREFIX + WFINDENTIFIER)) {
            return callback(new ProcessingError(`Transaction ${transactionHash} is not a Whiteflag message`), null, 'WF_API_NO_DATA');
        }
        // Put transaction details in new Whiteflag message metaheader
        let wfMessage = {};
        try {
            wfMessage = extractMessage(transaction);
        } catch(err) {
            log.error(_blockchainName, `Error caught extracting Whiteflag message from transaction ${JSON.stringify(transaction)}: ${err.toString()}`);
            return callback(err);
        }
        // Return the found Whiteflag message
        log.trace(_blockchainName, 'Retrieved Whiteflag message: ' + JSON.stringify(wfMessage));
        return callback(null, wfMessage);
    }, function ethGetTransactionReject(err) {
        return callback(new Error(`Could not retrieve Whiteflag message: ${err.message}`));
    }).catch(function ethGetTransactionError(err) {
        log.error(_blockchainName, `Unhandled rejection while retrieving Whiteflag message: ${err.toString()}`);
        return callback(err);
    });
}

/**
 * Gets the Ethereum transaction in Whiteflag message structure
 * @function getTransaction
 * @alias module:lib/blockchains/ethereum.getTransaction
 * @param {string} transactionHash function to be called upon completion
 * @param {blockchainDeleteAccountCb} callback function to be called upon completion
 */
function getTransaction(transactionHash, callback) {
    getRawTransaction(ethFormatHex(transactionHash))
    .then(function ethGetRawTransactionResolve(transaction) {
        // Check resulting transaction
        if (!transaction) {
            return callback(new Error(`No data received for transaction hash: ${transactionHash}`));
        }
        if (!transaction.input || !transaction.input.startsWith(ETHHEXPREFIX + WFINDENTIFIER)) {
            return callback(new ProcessingError(`Transaction ${transactionHash} is not a Whiteflag message`), null, 'WF_API_NO_DATA');
        }
        // Put transaction details in new Whiteflag message metaheader
        let wfMessage = {};
        try {
            wfMessage = extractMessage(transaction);
        } catch(err) {
            log.error(_blockchainName, `Error caught extracting Whiteflag message from transaction ${transaction.hash}: ${err.toString()}`);
            return callback(err);
        }
        // Return the found Whiteflag message
        return callback(null, wfMessage);
    }, function ethGetRawTransactionReject(err) {
        return callback(new Error(`Could not retrieve raw transaction: ${err.message}`));
    }).catch(function ethGetRawTransactionError(err) {
        log.error(_blockchainName, `Unhandled rejection while retrieving raw transaction: ${err.toString()}`);
        return callback(err);
    });
}

/**
 * Requests a Whiteflag signature for a specific Ethereum address
 * @function requestSignature
 * @alias module:lib/blockchains/ethereum.requestSignature
 * @param {wfSignaturePayload} signPayload the JWS payload for the Whiteflag signature
 * @param {blockchainRequestSignatureCb} callback function to be called upon completion
 */
function requestSignature(signPayload, callback) {
    let wfSignatureArray = [];
    let wfSignature = {
        protected: '',
        payload: '',
        signature: ''
    };

    // Get Ethereum account and address
    const account = getAccount(signPayload.addr);
    if (!account) return callback(new ProcessingError(`${_blockchainName} account does not exist: ${signPayload.addr}`));
    signPayload.addr = apiFormatAddress(account.address);

    // Create JWS token and split into array
    const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
    wfState.getKey('blockchainKeys', privateKeyId, function ethGetKeyCb(err, privateKey) {
        if (err) return callback(err);
        try {
            const keyEncoder = new KeyEncoder(SIGNKEYTYPE);
            const originatorPrivateKey = keyEncoder.encodePrivate(apiFormatHex(privateKey), 'raw', 'pem');
            wfSignatureArray = jwt.sign(signPayload, originatorPrivateKey, { algorithm: SIGNALGORITHM }).split('.');
        } catch(err) {
            log.error(_blockchainName, `Could not not sign payload: ${err.message}`);
            return callback(err);
        }
        // Create JSON serialization of JWS token from array
        wfSignature.protected = wfSignatureArray[0];
        wfSignature.payload = wfSignatureArray[1];
        wfSignature.signature = wfSignatureArray[2];

        // Callback with any error and signature
        return callback(null, wfSignature);
    });
}

/**
 * Requests the Ethereum address and correctly encoded pubic key of an originator
 * @function requestKeys
 * @alias module:lib/blockchains/ethereum.requestKeys
 * @param {string} originatorPubKey the raw hex public key of the originator
 * @param {blockchainRequestKeysCb} callback function to be called upon completion
 */
function requestKeys(originatorPubKey, callback) {
    let originatorKeys = {};
    try {
        // Signature Key in PEM encoding
        const keyEncoder = new KeyEncoder(SIGNKEYTYPE);
        originatorKeys.pubkey = apiFormatPubkey(originatorPubKey);
        originatorKeys.pemkey = keyEncoder.encodePublic(originatorKeys.pubkey, 'raw', 'pem');

        // Keccak double check
        let keccakPubkeyBuffer;
        if (originatorKeys.pubkey.length === 130) keccakPubkeyBuffer = Buffer.from(originatorKeys.pubkey.substr(2), BINENCODING);
            else keccakPubkeyBuffer = Buffer.from(originatorKeys.pubkey, BINENCODING);
        originatorKeys.keccak = keccak('keccak256').update(keccakPubkeyBuffer).digest('hex');

        // Ethereum Address
        const pubkeyBuffer = Buffer.from(originatorKeys.pubkey, BINENCODING);
        originatorKeys.address = apiFormatAddress(ethereumUtil.pubToAddress(pubkeyBuffer, true).toString(BINENCODING));
    } catch(err) {
        log.error(_blockchainName, `Could not get key and address: ${err.message}`);
        return callback(err);
    }
    return callback(null, originatorKeys);
}

/**
 * Returns an Ethereum address in binary encoded form
 * @param {string} address the blockchain address
 * @param {blockchainBinaryAddressCb} callback function to be called upon completion
 */
function getBinaryAddress(address, callback) {
    if (_web3.utils.isAddress(ethFormatHex(address))) {
        return callback(null, Buffer.from(apiFormatAddress(address), BINENCODING));
    }
    return(new Error(`Invalid Ethereum address: ${ethFormatHex(address)}`));
}

/**
 * Transfers ether from one Ethereum address to an other address
 * @function transferValue
 * @alias module:lib/blockchains/ethereum.transferValue
 * @param {Object} transfer the object with the transaction details to transfer value
 * @param {blockchainTransferValueCb} callback function to be called upon completion
 */
function transfer(transfer, callback) {
    const account = getAccount(transfer.fromAddress);
    if (!account) return callback(new ProcessingError(`${_blockchainName} account does not exist: ${transfer.fromAddress}`));

    // Create and send transaction
    sendTransaction(account, transfer.toAddress, transfer.value, '', function ethValueTransferCb(err, transactionHash, blockNumber) {
        if (err) return callback(err);
        return callback(null, transactionHash, blockNumber);
    });
}

/**
 * Creates a new Ethereum blockchain account
 * @function createAccount
 * @alias module:lib/blockchains/ethereum.createAccount
 * @param {string} [privateKey] hexadecimal encoded private key
 * @param {blockchainCreateAccountCb} callback function to be called upon completion
 */
function createAccount(privateKey, callback) {
    // Create a new Ethereum account
    let newEthAccount;
    try {
        if (privateKey) {
            newEthAccount = _web3.eth.accounts.privateKeyToAccount(ethFormatHex(privateKey));
        } else {
            newEthAccount = _web3.eth.accounts.create(crypto.randomBytes(64));
        }
        // Hopefully the garbage collector will do its work
        privateKey = undefined;
    } catch(err) {
        privateKey = undefined;
        log.error(_blockchainName, `Error caught while creating new blockchain account: ${err.toString()}`);
        return callback(err);
    }
    // web3 does not expose public key; using ethereumjs-util instead
    const publicKey = ethereumUtil.privateToPublic(newEthAccount.privateKey);
    const account = {
        address: apiFormatAddress(newEthAccount.address),
        publicKey: apiFormatPubkey(publicKey.toString(BINENCODING)),
        transactionCount: 0
    };
    // Check for existing account and store account
    const existingAccount = getAccount(account.address);
    if (existingAccount && existingAccount.address === account.address) {
        let err = new ProcessingError(`A ${_blockchainName} account with address ${account.address} already exists`, null, 'WF_API_RESOURCE_CONFLICT');
        return callback(err, existingAccount);
    }
    upsertAccount(account);
    // Securely store the private key in state
    const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
    wfState.upsertKey('blockchainKeys', privateKeyId, apiFormatHex(newEthAccount.privateKey));
    delete newEthAccount.privateKey;

    // Log and return result
    log.info(_blockchainName, `Blockchain account created: ${account.address}`);
    return callback(null, account);
}

/**
 * Updates Ethereum blockchain account attributes
 * @function updateAccount
 * @param {Object} account the account information including address to be updated
 * @alias module:lib/blockchains/ethereum.updateAccount
 * @param {blockchainUpdateAccountCb} callback function to be called upon completion
 */
function updateAccount(account, callback) {
    if (!getAccount(account.address)) {
        return callback(new ProcessingError(`${_blockchainName} account does not exist: ${account.address}`), null, 'WF_API_NO_RESOURCE');
    }
    // Securely store the private key in state
    if (account.privateKey) {
        const privateKeyId = hash(_blockchainName + account.address, KEYIDLENGTH);
        wfState.upsertKey('blockchainKeys', privateKeyId, apiFormatHex(account.privateKey));
        delete account.privateKey;
    }
    // Update state with new or updated account
    try {
        upsertAccount(account);
    } catch(err) {
        return callback(new Error(`Could not update ${_blockchainName} account: ${err.message}`));
    }
    log.debug(_blockchainName, `Blockchain account updated: ${account.address}`);
    return callback(null, account);
}

/**
 * Deletes Ethereum blockchain account
 * @function deleteAccount
 * @alias module:lib/blockchains/ethereum.deleteAccount
 * @param {string} address the address of the account to be deleted
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

// PRIVATE MODULE FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}

// PRIVATE BLOCKCHAIN DATA CONVERSION FUNCTIONS //
/**
 * Gets URL of the Ethereum blockchain node from the configuration
 * @private
 * @param {Object} bcConfig blockchain configuration parameters
 * @param {boolean} hideCredentials whether to inlude username and password in url
 * @returns {string} the url of the Ethereum node
 */
function getNodeURL(bcConfig, hideCredentials = false) {
    const rpcProtocol = (bcConfig.rpcProtocol || 'http') + '://';
    const rpcHost = bcConfig.rpcHost || 'localhost';
    const rpcPort = ':' + (bcConfig.rpcPort || '8545');
    const rpcPath = bcConfig.rpcPath || '';
    let rpcAuth = '';
    if (bcConfig.username && bcConfig.password && !hideCredentials) {
        rpcAuth = bcConfig.username + ':' + bcConfig.password + '@';
    }
    return (rpcProtocol + rpcAuth + rpcHost + rpcPort + rpcPath);
}

/**
 * Extracts Whiteflag message from Ethereum transaction data
 * @private
 * @param {Object} transaction
 * @param {number} timestamp the block time
 * @returns {wfMessage} wfMessage a Whiteflag message
 */
function extractMessage(transaction, timestamp) {
    // Get raw transaction data
    const rawTransactionObject = {
        nonce: transaction.nonce,
        gasPrice: ethereumUtil.bufferToHex(new ethereumUtil.BN(transaction.gasPrice)),
        gasLimit: transaction.gas,
        to: transaction.to,
        value: ethereumUtil.bufferToHex(new ethereumUtil.BN(transaction.value)),
        data: transaction.input,
        r: transaction.r,
        s: transaction.s,
        v: transaction.v
    };
    const ethTransactionObject = new EthereumTx(rawTransactionObject, { chain: _chainID });
    const originatorPubKey = ethereumUtil.bufferToHex(ethTransactionObject.getSenderPublicKey());

    // Construct and return Whiteflag message object
    const wfMessage = {
        MetaHeader: {
            blockchain: _blockchainName,
            blockNumber: transaction.blockNumber,
            transactionHash: apiFormatHex(transaction.hash),
            originatorAddress: apiFormatAddress(transaction.from),
            originatorPubKey: apiFormatPubkey(originatorPubKey),
            encodedMessage: apiFormatHex(transaction.input)
        }
    };
    if (timestamp) wfMessage.MetaHeader.transactionTime = new Date(timestamp * 1000).toISOString();
    return wfMessage;
}

// PRIVATE KEY AND ADDRESS FORMATTERS //
/**
 * Ensures that keys are in generic api format
 * @private
 */
function apiFormatHex(hexString) {
    // The api uses keys WITHOUT 0x prefix
    if (!hexString) return null;
    if (hexString.substring(0, 2) === ETHHEXPREFIX) {
        return hexString.substr(2).toLowerCase();
    }
    return hexString.toLowerCase();
}

/**
 * Ensures that addresses are in generic api format
 * @private
 */
function apiFormatAddress(addressHexString) {
    // The api addresses keys WITHOUT 0x prefix
    // Note that Ethereum addresses use capitials as a checksum, so no toLowerCase()
    if (!addressHexString) return null;
    if (addressHexString.substring(0, 2) === ETHHEXPREFIX) {
        return addressHexString.substr(2);
    }
    return addressHexString;
}

/**
 * Ensures that public keys are in generic api format
 * @private
 */
function apiFormatPubkey(pubkeyHexString) {
    // The api uses uncompressed keys, WITHOUT 0x prefix, but WITH the SEC 0x04 prefix byte
    if (!pubkeyHexString) return null;
    pubkeyHexString = apiFormatHex(pubkeyHexString);
    if (pubkeyHexString.length === 128) {
        pubkeyHexString = SECPUBKEYPREFIX + pubkeyHexString;
    }
    return pubkeyHexString;
}

/**
 * Ensures that addresses and keys are in Ethereum format
 * @private
 */
function ethFormatHex(hexString) {
    // Ethereum uses all hex strings WITH 0x prefix
    if (hexString.substring(0, 2) !== ETHHEXPREFIX) {
        return ETHHEXPREFIX + hexString;
    }
    return hexString;
}

// PRIVATE BLOCKCHAIN STATUS FUNCTIONS //
/**
 * Requests some semi-static Ethereum blockchain information
 * @private
 */
function updateNodeInfo() {
    Promise.all([
        timeoutPromise(_web3.eth.net.getId(), 1000),
        timeoutPromise(_web3.eth.getProtocolVersion(), 1000)
    ]).then(function ethNodeInfoResolve(status) {
        // Update blockchain state
        _blockchainState.parameters.networkID = status[0];
        _blockchainState.parameters.protocolVersion = status[1];
    }).catch(function ethNodeInfoError(err) {
        log.warn(_blockchainName, `Could not update parameters: ${err.message}`);
    });
}

/**
 * Requests some dynamic Ethereum blockchain node status information
 * @private
 */
function updateNodeStatus() {
    Promise.all([
        timeoutPromise(_web3.eth.net.getPeerCount(), 1000),
        timeoutPromise(_web3.eth.isSyncing(), 1000),
        timeoutPromise(_web3.eth.getGasPrice(), 1000)
    ]).then(function ethNodeStatusResolve(status) {
        // Update blockchain state
        _blockchainState.status.updated = new Date().toISOString();
        _blockchainState.status.peers = status[0];
        _blockchainState.status.syncing = status[1];
        _blockchainState.status.gasPrice = status[2];

        // Update node status in state
        wfState.updateBlockchainData(_blockchainName, _blockchainState);
        log.debug(_blockchainName, `Status: { ${JSON.stringify(_blockchainState.parameters)}, ${JSON.stringify(_blockchainState.status)} }`);
    }).catch(function ethNodeStatusError(err) {
        log.warn(_blockchainName, `Could not update status: ${err.message}`);
    });
}

/**
 * Updates all Ethereum blockchain accounts
 * @private
 */
function updateAccounts() {
    _blockchainState.accounts.forEach(account => {
        getBalance(account.address, function ethUpdateBalanceCb(err, balance) {
            if (err) return log.warn(_blockchainName, `Could not update balance for account ${account.address}: ${err.message}`);
            account.balance = _web3.utils.fromWei(balance, 'ether');
        });
        getTransactionCount(account.address, function ethUpdateTxCountCb(err, transactionCount) {
            if (err) return log.warn(_blockchainName, `Could not update transaction count for account ${account.address}: ${err.message}`);
            account.transactionCount = transactionCount;
        });
    });
    wfState.updateBlockchainData(_blockchainName, _blockchainState);
}

/**
 * Gets the balance of the specified Ethereum blockchain account
 * @private
 */
function getBalance(address, callback) {
    timeoutPromise(_web3.eth.getBalance(ethFormatHex(address)), _rpcTimeout)
    .then(function web3GetBalanceResolve(balance) {
        return callback(null, balance);
    }).catch(function web3GetBalanceError(err) {
        return callback(err);
    });
}

/**
 * Gets the transaction count of the specified Ethereum blockchain account
 * @private
 */
function getTransactionCount(address, callback) {
    timeoutPromise(_web3.eth.getTransactionCount(ethFormatHex(address)), _rpcTimeout)
    .then(function web3GetTransactionCountResolve(count) {
        return callback(null, count);
    }).catch(function web3GetTransactionCountError(err) {
        return callback(err);
    });
}

// PRIVATE BLOCKCHAIN TRANSACTION TX FUNCTIONS //
/**
 * Sends a transaction on the Ethereum blockchain
 * @private
 * @param {Object} account the account parameters used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} value the value to be sent in ether
 * @param {string} data the data to be sent
 * @param {function(Error, transactionHash, blockNumber)} callback function to be called upon completion
 * @typedef {string} transactionHash the transaction hash of the successful transfer
 * @typedef {number} blockNumber the blocknumber of the successful transfer transaction
 */
function sendTransaction(account, toAddress, value, data, callback) {
    // Create transaction object with all parameters
    createTransaction(account, toAddress, value, data, function ethCreateTransactionCb(err, rawTransactionObject) {
        if (err) return callback(err);

        // Sign the transaction
        const privateKeyId = hash(_blockchainName + apiFormatAddress(account.address), KEYIDLENGTH);
        wfState.getKey('blockchainKeys', privateKeyId, function ethGetKeyCb(err, privateKey) {
            if (err) return callback(err);

            // Sign and serialise transaction
            let rawTransaction;
            try {
                const ethTransactionObject = new EthereumTx(rawTransactionObject, { chain: _chainID });
                const privateKeyBuffer = Buffer.from(privateKey, BINENCODING);
                ethTransactionObject.sign(privateKeyBuffer);
                zeroise(privateKeyBuffer);

                const serializedTransaction = ethTransactionObject.serialize();
                rawTransaction = ethFormatHex(serializedTransaction.toString(BINENCODING));
            } catch(err) {
                return callback(new Error(`Could not create raw transaction: ${err.message}`));
            }
            // The web3 API is not stable and might not fire a receipt event; therefore extra checks
            let receiptRetryCount = 0;
            let transactionCompleted = false;
            let transactionConfirmation = false;
            let transactionHash = '';

            // Send signed transaction and process mined receipt
            _web3.eth.sendSignedTransaction(rawTransaction)
            // eslint-disable-next-line brace-style
            .once('transactionHash', hash => { transactionHash = apiFormatHex(hash); })
            .once('receipt', sendTransactionSuccess)
            .on('confirmation', sendTransactionConfirmation)
            .on('error', sendTransactionCheckResult)
            .then(sendTransactionSuccess, sendTransactionCheckResult)
            .catch(sendTransactionCheckResult);

            /**
             * Invoked when transaction is confirmed
             * @private
             */
            function sendTransactionConfirmation(confNumber, receipt) {
                if (!transactionConfirmation) {
                    if (receipt) {
                        log.debug(_blockchainName, `Received receipt upon confirmation ${confNumber} of transaction: ${apiFormatHex(receipt.transactionHash)}`);
                        transactionConfirmation = true;
                        return sendTransactionSuccess(receipt);
                    }
                    if (confNumber > 1 && transactionHash) {
                        log.warn(_blockchainName, `Still trying to get receipt after ${confNumber} confirmations of transaction: ${transactionHash}`);
                        transactionConfirmation = true;
                        return sendTransactionGetReceipt();
                    }
                    return log.trace(_blockchainName, `Received ${confNumber} confirmations without receipt for transaction: ${transactionHash}`);
                }
            }
            /**
             * Invoked when transaction is completed /resolved
             * @private
             */
            function sendTransactionSuccess(receipt) {
                if (!transactionCompleted) {
                    // Sometimes no receipt is available
                    if (!receipt || !receipt.transactionHash || !receipt.blockNumber) {
                        // If transaction hash is known try to get receipt later
                        if (transactionHash) return setTimeout(sendTransactionGetReceipt, _blockInterval);
                        sendTransactionError(new Error('No receipt and transaction hash available after sending raw transaction'));
                    }
                    // Transaction completed with receipt
                    transactionCompleted = true;
                    return callback(null, apiFormatHex(receipt.transactionHash), receipt.blockNumber);
                }
            }
            /**
             * Invoked when no receipt is available for transaction
             * @private
             */
            function sendTransactionGetReceipt() {
                if (!transactionCompleted) {
                    receiptRetryCount += 1;
                    log.trace(_blockchainName, `Attempt ${receiptRetryCount} to retrieve receipt for transaction: ${transactionHash}`);
                    timeoutPromise(_web3.eth.getTransactionReceipt(ethFormatHex(transactionHash)), _rpcTimeout)
                    .then(function sendTransactionGetReceiptResolve(receipt) {
                        if ((!receipt || !receipt.transactionHash || !receipt.blockNumber) && receiptRetryCount > MAXRETRIES) {
                            log.warn(_blockchainName, `Could not get receipt after ${receiptRetryCount} attempts for transaction: ${transactionHash}`);
                            transactionCompleted = true;
                            return callback(null, transactionHash);
                        }
                        if (receipt && receipt.transactionHash && receipt.blockNumber) {
                            log.debug(_blockchainName, `Received requested receipt after ${receiptRetryCount} attempts for transaction: ${receipt.transactionHash}`);
                        }
                        return sendTransactionSuccess(receipt);
                    }).catch(function sendTransactionGetReceiptError(err) {
                        log.warn(_blockchainName, `Could not get receipt for transaction: ${transactionHash}: ${err.message}`);
                        return sendTransactionSuccess(null);
                    });
                }
            }
            /**
             * Invoked upon transaction error
             * @private
             */
            function sendTransactionError(err) {
                if (!transactionCompleted) {
                    transactionCompleted = true;
                    return callback(new Error(`Error while sending raw transaction: ${err.message}`));
                }
            }
            /**
             * Invoked when result is unclear, e.g. upon error / rejection
             * @private
             */
            function sendTransactionCheckResult(result) {
                if (!transactionCompleted) {
                    // Check if result is an error
                    if (result instanceof Error) {
                        sendTransactionError(result);
                    }
                    // The result might be an object with receipt and confirmations instead
                    if (result.receipt) {
                        log.warn(_blockchainName, `Unclear result of transaction ${apiFormatHex(result.receipt.transactionHash)}, but received receipt: ${JSON.stringify(result)}`);
                        return sendTransactionSuccess(result.receipt);
                    }
                    if (result.confirmations && transactionHash) {
                        log.warn(_blockchainName, `Unclear result of transaction ${transactionHash}, but received confirmation ${transactionHash}: ${JSON.stringify(result)}`);
                        return sendTransactionConfirmation(result.confirmations, result.receipt);
                    }
                    // Try to get receipt if transcation hash is known
                    if (transactionHash) {
                        log.warn(_blockchainName, `Trying to get receipt after unclear result of transaction ${transactionHash}: ${JSON.stringify(result)}`);
                        return sendTransactionGetReceipt();
                    }
                    // Assume error if nothing is known
                    return sendTransactionError(new Error(`Unclear transaction result: ${JSON.stringify(result)}`));
                }
            }
        });
    });
}

/**
 * Creates a new Ethereum transaction to be signed
 * @private
 * @param {Object} account the account parameters used to send the transaction
 * @param {string} toAddress the address to send the transaction to
 * @param {string} value the value to be sent in ether
 * @param {string} data the data to be sent
 * @param {function(Error, rawTransactionObject)} callback function to be called upon completion
 * @typedef {Object} rawTransactionObject
 */
function createTransaction(account, toAddress, value, data, callback) {
    // Get transaction count and gas limit and price
    getTransactionCount(account.address, function ethGetTransactionCountCb(err, txCount) {
        if (err) return callback(new Error(`Could not get transaction count: ${err.message}`));
        getTransationGas(toAddress, data, function ethGetTransactionGasCb(err, gasLimit, gasPrice) {
            if (err) return callback(new Error(`Could not get transaction gas: ${err.message}`));

            // Create transaction object
            const rawTransactionObject = {
                nonce: _web3.utils.toHex(txCount),
                to: ethFormatHex(toAddress),
                value: _web3.utils.toHex(_web3.utils.toWei(value, 'ether')),
                gasLimit: _web3.utils.toHex(gasLimit),
                gasPrice: _web3.utils.toHex(gasPrice),
                data: ethFormatHex(data)
            };
            return callback(null, rawTransactionObject);
        });
    });
}

/**
 * Gets Ethereum blockchain gas limit and gas price
 * @private
 * @param {string} toAddress the address to send the transaction to
 * @param {string} data the data to be sent
 * @param {function(Error, gasLimit, gasPrice)} callback function to be called upon completion
 * @typedef {number} gasLimit gas limit
 * @typedef {number} gasPrice gas price
 */
function getTransationGas(toAddress, data, callback) {
    Promise.all([
        _web3.eth.estimateGas({
            to: ethFormatHex(toAddress),
            data: ethFormatHex(data)
        }),
        _web3.eth.getGasPrice()
    ]).then(function web3GetTransactionGasResolve(gas) {
        const gasLimit = gas[0];
        const gasPrice = gas[1];
        return callback(null, gasLimit, gasPrice);
    }).catch(function web3GetTransactionGasError(err) {
        return callback(err);
    });
}

// PRIVATE BLOCKCHAIN TRANSACTION RX FUNCTIONS //
/*
* The functions below retrieve Ethereum blockchain data, then the blocks and then for each
* block the transactions. To assure the data is retrieved in a controlled and sequential
* manner, promises are used. When one block has succesfully been processed, the next
* block will be processed. If an error occurs while retrieving a block, the block
* will be retrieved again until successfully processed. To optimize retrieval of data,
* transactions for a single block will be retrieved in a batch, based on the batch number
* configuration parameter.
*/

/**
 * Initiates the functions for retrieving data from the Ethereum blockchain
 * @private
 */
function initBlockchainListener() {
    scheduleBlockchainData();
}

/**
 * Schedules blockchain data retrieval
 * @private
 */
function scheduleBlockchainData() {
    log.trace(_blockchainName, `Scheduling block retrieval iteration ${(_iterationCount + 1)} in ${_blockInterval} ms`);
    setTimeout(getBlockchainData, _blockInterval);
}

/**
 * Gets transactions from unprocessed blocks and re-schedules itself
 * @private
 */
function getBlockchainData() {
    _iterationCount += 1;
    log.trace(_blockchainName, `Starting block retrieval iteration ${_iterationCount}`);

    // Get the actual Ethereum blockchain height
    timeoutPromise(_web3.eth.getBlockNumber(), _rpcTimeout)
    .then(function web3GetBlockNumberResolve(highestBlock) {
        _blockchainState.status.highestBlock = highestBlock;

        // Check if highest block is already processed, and schedule next iteration
        if (highestBlock === _blockCursor) {
            log.trace(_blockchainName, `Highest block ${highestBlock} has already been processed`);
            return scheduleBlockchainData();
        }
        // Current block may be higher than highest block when node is resyncing
        if (_blockCursor > highestBlock) {
            log.debug(_blockchainName, `Current block ${_blockCursor} is higher than highest block ${highestBlock} on node`);
            return scheduleBlockchainData();
        }
        // Check if one more new block exists
        if (_blockRetrievalEnd === 0 && highestBlock !== _discoveredBlock) {
            _discoveredBlock = highestBlock;
            log.trace(_blockchainName, `New highest block discovered on node: ${_discoveredBlock}`);
        }
        // Last block to retrieve is highest block or, if provided, end block
        let endBlock = highestBlock;
        if (_blockRetrievalEnd > 0 && _blockRetrievalEnd < highestBlock) {
            endBlock = _blockRetrievalEnd;
            log.trace(_blockchainName, `Last block to be retrieved is set to ending block in configuration: ${endBlock}`);
        }
        // Process blocks sequentially while counting iterations
        _blockStackSize = 0;
        getBlocks(_blockCursor, endBlock, function ethGetBlocksCb(err) {
            if (err) {
                // Warn if error, and schedule next try
                log.warn(_blockchainName, err.message);
                return scheduleBlockchainData();
            }
            // Stop further processing if an end blocknumber is provided and reached
            if (_blockCursor === _blockRetrievalEnd && _blockRetrievalEnd < highestBlock) {
                log.info(_blockchainName, `Reached configured block retrieval end: ${_blockCursor}`);
                _blockRetrievalEnd = 0;

                // Determine from where to pick up the blockchain after end
                if ((highestBlock - _blockCursor) > _blockRetrievalRestart) {
                    _blockCursor = highestBlock - _blockRetrievalRestart - 1;
                    let nextBlock = _blockCursor + 1;
                    let arrearBlocks = highestBlock - nextBlock;
                    log.info(_blockchainName, `Resuming from block: ${nextBlock} (${arrearBlocks} blocks behind highest block ${highestBlock} on node)`);
                }
                if ((highestBlock - _blockCursor) <= _blockRetrievalRestart) {
                    let nextBlock = _blockCursor + 1;
                    log.info(_blockchainName, `Resuming from block: ${nextBlock}`);
                }
                // Start normal operation by scheduling next iteration
                return scheduleBlockchainData();
            }
            // Continue processing and get next set of blockst
            return getBlockchainData();
        });
    }, function web3GetBlockNumberReject(err) {
        log.warn(_blockchainName, `Could not determine highest block on node: ${err.message}`);
        return scheduleBlockchainData();
    }).catch(function web3GetBlockError(err) {
        log.warn(_blockchainName, `Could not retrieve blockchain data from node: ${err.message}`);
        return scheduleBlockchainData();
    });
}

/**
 * Processes transactions from multiple blocks
 * @private
 * @param {number} startBlock the block after which the next blocks are processed
 * @param {number} endBlock the block up to which blocks should be processed
 * @param {function(Error)} callback function to call upon completion
 */
function getBlocks(startBlock, endBlock, callback) {
    // Stack callbacks to a maximum of 100
    _blockStackSize += 1;
    if (_blockStackSize > BLOCKSTACKSIZE) {
        log.trace(_blockchainName, 'Reached maximum block callback stack');
        return callback(null);
    }
    // If current block is last block, then there is no new block to retrieve
    if (startBlock === endBlock) {
        log.trace(_blockchainName, 'No new block to retrieve');
        return callback(null);
    }
    // Block to be processed is the next block after starting block and skipped blocks
    if (_skippedBlocks > 0) log.trace(_blockchainName, `Skipped ${_skippedBlocks} blocks since block ${startBlock}`);
    let thisBlock = startBlock + _skippedBlocks + 1;

    // Skip this block if the block has been retried too often
    if (_blockMaxRetries > 0 && _blockRetryCount > _blockMaxRetries) {
        log.warn(_blockchainName, `Skipping block ${thisBlock} after ${_blockMaxRetries} retries`);
        thisBlock += 1;
        _blockRetryCount = 0;
        _skippedBlocks += 1;
    }
    // Log where we are with blocks
    if (_blockRetryCount === 0) {
        log.debug(_blockchainName, `Processing block ${thisBlock} in iteration ${_iterationCount}/${_blockStackSize}`);
    } else {
        log.debug(_blockchainName, `Retry ${_blockRetryCount} to process block ${thisBlock} in iteration ${_iterationCount}/${_blockStackSize}`);
    }
    // Retrieve new block under a timeout
    timeoutPromise(_web3.eth.getBlock(thisBlock), _rpcTimeout)
    .then(function ethGetBlockResolve(block) {
        if (block && block.transactions.length > 0) {
            log.trace(_blockchainName, `Transactions discovered in block ${thisBlock}: ${block.transactions.length}`);

            // Retrieve transactions from block
            getTransactions(0, block.transactions, block.timestamp, function ethGetTransactionsCb(err) {
                // Error occured, retry the block
                if (err) {
                    _blockRetryCount += 1;
                    return callback(new Error(`Could not retrieve transactions in block ${thisBlock}: ${err.message}`));
                }
                // Successfully processed transactions in block
                log.debug(_blockchainName, `Transactions processed from block ${thisBlock}: ${block.transactions.length} `);
                return nextBlock();
            });
        } else {
            // Rare case, but in certain instances there could be no transactions in the block
            log.debug(_blockchainName, `No transactions in block ${thisBlock}`);
            return nextBlock();
        }
    }).catch(function ethGetBlockError(err) {
        _blockRetryCount += 1;
        if (!err) err = new Error('Unknown error');
        return callback(new Error(`Could not retrieve data from block ${thisBlock}: ${err.message}`));
    });
    /**
     * Calls parent function to process next block
     * @private
     */
    function nextBlock() {
        // Update current block index
        _blockCursor = thisBlock;

        // Reset retry counter
        _blockRetryCount = 0;
        _skippedBlocks = 0;

        // Update state
        _blockchainState.status.currentBlock = _blockCursor;
        wfState.updateBlockchainData(_blockchainName, _blockchainState);

        // Get next block if not yet at last block
        if (thisBlock < endBlock) {
            return getBlocks(_blockCursor, endBlock, function getBlocksCb(err) {
                if (err) return callback(err);
                return callback(null);
            });
        } else {
            return callback(null);
        }
    }
}

/**
 * Gets multiple transactions from an Ethereum block
 * @private
 * @param {number} index the first transaction in the array to process
 * @param {array} transactions the transactions to process
 * @param {number} timestamp the block timestamp
 * @param {function(Error)} callback function to be called upon completion
 */
function getTransactions(index, transactions, timestamp, callback) {
    getTransactionBatch(index, transactions, timestamp, function ethGetTransactionBatchCb(err, transactionPromises) {
        if (err) return callback(err);

        // Nothing to do if no transaction promises
        if (!transactionPromises) {
            log.warn(_blockchainName, `No transactions in batch ${(index + 1)} - ${(Math.min(index + _transactionBatchSize, transactions.length))} of ${transactions.length} transactions`);
            return callback(null);
        }
        // Resolve all transaction promises
        Promise.all(transactionPromises)
        .then(function ethGetTransactionsAllResolve(data) {
            // Whiteflag message is already succesfully extracted, so we may discard all transaction data
            ignore(data);
            data = undefined;

            // Trace transaction batch
            if (_traceRawTransaction) log.trace(_blockchainName, `Processed transactions ${(index + 1)} - ${(Math.min(index + _transactionBatchSize, transactions.length))} of ${transactions.length} transactions`);

            // Next batch
            if ((index + _transactionBatchSize) < transactions.length - 1) {
                getTransactions((index + _transactionBatchSize), transactions, timestamp, function ethGetTransactionsCb(err) {
                    if (err) return callback(err);
                    return callback(null);
                });
            } else {
                return callback(null);
            }
        }).catch(function ethGetTransactionsError(err) {
            if (!err) err = new Error(`Unknown error while processing transactions in batch ${(index + 1)} to ${(Math.min(index + _transactionBatchSize, transactions.length))}`);
            return callback(err);
        });
    });
}

/**
 * Gets multiple transactions from an Ethereum block as promises in an array
 * @private
 * @param {number} index the first transaction in the array to process
 * @param {array} transactions the transactions to process
 * @param {number} timestamp the block timestamp
 * @param {function(Error, transactionPromises)} callback function to be called upon completion
 * @typedef {Array} transactionPromises
 */
function getTransactionBatch(index, transactions, timestamp, callback) {
    let transactionPromises = [];

    // Combine transactions promises in an array based on the batch size
    for (
        let i = index;
        i < Math.min(index + _transactionBatchSize, transactions.length);
        i++
    ) {
        // Get a promise for the next transaction
        let transactionHash = transactions[i];
        transactionPromises.push(
            // Whiteflag message is extracted by resolving the promise
            timeoutPromise(getRawTransaction(transactionHash), _rpcTimeout)
            .then(function ethGetRawTransactionResolve(transaction) {
                // Check for Whiteflag prefix in transaction
                if (transaction && transaction.input && transaction.input.startsWith(ETHHEXPREFIX + WFINDENTIFIER)) {
                    // Put transaction details in new Whiteflag message metaheader
                    let wfMessage;
                    try {
                        wfMessage = extractMessage(transaction, timestamp);
                    } catch(err) {
                        return log.error(_blockchainName, `Error extracting Whiteflag message from transaction ${transaction.hash}: ${err.message}`);
                    }
                    // Process the Whiteflag message in the rx event chain
                    log.trace(_blockchainName, 'Received Whiteflag message: ' + JSON.stringify(wfMessage));
                    wfRxEvent.emit('messageReceived', wfMessage);
                }
            })
        );
    }
    // Return array of transaction promises, or null if empty array
    if (transactionPromises.length < 1) return callback(null, null);
    return callback(null, transactionPromises);
}

/**
 * Gets a single transaction from the Ethereum blockchain under a timeout
 * @private
 * @param {string} transactionHash
 * @returns {Promise}
 */
function getRawTransaction(transactionHash) {
    return new Promise((resolve, reject) => {
        // Get transaction
        _web3.eth.getTransaction(transactionHash)
        .then(function web3GetTransactionResolve(transaction) {
            if (_traceRawTransaction) log.trace(_blockchainName, `Raw transaction data received: ${JSON.stringify(transaction)}`);
            resolve(transaction);
        }).catch(function web3GetTransactionError(err) {
            reject(err);
        });
    });
}

// PRIVATE BLOCKCHAIN ACCOUNT FUNCTIONS //
/**
 * Initialises Ethereum accounts and creates one if none exists in the blockchain state
 * @private
 * @param {boolean} create if true a new account is created if none exists
 */
function initAccounts(create) {
    if (create && _blockchainState.accounts.length === 0) {
        createAccount(null, function ethInitCreateAccount(err, account) {
            if (err) log.warn(_blockchainName, err.message);
            ignore(account);
        });
    }
}

/**
 * Updates or inserts an Ethereum account in the blockchain state
 * @private
 * @param {Object} account Ethereum account to be upserted
 */
function upsertAccount(account) {
    // nserting or updating
    let stateAccount = _blockchainState.accounts.find(item => item.address === account.address);
    if (!stateAccount) {
        // Insert new account
        _blockchainState.accounts.push(account);
        log.trace(_blockchainName, `Blockchain account added to state: ${account.address}`);
    } else {
        // Update account
        object.update(account, stateAccount);
        log.trace(_blockchainName, `Blockchain account updated in state: ${account.address}`);
    }
    wfState.updateBlockchainData(_blockchainName, _blockchainState);
}

/**
 * Gets Ethereum account from the blockchain state by address
 * @private
 * @param {string} address the account address
 * @returns {Object} the Ethereum account
 */
function getAccount(address = null) {
    return _blockchainState.accounts.find(account => account.address === address);
}
