'use strict';
/**
 * @module lib/server
 * @summary Whiteflag API server module
 * @description Module with the server and endpoint configuration and handlers
 * @tutorial installation
 * @tutorial configuration
 * @tutorial modules
 * @tutorial openapi
 */
module.exports = {
    // Server functions
    start: startServer,
    stop: stopServer,
    createEndpoints,
    sendSocket,
    monitorSocket,
    // Server functions for testing
    test: {
        getEndpoints,
        getOpenApiEndpoints
    }
};

// Node.js core and external modules //
const fs = require('fs');
const http = require('http');
const https = require('https');
const cors = require('cors');
const express = require('express');
const auth = require('express-basic-auth');
const socket = require('socket.io');

// Whiteflag common functions and classes //
const log = require('./common/logger');
const { ProcessingError } = require('./common/errors');
const response = require('./common/httpres');

// Whiteflag modules //
const wfApiConfig = require('./config');

// Whiteflag modules with endpoint operations //
const wfApiMessagesHandler = require('./operations/messages');
const wfApiBlockchainsHandler = require('./operations/blockchains');
const wfApiOriginatorsHandler = require('./operations/originators');
const wfApiSignaturesHandler = require('./operations/signatures');
const wfApiTokensHandler = require('./operations/tokens');
const wfApiQueueHandler = require('./operations/queue');

// Module constants //
const MODULELOG = 'server';
const SOCKETPATH = '/socket';
const OPENAPIFILE = '../static/openapi.json';

// Module objects //
let _wfApiConfig;
let _wfApi;
let _wfServer;
let _wfSocket;

// MAIN MODULE FUNCTIONS //
/**
 * Starts the API http server
 * @function startServer
 * @alias module:lib/server.start
 * @param {function(Error, url)} callback function called after starting the server
 * @typedef {string} url the server url
 */
