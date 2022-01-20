'use strict';
/**
 * @module lib/blockchains/ethereum/rpc
 * @summary Whiteflag API Ethereum RPC module
 * @description Module to connect to the Ethereum network through a Ethereum node
 */
module.exports = {
    init: initRpc,
    getBalance,
    getBlockByNumber,
    getChainId,
    getGasPrice,
    getHighestBlock,
    getNetworkId,
    getNodeInfo,
    getPeerCount,
    getProtocolVersion,
    getRawTransaction,
    getTransactionCount,
    getTransactionReceipt,
    isSyncing,
    sendSignedTransaction
};

// Node.js core and external modules //
const Web3 = require('web3');

// Whiteflag common functions and classes //
const log = require('../../common/logger');
const { timeoutPromise } = require('../../common/processing');

// Whiteflag modules //
const wfState = require('../../protocol/state');

// Ethereum sub-modules //
const { formatHexEthereum } = require('./common');

// Module constants //
const STATUSINTERVAL = 60000; // Every minute
const INFOINTERVAL = 3600000; // Every hour

// Module variables //
let _blockchainName;
let _ethState;
let _web3;
let _chainID = 1;
let _rpcTimeout = 10000;

/**
 * Initialises Ethereum RPC
 * @function initRpc
 * @alias module:lib/blockchains/ethereum/rpc.init
 * @param {Object} ethConfig the Ethereum blockchain configuration
 * @param {Object} ethState the Ethereum blockchain state
 * @returns {Promise} resolve if succesfully initialised
 */
function initRpc(ethConfig, ethState) {
    _blockchainName = ethConfig.name;
    _ethState = ethState;

    // Get Node URL and credentials
    const rpcAuthURL = getNodeURL(ethConfig, false);
    const rpcCleanURL = getNodeURL(ethConfig, true); // no credentials
    _ethState.parameters.rpcURL = rpcCleanURL;
    _web3 = new Web3(rpcAuthURL);
    log.info(_blockchainName, `Using web3 version: ${_web3.version}`);

    // Connect to the Ethereum node
    log.trace(_blockchainName, `Setting up connection with Ethereum node: ${rpcCleanURL}`);
    return new Promise((resolve, reject) => {
        // Check Ethereum chain identifier
        getChainId()
        .then(chainID => {
            // Check for correct chain configuration
            if (ethConfig.chainID) _chainID = ethConfig.chainID;
            if (chainID !== _chainID) {
                return reject(new Error(`The node's Chain ID ${chainID} does not correspond with configured Chain ID ${_chainID}`));
            }
            // We have a connection
            _ethState.parameters.chainID = chainID;
            log.info(_blockchainName, `Connected to Ethereum chain ${chainID} through node: ${rpcCleanURL}`);

            // Set configured timeout
            if (ethConfig.rpcTimeout && ethConfig.rpcTimeout > 500) {
                _rpcTimeout = ethConfig.rpcTimeout;
            }
            log.info(_blockchainName, `Timeout for remote calls to the Ethereum node: ${_rpcTimeout} ms`);

            // Periodically update node parameters and status information
            updateNodeInfo(); setInterval(updateNodeInfo, INFOINTERVAL);
            updateNodeStatus(); setInterval(updateNodeStatus, STATUSINTERVAL);

            // Succesfully completed initialisation
            return resolve(_web3);
        })
        .catch(err => reject(new Error(`Could not connect to Ethereum node: ${err.message}`), _blockchainName));
    });
}

/**
 * Gets the balance of the specified Ethereum blockchain account
 * @function getBalance
 * @alias module:lib/blockchains/ethereum/rpc.getBalance
 * @param {string} address
 * @returns {Promise}
 */
function getBalance(address) {
    return timeoutPromise(_web3.eth.getBalance(formatHexEthereum(address)), _rpcTimeout);
}

/**
 * Gets a block including transaction data by its block number
 * @function getBlockByNumber
 * @alias module:lib/blockchains/ethereum/rpc.getBlockByNumber
 * @param {Object} blockNumber
 * @returns {Promise} resolves to block with transactions
 */
