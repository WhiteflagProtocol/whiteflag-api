'use strict';
/**
 * @module lib/server
 * @summary Whiteflag API server module
 * @description Module with the server and endpoint configuration and handlers
 */
module.exports = {
    // Server functions
    start: startServer,
    createEndpoints,
    sendSocket,
    monitorSocket
};

// Node.js core and external modules //
const fs = require('fs');
const http = require('http');
const https = require('https');
const cors = require('cors');
const express = require('express');
const auth = require('express-basic-auth');
const parser = require('body-parser');
const Socket = require('socket.io');

// Whiteflag common functions and classes //
const log = require('./common/logger');
const response = require('./endpoints/common/response');

// Whiteflag modules //
const wfApiConfig = require('./config');

// Whiteflag modules with endpoint handlers //
const wfApiMessagesHandler = require('./endpoints/messages');
const wfApiBlockchainsHandler = require('./endpoints/blockchains');
const wfApiOriginatorsHandler = require('./endpoints/originators');
const wfApiSignaturesHandler = require('./endpoints/signatures');
const wfApiQueueHandler = require('./endpoints/queue');

// Module constants //
const MODULELOG = 'server';
const SOCKETPATH = '/socket';

// Module objects //
let _wfApiConfig;
let _wfApi;
let _wfSocket;

// MAIN MODULE FUNCTIONS //
/**
 * Starts the API http server
 * @function startServer
 * @alias module:lib/server.start
 * @param {function} callback function called after starting the server
 * @returns
 */
function startServer(callback) {
    // Get configuration
    _wfApiConfig = wfApiConfig.getConfig();
    const protocol = _wfApiConfig.server.protocol || 'http';
    const hostname = _wfApiConfig.server.hostname || '';
    const port = process.env.PORT || _wfApiConfig.server.port || '5746';
    const url = `${protocol}://${hostname}:${port}`;

    // Create server
    _wfApi = express();
    let server;
    switch (protocol) {
        case 'http': {
            log.trace(MODULELOG, `Starting server on ${url}`);
            try {
                server = http.createServer(_wfApi);
            } catch(err) {
                return callback(err, url);
            }
            break;
        }
        case 'https': {
            log.trace(MODULELOG, `Starting server with SSL on ${url}`);
            if (!_wfApiConfig.ssl.keyFile) return callback(new Error('No private key file configured for SSL'));
            if (!_wfApiConfig.ssl.certificateFile) return callback(new Error('No certificate file configured for SSL'));
            try {
                let key = fs.readFileSync(_wfApiConfig.ssl.keyFile);
                let cert = fs.readFileSync(_wfApiConfig.ssl.certificateFile);
                server = https.createServer({
                    key: key,
                    cert: cert
                }, _wfApi);
            } catch(err) {
                return callback(err, url);
            }
            break;
        }
        default: {
            return callback(new Error(`Unsupported protocol: ${protocol}`));
        }
    }

    // Create socket
    if (_wfApiConfig.socket.enable) {
        try {
            _wfSocket = new Socket(
                server,
                { path: SOCKETPATH }
            );
        } catch(err) {
            return callback(err, url + SOCKETPATH);
        }
        log.info(MODULELOG, `Opened incoming messages socket on ${url + SOCKETPATH}`);
    }

    // Static content
    _wfApi.use('/', express.static('./static'));
    _wfApi.use('/doc', express.static('./doc'));
    _wfApi.use('/protocol', express.static('./lib/protocol/static'));

    // Http settings
    if (_wfApiConfig.http.trustProxy) {
        _wfApi.enable('trust proxy');
        log.info(MODULELOG, 'Configured to run behind a trusted reverse proxy');
    }
    _wfApi.disable('x-powered-by');

    // Basic http authorization
    let authConfig = {};
    if (_wfApiConfig.authorization.username && _wfApiConfig.authorization.password) {
        log.info(MODULELOG, 'Enabling basic http authorization');
        try {
            authConfig[_wfApiConfig.authorization.username] = _wfApiConfig.authorization.password;
            _wfApi.use(auth({
                users: authConfig,
                unauthorizedResponse: unauthorizedResponse
            }));
        } catch(err) {
            return callback(err, url);
        }
    } else {
        log.warn(MODULELOG, 'No authentication enabled because no basic http authorization configured');
    }

    // Middleware
    if (_wfApiConfig.http.enableCors) {
        _wfApi.use(cors());
        log.info(MODULELOG, 'Enabled HTTP Cross-Origin Resource Sharing (CORS)');
    }
    _wfApi.use(parser.json());
    _wfApi.use(errorHandler);

    // Start listener on the port
    server.listen(port, hostname, err => {
        return callback(err, url);
    });
}

