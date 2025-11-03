'use strict';
/**
 * @module lib/_common/endpoints
 * @summary Whiteflag API common http endpoint definitions module
 * @description Module with common endpoint definitions
 * @tutorial modules
 * @tutorial openapi
 */

/* Whiteflag modules with endpoint operations */
const wfApiSingletonsHandler = require('../singletons');
const wfApiMessagesHandler = require('../messages');
const wfApiBlockchainsHandler = require('../blockchains');
const wfApiOriginatorsHandler = require('../originators');
const wfApiTokensHandler = require('../tokens');
const wfApiQueuesHandler = require('../queues');

/* Module exports */
module.exports = {
    /**
     * @constant {Array} wfApiEndpoints
     */
    wfApiEndpoints: [

        // COLLECTIONS

        // Messages
        [ '/messages', 'GET', 'getMessages', wfApiMessagesHandler.getMessages ],
        [ '/messages', 'POST', 'sendMessage', wfApiMessagesHandler.sendMessage ],
        [ '/messages/:transactionHash', 'GET', 'getMessage', wfApiMessagesHandler.getMessage ],
        [ '/messages/:transactionHash', 'PUT', 'receiveMessage', wfApiMessagesHandler.receiveMessage ],
        [ '/references', 'GET', 'getMsgReferences', wfApiMessagesHandler.getReferences ],
        [ '/sequence', 'GET', 'getMsgSequence', wfApiMessagesHandler.getSequence ],

        // Blockchains
        [ '/blockchains', 'GET', 'getAllBlockchains', wfApiBlockchainsHandler.getAllBlockchains ],
        [ '/blockchains/:blockchain', 'GET', 'getBlockchainState', wfApiBlockchainsHandler.getBlockchain ],
        [ '/blockchains/:blockchain/scan', 'GET', 'scanBlocks', wfApiBlockchainsHandler.scanBlocks ],

        // Blockchain accounts
        [ '/blockchains/:blockchain/accounts', 'GET', 'getAccounts', wfApiBlockchainsHandler.getAccounts ],
        [ '/blockchains/:blockchain/accounts', 'POST', 'createAccount', wfApiBlockchainsHandler.createAccount ],
        [ '/blockchains/:blockchain/accounts/:account', 'GET', 'getAccount', wfApiBlockchainsHandler.getAccount ],
        [ '/blockchains/:blockchain/accounts/:account', 'PATCH', 'updateAccount', wfApiBlockchainsHandler.updateAccount ],
        [ '/blockchains/:blockchain/accounts/:account', 'DELETE', 'deleteAccount', wfApiBlockchainsHandler.deleteAccount ],

        // Blockchain account signature and transfer operations
        [ '/blockchains/:blockchain/accounts/:account/sign', 'POST', 'createSignature', wfApiBlockchainsHandler.createSignature ],
        [ '/blockchains/:blockchain/accounts/:account/transfer', 'POST', 'transferFunds', wfApiBlockchainsHandler.transferFunds ],

        // Originators
        [ '/originators', 'GET', 'getAllOriginators', wfApiOriginatorsHandler.getAllOriginators ],
        [ '/originators/:address', 'GET', 'getOriginator', wfApiOriginatorsHandler.getOriginator ],
        [ '/originators/:address', 'PATCH', 'updateOriginator', wfApiOriginatorsHandler.updateOriginator ],
        [ '/originators/:address', 'DELETE', 'deleteOriginator', wfApiOriginatorsHandler.deleteOriginator ],

        // Originator pre-shared encryption keys
        [ '/originators/:address/psk/:account', 'GET', 'getPreSharedKey', wfApiOriginatorsHandler.getPreSharedKey ],
        [ '/originators/:address/psk/:account', 'PUT', 'storePreSharedKey', wfApiOriginatorsHandler.storePreSharedKey ],
        [ '/originators/:address/psk/:account', 'DELETE', 'deletePreSharedKey', wfApiOriginatorsHandler.deletePreSharedKey ],

        // Authentication tokens
        [ '/tokens', 'POST', 'storeAuthToken', wfApiTokensHandler.store ],
        [ '/tokens/:authTokenId', 'GET', 'getAuthToken', wfApiTokensHandler.get ],
        [ '/tokens/:authTokenId', 'DELETE', 'deleteAuthToken', wfApiTokensHandler.delete ],

        // Queue endpoint
        [ '/queues/:queue', 'GET', 'getQueue', wfApiQueuesHandler.getQueue ],

        // SINGLETONS

        // Message operations endpoints
        [ '/message/validate', 'POST', 'validateMessage', wfApiSingletonsHandler.validateMessage ],
        [ '/message/encode', 'POST', 'encodeMessage', wfApiSingletonsHandler.encodeMessage ],
        [ '/message/decode', 'POST', 'decodeMessage', wfApiSingletonsHandler.decodeMessage ],

        // Signature operations endpoints
        [ '/signature/decode', 'POST', 'decodeSignature', wfApiSingletonsHandler.decodeSignature ],
        [ '/signature/verify', 'POST', 'verifySignature', wfApiSingletonsHandler.verifySignature ],

        // Token operations endpoints
        [ '/token/verify', 'POST', 'verifyToken', wfApiSingletonsHandler.verifyToken ],

    ]
};