function getBlockByNumber(blockNumber) {
    return timeoutPromise(_web3.eth.getBlock(blockNumber), _rpcTimeout);
}

/**
 * Gets the chain identifier of the node
 * @function getChainId
 * @alias module:lib/blockchains/ethereum/rpc.getChainId
 * @returns {Promise} resolves to the chain identifier
 */
function getChainId() {
    return timeoutPromise(_web3.eth.getChainId(), _rpcTimeout);
}

/**
 * Gets the current gas price
 * @function getGasPrice
 * @alias module:lib/blockchains/ethereum/rpc.getGasPrice
 * @returns {Promise} resolves to gas price
 */
 function getGasPrice() {
    return timeoutPromise(_web3.eth.getGasPrice(), _rpcTimeout);
}

/**
 * Gets the highest block, i.e. the current block count of the longest chains
 * @function getHighestBlock
 * @alias module:lib/blockchains/ethereum/rpc.getHighestBlock
 * @returns {Promise} resolves to highest known block number
 */
function getHighestBlock() {
    return timeoutPromise(_web3.eth.getBlockNumber(), (_rpcTimeout));
}

/**
 * Gets the software and version of the node
 * @function getNodeInfo
 * @alias module:lib/blockchains/ethereum/rpc.getNodeInfo
 * @returns {Promise} resolves to the node information
 */
 function getNodeInfo() {
    return timeoutPromise(_web3.eth.getNodeInfo(), _rpcTimeout);
}

/**
 * Gets the identifier of the network the node is connected to
 * @function getNetworkId
 * @alias module:lib/blockchains/ethereum/rpc.getNetworkId
 * @returns {Promise} resolves to the network identifier
 */
function getNetworkId() {
    return timeoutPromise(_web3.eth.net.getId(), _rpcTimeout);
}

/**
 * Gets the number of peers the node is connected to
 * @function getPeerCount
 * @alias module:lib/blockchains/ethereum/rpc.getPeerCount
 * @returns {Promise} resolves to the number of peers
 */
function getPeerCount() {
    return timeoutPromise(_web3.eth.net.getPeerCount(), _rpcTimeout);
}

/**
 * Gets the Ethereum protocol version of the node
 * @function getProtocolVersion
 * @alias module:lib/blockchains/ethereum/rpc.getProtocolVersion
 * @returns {Promise} resolves to the protocol version
 */
function getProtocolVersion() {
    return timeoutPromise(_web3.eth.getProtocolVersion(), _rpcTimeout);
}

/**
 * Gets a single transaction from the Ethereum blockchain under a timeout
 * @function getRawTransaction
 * @alias module:lib/blockchains/ethereum/rpc.getRawTransaction
 * @param {string} transactionHash
 * @returns {Promise} resolved to the transaction
 */
function getRawTransaction(transactionHash) {
    return timeoutPromise(_web3.eth.getTransaction(formatHexEthereum(transactionHash)), _rpcTimeout);
}

/**
 * Gets the transaction count of the specified Ethereum blockchain account
 * @function getTransactionCount
 * @alias module:lib/blockchains/ethereum/rpc.getTransactionCount
 * @param {string} address
 * @returns {Promise} resolves to the numer of transactions
 */
function getTransactionCount(address) {
    return timeoutPromise(_web3.eth.getTransactionCount(formatHexEthereum(address)), _rpcTimeout);
}

/**
 * Gets the receipt for the specified transaction
 * @function getTransactionReceipt
 * @alias module:lib/blockchains/ethereum/rpc.getTransactionReceipt
 * @param {string} transactionHash
 * @returns {Promise} resolves to a tranasction receipt
 */
function getTransactionReceipt(transactionHash) {
    timeoutPromise(_web3.eth.getTransactionReceipt(formatHexEthereum(transactionHash)), _rpcTimeout);
}

/**
 * Checks if the node is syncing
 * @function isSyncing
 * @alias module:lib/blockchains/ethereum/rpc.isSyncing
 * @returns {Promise} resolves to syncing infomration
 */
