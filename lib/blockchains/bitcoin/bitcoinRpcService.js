const request = require('request');


module.exports = {
    getBlockIncludingTransactions,
    setCredentials: setRpcServiceValues,
    getBlockCount,
    getBlockHash,
    getBlock,
    sendSignedTransaction,
    getBlockChainInfo,
    getConnectionCount,
    getRawTransaction
};

let _credentials = {};

function setRpcServiceValues(bcConfig){
  _credentials = {
        host: bcConfig.rpcHost,
        port: bcConfig.rpcPort,
        user: bcConfig.username,
        password: bcConfig.password
    };
}

/**
 * Gets the amount of blocks in the blockchain
 * @returns {Object} block count
 */
async function getBlockCount() {
    try {
        return await rpcCall('getblockcount')
    } catch (err) {
        log.error('ERROR WHILE RETRIEVING LATEST BLOCK' + err);
        return getBlockCount()
    }
}

/**
 * Gets the raw transaction data
 * @param {Object} txid
 * @returns {Object} raw transaction data
 */
async function getRawTransaction(txid) {
    try {
        return await rpcCall('getrawtransaction' , [txid, true])
    } catch (err) {
        log.error('ERROR WHILE RETRIEVING TRANSACTION' + err);
        return getRawTransaction()
    }
}

/**
 * Gets a block including transaction data
 * @param {Object} blocknumber 
 * @returns {Object} block including transactions
 */
async function getBlockIncludingTransactions(blocknumber) {
    return await getBlock(await getBlockHash(blocknumber))
}

/**
 * Gets the hash of a block
 * @param {Object} blocknumber 
 * @returns {Object} blockhash
 */
async function getBlockHash(blocknumber) {
    try {
        return rpcCall('getblockhash', [blocknumber])
    } catch (err) {
        return getBlockHash(blocknumber),
            log.error('ERROR WHILE RETRIEVING BLOCKHASH') + err;
    }
}

/**
 * Get block
 * @param {Object} blockHash 
 * @returns {Object} block inlcuding transactions
 */
async function getBlock(blockHash) {
    try {
        return rpcCall('getblock', [blockHash, 2])
    } catch (err) {
        return getBlock(blockHash),
            log.error('ERROR WHILE RETRIEVING BLOCK') + err;
    }
}

/**
 * Get blockchaininfo
 * @returns {Object} blockchaininfo
 */
async function getBlockChainInfo() {
    try {
        return rpcCall('getblockchaininfo')
    } catch (err) {
        return getBlockChainInfo(),
            log.error('ERROR WHILE RETRIEVING BLOCKCHAININFO') + err;
    }
}

/**
 * Get connectioncount
 * @returns {Object} connectioncount
 */
async function getConnectionCount() {
    try {
        return rpcCall('getconnectioncount')
    } catch (err) {
        return getConnectionCount(),
            log.error('ERROR WHILE RETRIEVING CONNECTIONCOUNT') + err;
    }
}

/**
 * Get connectioncount
 * @param {Object} raw raw transaction
 * @returns {Object} txid
 */
function sendSignedTransaction(raw) {
    return new Promise((resolve, reject) => {
        rpcCall('sendrawtransaction', raw)
            .then(function (data) {
                resolve(data);
            }, err => {
                reject(err);
            });
    }).catch(err => {
        // Let any error bubble up for processing
        throw (new Error(err));
    });
}


/**
 * Makes a connection with a node
 * @function rpcCall
 * @private
 * @param {string} method the rpc method
 * @param {string} params the parameters for the rpc method
 * @returns {object} returns the response from the node
 */
async function rpcCall(method, params) {
    // log.info('METHODE :  ' + method + '  Params: ' + params)
    let promise = new Promise(function (resolve, reject) {
        let options = {
            url: 'http://' + _credentials.host + ':' + _credentials.port,
            auth: {
                user: _credentials.user,
                password: _credentials.password
            },
            method: 'post',
            headers:
            {
                'content-type': 'text/plain'
            },

            body: JSON.stringify({
                'jsonrpc': '2.0',
                'method': method,
                'params': params
            })
        };
        request(options, (err, response, body) => {
            if (err) { reject(err) }
            else {
                try {
                    resolve(JSON.parse(body).result);
                } catch (err) {
                    reject(err)
                }
            }
        })
    })
    return promise;
}