function startServer(callback) {
    // Get configuration
    _wfApiConfig = wfApiConfig.getConfig();
    const protocol = _wfApiConfig.server.protocol || 'http';
    const hostname = _wfApiConfig.server.hostname || '';
    const port = process.env.WFPORT || _wfApiConfig.server.port || '5746';
    const url = `${protocol}://${hostname}:${port}`;

    // Check for valid port
    if (port < 0 || port > 65536) {
        return callback(new Error(`Invalid port number: ${port}`));
    }
    // Create server
    _wfApi = express();
    switch (protocol) {
        case 'http': {
            log.trace(MODULELOG, `Starting server on ${url}`);
            try {
                _wfServer = http.createServer(_wfApi);
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
                _wfServer = https.createServer({
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
        // Socket configuration
        let socketConfig = {
            path: SOCKETPATH
        };
        if (_wfApiConfig.http.enableCors) {
            socketConfig.cors = {
                origin: hostname,
                methods: ['GET', 'POST']
            };
        }
        // Open socket
        try {
            _wfSocket = socket(_wfServer, socketConfig);
        } catch(err) {
            return callback(err, url + SOCKETPATH);
        }
        log.info(MODULELOG, `Initialised socket for clients to listen for incoming messages on ${url + SOCKETPATH}`);
    }

    // Static content
    _wfApi.use('/', express.static('./static'));
    _wfApi.use('/docs', express.static('./docs/jsdoc'));

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
    _wfApi.use(express.json());
    _wfApi.use(errorHandler);

    // Start listener on the port
    _wfServer.listen(port, hostname, err => {
        if (err) return callback(err, url);
        _wfServer.url = url;
        return callback(err, _wfServer.url);
    });
}

/**
 * Stops the API http server
 * @function stopServer
 * @alias module:lib/server.stop
 * @param {function(Error)} callback function called after stopping the server
 */
function stopServer(callback) {
    // Try to shutdown socket
    if (_wfSocket) {
        log.trace(MODULELOG, 'Removing all listeners on socket');
        _wfSocket.removeAllListeners();
    }
    // Shutdown server
    if (_wfServer) {
        let timer = setTimeout(timeoutCb, 2000);
        log.trace(MODULELOG, `Closing server on ${_wfServer.url}`);
        _wfServer.close(err => {
            clearTimeout(timer);
            return callback(err);
        });
    } else {
        return callback();
    }

    /**
     * Returns callback with timeout error
     * @callback timeout
     */
    function timeoutCb() {
        return callback(new Error('Timeout while closing server'));
    }
}

/**
 * Creates routes to the API endpoints
 * @function createEndpoints
 * @alias module:lib/server.createEndpoints
 * @param {logEndpointEventCb} endpointCb function passed to the endpoint handler to be invoked when done
 * @param {function(Error)} callback function to be called upon completion
 */
function createEndpoints(endpointCb, callback) {
    // Endpoints array index
    const PATH = 0;
    const METHOD = 1;
    const OPERATIONID = 2;
    const HANDLER = 3;

    // Get array with endpoints
    const endpoints = getEndpoints();

    // Check if server is ready
    if (!_wfApi) {
        return callback(new Error('Could not bind endpoint routes to handlers: Server not started'));
    }
    try {
        // Message controller endpoints
        endpoints.forEach(function endpointsCb(endpoint) {
            if (!Object.prototype.hasOwnProperty.call(_wfApiConfig.endpoints, endpoint[OPERATIONID])
                || _wfApiConfig.endpoints[endpoint[OPERATIONID]]) {
                log.trace(MODULELOG, `Creating endpoint: ${endpoint[OPERATIONID]}: ${endpoint[METHOD]} ${endpoint[PATH]}`);
                createEndpoint(endpoint[PATH], endpoint[METHOD], endpoint[OPERATIONID], endpoint[HANDLER], endpointCb);
            } else {
                log.trace(MODULELOG, `Disabled endpoint: ${endpoint[OPERATIONID]}: ${endpoint[METHOD]} ${endpoint[PATH]}`);
                createEndpoint(endpoint[PATH], endpoint[METHOD], endpoint[OPERATIONID], forbiddenHandler, endpointCb);
            }
        });
        // Catch-all endpoint; MUST be last one to call
        log.trace(MODULELOG, 'Creating endpoint for all undefined routes and methods');
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
        return log.trace(MODULELOG, 'Could not send data: Socket not initialised');
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
        return callback(new Error('Could not start monitor: Socket not initialised'));
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
            throw new Error(`Internal Coding Error: Wrong HTTP method provided for endpoint ${route}: ${method}`);
        }
    }
}

/**
 * Handles requests w/ undefined endpoints or methods
 * @private
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback function to be called upon completion
 */
function undefinedHandler(req, res, operationId, callback) {
    let resBody = response.createBody(req, operationId);
    let err = new ProcessingError('Undefined endpoint or illegal method', null, 'WF_API_NO_RESOURCE');
    return response.sendImperative(res, err, resBody, null, callback);
}

/**
 * Handles requests w/ disabled endpoints
 * @private
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {string} operationId the operation id as defined in the openapi definition
 * @param {logEndpointEventCb} callback
 */
function forbiddenHandler(req, res, operationId, callback) {
    let resBody = response.createBody(req, operationId);
    let err = new ProcessingError(`Configuration does not allow operation: ${operationId}`, null, 'WF_API_NOT_ALLOWED');
    return response.sendImperative(res, err, resBody, null, callback);
}

/**
 * Handles middleware errors
 * @private
 * @param {Error} err the error
 * @param {Object} req the http request
 * @param {Object} res the http response
 * @param {function} next middleware function to be called next
 */
function errorHandler(err, req, res, next) {
    const statusCode = err.status || 500;
    let resBody = response.createBody(req, null);

    // Compose error message
    let errorMessage = err.message || 'Unspecified error';
    errorMessage = `WF_API_MIDDLEWARE_ERROR: ${err.type}: ` + errorMessage;

    // Send error response
    resBody.errors = [ errorMessage ];
    res.status(statusCode).send(resBody);
    ignore(next);

    // Log the error
    log.debug(MODULELOG, `Could not process request: ${JSON.stringify(resBody)}`);
}

/**
 * Creates repsonse body for unauthorised access
 * @private
 * @param {Object} req the http request
 * @returns {Object} the response body
 */
function unauthorizedResponse(req) {
    let resBody = response.createBody(req, null);
    resBody.errors = [ 'Unauthorized to access this endpoint or resource' ];
    log.warn(MODULELOG, `Unauthorised request: ${JSON.stringify(resBody.meta.request)}`);
    return resBody;
}

/**
 * Returns endpoints to be created
 * @private
 * @returns {array} endpoints
 */
function getEndpoints() {
    return [
        // Message resource endpoints
        [ '/messages', 'GET', 'getMessages', wfApiMessagesHandler.getMessages ],
        [ '/messages/references', 'GET', 'getMessageReferences', wfApiMessagesHandler.getReferences ],
        [ '/messages/sequence', 'GET', 'getMessageSequence', wfApiMessagesHandler.getSequence ],
        [ '/messages/send', 'POST', 'sendMessage', wfApiMessagesHandler.send ],
        [ '/messages/receive', 'POST', 'receiveMessage', wfApiMessagesHandler.receive ],

        // Message validation endpoints
        [ '/messages/validate', 'POST', 'validateMessage', wfApiMessagesHandler.validate ],
        [ '/messages/encode', 'POST', 'encodeMessage', wfApiMessagesHandler.encode ],
        [ '/messages/decode', 'POST', 'decodeMessage', wfApiMessagesHandler.decode ],

        // Blockchain endpoints
        [ '/blockchains', 'GET', 'getAllBlockchains', wfApiBlockchainsHandler.getBlockchains ],
        [ '/blockchains/:blockchain', 'GET', 'getBlockchainState', wfApiBlockchainsHandler.getBlockchain ],

        // Blockchain accounts endpoints
        [ '/blockchains/:blockchain/accounts', 'GET', 'getAccounts', wfApiBlockchainsHandler.getAccounts ],
        [ '/blockchains/:blockchain/accounts/:account', 'GET', 'getAccount', wfApiBlockchainsHandler.getAccount ],
        [ '/blockchains/:blockchain/accounts', 'POST', 'createAccount', wfApiBlockchainsHandler.createAccount ],
        [ '/blockchains/:blockchain/accounts/:account', 'PATCH', 'updateAccount', wfApiBlockchainsHandler.updateAccount ],
        [ '/blockchains/:blockchain/accounts/:account', 'DELETE', 'deleteAccount', wfApiBlockchainsHandler.deleteAccount ],

        // Blockchain account signature and transfer value endpoints
        [ '/blockchains/:blockchain/accounts/:account/sign', 'POST', 'createSignature', wfApiBlockchainsHandler.createSignature ],
        [ '/blockchains/:blockchain/accounts/:account/transfer', 'POST', 'transferValue', wfApiBlockchainsHandler.transferValue ],
        [ '/originators', 'GET', 'getAllOriginators', wfApiOriginatorsHandler.getOriginators ],
        [ '/originators/:address', 'GET', 'getOriginator', wfApiOriginatorsHandler.getOriginator ],
        [ '/originators/:address', 'PATCH', 'updateOriginator', wfApiOriginatorsHandler.updateOriginator ],
        [ '/originators/:address', 'DELETE', 'deleteOriginator', wfApiOriginatorsHandler.deleteOriginator ],

        // Originator pre-shared keys
        [ '/originators/:address/psk/:account', 'GET', 'getPreSharedKey', wfApiOriginatorsHandler.getPreSharedKey ],
        [ '/originators/:address/psk/:account', 'PUT', 'storePreSharedKey', wfApiOriginatorsHandler.storePreSharedKey ],
        [ '/originators/:address/psk/:account', 'DELETE', 'deletePreSharedKey', wfApiOriginatorsHandler.deletePreSharedKey ],

        // Originator authentication tokens
        [ '/originators/tokens/:authTokenId', 'GET', 'getAuthToken', wfApiOriginatorsHandler.getAuthToken ],
        [ '/originators/tokens', 'POST', 'storeAuthToken', wfApiOriginatorsHandler.storeAuthToken ],
        [ '/originators/tokens/:authTokenId', 'DELETE', 'deleteAuthToken', wfApiOriginatorsHandler.deleteAuthToken ],
        [ '/signature/decode', 'POST', 'decodeSignature', wfApiSignaturesHandler.decode ],
        [ '/signature/verify', 'POST', 'verifySignature', wfApiSignaturesHandler.verify ],
        [ '/token/create', 'POST', 'createToken', wfApiTokensHandler.create ],
        [ '/queues/:queue', 'GET', 'getQueue', wfApiQueueHandler.getQueue ]
    ];
}

/**
 * Gets openapi endpoint definitions
 * @private
 * @returns {array} endpoints
 */
function getOpenApiEndpoints() {
    const openapi = JSON.parse(fs.readFileSync(OPENAPIFILE)).paths;
    let endpoints = [];
    Object.keys(openapi).forEach(path => {
        let endpoint = path.replace(/{/g, ':').replace(/}/g, '');
        Object.keys(openapi[path]).forEach(method => {
            let operationId = openapi[path][method].operationId;
            endpoints.push([ endpoint, method.toUpperCase(), operationId ]);
        });
    });
    return endpoints;
}
