const request = require('request');
const { ProcessingError } = require('../../common/errors');


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
        return await rpcCall('getblockcount')
}
/**
 * Gets the raw transaction data
 * @param {Object} txid
 * @returns {Object} raw transaction data
 */
async function getRawTransaction(txid) {
        return await rpcCall('getrawtransaction' , [txid, true])
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
        return rpcCall('getblockhash', [blocknumber])
}

/**
 * Get block
 * @param {Object} blockHash 
 * @returns {Object} block inlcuding transactions
 */
async function getBlock(blockHash) {
        return rpcCall('getblock', [blockHash, 2])
}

/**
 * Get blockchaininfo
 * @returns {Object} blockchaininfo
 */
async function getBlockChainInfo() {
        return rpcCall('getblockchaininfo')
}

/**
 * Get connectioncount
 * @returns {Object} connectioncount
 */
async function getConnectionCount() {  
        return rpcCall('getconnectioncount')
}

/**
 * Get connectioncount
 * @param {Object} raw raw transaction
 * @returns {Object} txid
 */
function sendSignedTransaction(raw) {
       return rpcCall('sendrawtransaction', raw)
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
            if (err) { reject(err)}
            else {
                try {
                    if(JSON.parse(body).error != null){
                        reject( new ProcessingError(JSON.stringify(JSON.parse(body).error)))
                    }
                    resolve(JSON.parse(body).result);
                } catch (err) {
                    reject(body)
                }
            }
        })
    })
    return promise;
}