/**
 * Creates routes to the API endpoints
 * @function createEndpoints
 * @alias module:lib/server.createEndpoints
 * @param {logEndpointEventCb} endpointCb function passed to the endpoint handler to be invoked when done
 * @param {function} callback function to be called upon completion
 */
function createEndpoints(endpointCb, callback) {
    // Check if server is ready
    if (!_wfApi) {
        return callback(new Error('Cannot bind endpoint routes to handlers: Server not started'));
    }
    try {
        // Message controller endpoints
        initMessagesEndpoints(endpointCb);
        initBlockchainsEndpoints(endpointCb);
        initOriginatorsEndpints(endpointCb);
        initSignaturesEndpoints(endpointCb);
        initStateEndpoints(endpointCb);

        // Catch-all endpoint; MUST be last one to call
        createEndpoint('*', '_all', 'undefined', undefinedHandler, endpointCb);
    } catch(err) {
        return callback(err);
    }
    return callback(null);
}

/**
 * Sends out data on socket
 * @function sendSocket
 * @alias module:lib/server.sendSocket
 * @param {string} data
 */
function sendSocket(data) {
    if (!_wfSocket) {
        return log.warn(MODULELOG, 'Cannot send data: Socket not initialised');
    }
    _wfSocket.sockets.emit('message', data);
}

/**
 * Monitors socket client connections
 * @function monitorSocket
 * @alias module:lib/server.monitorSocket
 * @param {logEndpointEventCb} callback
 */