function isSyncing() {
    return timeoutPromise(_web3.eth.isSyncing(), _rpcTimeout);
}

/**
 * Sends a raw signed transaction
 * @function getTransactionReceipt
 * @alias module:lib/blockchains/ethereum/rpc.getTransactionReceipt
 * @param {string} rawTransaction the raw signed transaction to be sent
 * @returns {Promise} resolves to a tranasction receipt
 */
function sendSignedTransaction(rawTransaction) {
    return timeoutPromise(_web3.eth.sendSignedTransaction(rawTransaction), (_rpcTimeout * 5));
}

// PRIVATE RPC FUNCTIONS //
/**
 * Gets URL of the Ethereum blockchain node from the configuration
 * @private
 * @param {Object} ethConfig blockchain configuration parameters
 * @param {boolean} hideCredentials whether to inlude username and password in url
 * @returns {string} the url of the Ethereum node
 */
 function getNodeURL(ethConfig, hideCredentials = false) {
    const rpcProtocol = (ethConfig.rpcProtocol || 'http') + '://';
    const rpcHost = ethConfig.rpcHost || 'localhost';
    const rpcPort = ':' + (ethConfig.rpcPort || '8545');
    const rpcPath = ethConfig.rpcPath || '';
    let rpcAuth = '';
    if (ethConfig.username && ethConfig.password && !hideCredentials) {
        rpcAuth = ethConfig.username + ':' + ethConfig.password + '@';
    }
    return (rpcProtocol + rpcAuth + rpcHost + rpcPort + rpcPath);
}

// PRIVATE BLOCKCHAIN STATUS FUNCTIONS //
/**
 * Requests some semi-static Ethereum blockchain information
 * @private
 */
async function updateNodeInfo() {
    // Get node information
    await getNodeInfo()
    .then(nodeInfo => (_ethState.parameters.nodeInfo = nodeInfo))
    .catch(err => log.warn(_blockchainName, `Could not get node software and version information: ${err.message}`));

    // Get protocol version
    await getProtocolVersion()
    .then(protocolVersion => (_ethState.parameters.protocolVersion = protocolVersion))
    .catch(err => log.warn(_blockchainName, `Could not get protocol version from node: ${err.message}`));

    // Get network ID
    await getNetworkId()
    .then(networkID => (_ethState.parameters.networkID = networkID))
    .catch(err => log.warn(_blockchainName, `Could not get Network ID from node: ${err.message}`));

    // Check chain ID
    await getChainId()
    .then(chainID => {
        if (chainID !== _chainID) {
            log.warn(_blockchainName, `The node's Chain ID has changed to ${chainID} and does not correspond with the configured Chain ID ${_chainID}`);
        }
        _ethState.parameters.chainID = chainID;
    })
    .catch(err => log.warn(_blockchainName, `Could not get Chain ID from node: ${err.message}`));
}

/**
 * Requests some dynamic Ethereum blockchain node status information
 * @private
 */
async function updateNodeStatus() {
    _ethState.status.updated = new Date().toISOString();

    // Get peer status
    await getPeerCount()
    .then(peers => (_ethState.status.peers = peers))
    .catch(err => log.warn(_blockchainName, `Could not get peer status: ${err.message}`));

    // Get synchronisation status
    await isSyncing()
    .then(syncing => (_ethState.status.syncing = syncing))
    .catch(err => log.warn(_blockchainName, `Could not get synchronisation status: ${err.message}`));

    // Get gas price
    await getGasPrice()
    .then(gasPrice => (_ethState.status.gasPrice = gasPrice))
    .catch(err => log.warn(_blockchainName, `Could not get gas price: ${err.message}`));

    // Log node status
    saveNodeStatus();
}

/**
 * Logs the Ethereum node status information
 * @private
 */
function saveNodeStatus() {
    wfState.updateBlockchainData(_blockchainName, _ethState);
    log.info(_blockchainName, `Status: {${JSON.stringify(_ethState.parameters)}, ${JSON.stringify(_ethState.status)}}`);
}