function monitorSocket(callback) {
    // Check if socket is ready
    if (!_wfSocket) {
        return callback(new Error('Cannot start monitor: Socket not initialised'));
    }
    // Pass event and socket to callback function when client connects
    _wfSocket.on('connection', socket => {
        // Get client ip address
        let clientIp;
        if (_wfApiConfig.http.trustProxy) {
            clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
        } else {
            clientIp = socket.handshake.address;
        }

        // Handle socket errors here, no need to further pass to callback
        socket.on('error', err => {
            return callback(null, clientIp, 'error', err.message);
        });
        // Pass socket disconnect details to callback when client disconnects
        socket.on('disconnect', reason => {
            return callback(null, clientIp, 'disconnected', reason);
        });
        // Pass socket connection details to callback
        return callback(null, clientIp, 'connected', 'waiting for data');
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}

/**
 * Creates an endpoint
 * @private
 * @param {string} route the path in the URL of the endpoint
 * @param {string} method the HTTP method of the endpoint (GET, POST, etc.)
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {function} handler the function to handle a client request
 * @param {logEndpointEventCb} endpointCb callback function passed to handler
 */
function createEndpoint(route, method, operationId, handler, endpointCb) {
    switch (method) {
        case 'GET': {
            _wfApi.get(route, function serverEndpointGetCb(req, res) {
                return handler(req, res, operationId, endpointCb);
            });
            break;
        }
        case 'POST': {
            _wfApi.post(route, function serverEndpointPostCb(req, res) {
                return handler(req, res, operationId, endpointCb);
            });
            break;
        }
        case 'PUT': {
            _wfApi.put(route, function serverEndpointPutCb(req, res) {
                return handler(req, res, operationId, endpointCb);
            });
            break;
        }
        case 'PATCH': {
            _wfApi.patch(route, function serverEndpointPutCb(req, res) {
                return handler(req, res, operationId, endpointCb);
            });
            break;
        }
        case 'DELETE': {
            _wfApi.delete(route, function serverEndpointDeleteCb(req, res) {
                return handler(req, res, operationId, endpointCb);
            });
            break;
        }
        case '_all': {
            _wfApi.all(route, function serverEndpointAllCb(req, res) {
                return handler(req, res, operationId, endpointCb);
            });
            break;
        }
        default: {
            throw new Error(`Internal Coding Error: wrong HTTP method provided for endpoint ${route}: ${method}`);
        }
    }
}

/**
 * Handles requests w/ undefined endpoints or methods
 * @private
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback function to be called upon completion
 */
function undefinedHandler(req, res, operationId, callback) {
    let resBody = response.createBody(req, operationId);
    resBody.errors = [ 'Undefined endpoint or illegal method' ];
    res.status(404).send(resBody);
    return callback(null, resBody.meta.request.client, 'ERROR', 'Cannot process request: ' + JSON.stringify(resBody));
}

/**
 * Creates repsonse body for unauthorised access
 * @private
 * @param {object} req the http request
 * @returns {object} the response body
 */
function unauthorizedResponse(req) {
    let resBody = response.createBody(req, null);
    resBody.errors = [ 'Unauthorized to access this endpoint or resource' ];
    log.warn(MODULELOG, `Unauthorised request: ${JSON.stringify(resBody.meta.request)}`);
    return resBody;
}

/**
 * Handles middleware errors
 * @private
 * @param {object} err the error
 * @param {object} req the http request
 * @param {object} res the http response
 * @param {function} next middleware function to be called next
 */
function errorHandler(err, req, res, next) {
    const statusCode = err.status || 500;
    let resBody = response.createBody(req, null);

    // Compose error message
    let errorMessage = err.message || 'Unspecified error';
    if (err.type) errorMessage = `${err.type}: ` + errorMessage;

    // Send error response
    resBody.errors = [ errorMessage ];
    res.status(statusCode).send(resBody);
    ignore(next);

    // Log the error
    log.debug(MODULELOG, `Could not process request: : ${JSON.stringify(resBody)}`);
}

// ENDPOINTS FUNCTIONS //
/**
 * Enables messages endpoints
 * @private
 * @param {logEndpointEventCb} endpointCb function passed to the endpoint handler to be invoked when done
 */
function initMessagesEndpoints(endpointCb) {
    // Message resource endpoints
    createEndpoint('/messages', 'GET', 'getMessages', wfApiMessagesHandler.getMessages, endpointCb);
    createEndpoint('/messages/references', 'GET', 'getMessageReferences', wfApiMessagesHandler.getReferences, endpointCb);
    createEndpoint('/messages/sequence', 'GET', 'getMessageSequence', wfApiMessagesHandler.getSequence, endpointCb);

    // Message send endpoint
    if (_wfApiConfig.endpoints.sendMessage) {
        createEndpoint('/messages/send', 'POST', 'sendMessage', wfApiMessagesHandler.send, endpointCb);
    }
    // Message receive endpoint
    if (_wfApiConfig.endpoints.receiveMessage) {
        createEndpoint('/messages/receive', 'POST', 'receiveMessage', wfApiMessagesHandler.receive, endpointCb);
    }
    // Message validation endpoints
    createEndpoint('/messages/validate', 'POST', 'validateMessage', wfApiMessagesHandler.validate, endpointCb);
    createEndpoint('/messages/encode', 'POST', 'encodeMessage', wfApiMessagesHandler.encode, endpointCb);
    createEndpoint('/messages/decode', 'POST', 'decodeMessage', wfApiMessagesHandler.decode, endpointCb);
}

/**
 * Enables blockchains endpoints
 * @private
 * @param {logEndpointEventCb} endpointCb function passed to the endpoint handler to be invoked when done
 */
function initBlockchainsEndpoints(endpointCb) {
    // Blockchain endpoints
    createEndpoint('/blockchains', 'GET', 'getAllBlockchains', wfApiBlockchainsHandler.getBlockchains, endpointCb);
    createEndpoint('/blockchains/:blockchain', 'GET', 'getBlockchainState', wfApiBlockchainsHandler.getBlockchain, endpointCb);

    // Blockchain accounts endpoints
    createEndpoint('/blockchains/:blockchain/accounts', 'GET', 'getAccounts', wfApiBlockchainsHandler.getAccounts, endpointCb);
    createEndpoint('/blockchains/:blockchain/accounts/:account', 'GET', 'getAccount', wfApiBlockchainsHandler.getAccount, endpointCb);
    if (_wfApiConfig.endpoints.createAccount) {
        createEndpoint('/blockchains/:blockchain/accounts', 'POST', 'createAccount', wfApiBlockchainsHandler.createAccount, endpointCb);
    }
    if (_wfApiConfig.endpoints.updateAccount) {
        createEndpoint('/blockchains/:blockchain/accounts/:account', 'PATCH', 'updateAccount', wfApiBlockchainsHandler.updateAccount, endpointCb);
    }
    if (_wfApiConfig.endpoints.deleteAccount) {
        createEndpoint('/blockchains/:blockchain/accounts/:account', 'DELETE', 'deleteAccount', wfApiBlockchainsHandler.deleteAccount, endpointCb);
    }
    // Blockchain account signature and transfer value endpoints
    if (_wfApiConfig.endpoints.createSignature) {
        createEndpoint('/blockchains/:blockchain/accounts/:account/sign', 'POST', 'createSignature', wfApiBlockchainsHandler.createSignature, endpointCb);
    }
    if (_wfApiConfig.endpoints.transferValue) {
        createEndpoint('/blockchains/:blockchain/accounts/:account/transfer', 'POST', 'transferValue', wfApiBlockchainsHandler.transferValue, endpointCb);
    }
}

/**
 * Enables originators endpoints
 * @private
 * @param {logEndpointEventCb} endpointCb function passed to the endpoint handler to be invoked when done
 */
function initOriginatorsEndpints(endpointCb) {
    // Originators endpoints
    createEndpoint('/originators', 'GET', 'getAllOriginators', wfApiOriginatorsHandler.getOriginators, endpointCb);
    createEndpoint('/originators/:address', 'GET', 'getOriginator', wfApiOriginatorsHandler.getOriginator, endpointCb);
    createEndpoint('/originators/:address/psk/:account', 'GET', 'getPreSharedKey', wfApiOriginatorsHandler.getPreSharedKey, endpointCb);
    if (_wfApiConfig.endpoints.storePreSharedKey) {
        createEndpoint('/originators/:address/psk/:account', 'PUT', 'storePreSharedKey', wfApiOriginatorsHandler.storePreSharedKey, endpointCb);
    }
    if (_wfApiConfig.endpoints.deletePreSharedKey) {
        createEndpoint('/originators/:address/psk/:account', 'DELETE', 'deletePreSharedKey', wfApiOriginatorsHandler.deletePreSharedKey, endpointCb);
    }
}

/**
 * Enables signatures endpoints
 * @private
 * @param {logEndpointEventCb} endpointCb function passed to the endpoint handler to be invoked when done
 */
function initSignaturesEndpoints(endpointCb) {
    // Signatures endpoints
    createEndpoint('/signature/decode', 'POST', 'decodeSignature', wfApiSignaturesHandler.decode, endpointCb);
    createEndpoint('/signature/verify', 'POST', 'verifySignature', wfApiSignaturesHandler.verify, endpointCb);
}

/**
 * Enables state endpoints
 * @private
 * @param {logEndpointEventCb} endpointCb function passed to the endpoint handler to be invoked when done
 */
function initStateEndpoints(endpointCb) {
    // Queue endpoint
    createEndpoint('/queues/:queue', 'GET', 'getQueue', wfApiQueueHandler.getQueue, endpointCb);
}
