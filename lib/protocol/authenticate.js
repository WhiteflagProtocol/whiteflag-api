'use strict';
/**
 * @module  lib/protocol/authenticate
 * @summary Whiteflag authentication module
 * @description Module for Whiteflag authentication
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    message: verifyMessage,
    verify: verifyAuthentication,
    remove: removeAuthentication,
    sign: createSignature,
    decodeSignature,
    verifySignature,
    generateToken
};

// Type definitions //
/**
 * A Whiteflag authentication signature object
 * @typedef {Object} wfSignature
 * @property {string} protected Encoded signature header to identify which algorithm is used to generate the signature
 * @property {string} payload Encoded payload with the information as defined in the Whiteflag protocol specification
 * @property {string} signature The digital signature validating the information contained in the payload
 */
/**
 * A Whiteflag decoded authentication signature object
 * @typedef {Object} wfSignDecoded
 * @property {Object} header Signature header to identify which algorithm is used to generate the signature
 * @property {wfSignPayload} payload Payload object of a Whiteflag authentication signature
 * @property {string} signature The digital signature validating the information contained in the payload
 */
/**
 * A Whiteflag authentication signature payload object
 * @typedef {Object} wfSignPayload
 * @property {string} addr The blockchain address used to send the corresponding `A1` message and of which the corresponding private key is used to create the signature
 * @property {string} orgname The name of the originator, which can be chosen freely
 * @property {string} url The same URL as in the `VerificationData` field of the corresponding `A1` message
 * @property {string} extpubkey The serialised extended parent public key from which the child public keys and addresses used by this originator can be derived (currently not supported)
 */
/**
 * A Whiteflag extended authentication signature object
 * @typedef {Object} wfExtSignature
 * @property {string} blockchain the name of the blockchain
 * @property {string} pubkey the blockchain account public key of the originator
 * @property {wfSignature} jws a Whiteflag authentication JWS object
 */

// Node.js core and external modules //
const http = require('http');
const https = require('https');

// Common internal functions and classes //
const log = require('../_common/logger');
const arr = require('../_common/arrays');
const jws = require('../_common/jws');
const { type } = require('../_common/messages');
const { ProcessingError,
        ProtocolError } = require('../_common/errors');

// Whiteflag modules //
const wfBlockchains = require('../blockchains');
const wfCrypto = require('./crypto');
const wfState = require('./state');
const { hexToBuffer } = require('../_common/encoding');

// Whiteflag configuration data //
const wfConfigData = require('./config').getConfig();

// Module constants //
const MODULELOG = 'authenticate';
const AUTHMESSAGECODE = 'A';

// MAIN MODULE FUNCTIONS //
/**
 * Checks if message can be authenticated and updates metaheader accordingly
 * @function verifyMessage
 * @alias module:lib/protocol/authenticate.message
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {wfMessageCb} callback function called on completion
 */
function verifyMessage(wfMessage, callback) {
    // Lookup originator in state
    wfState.getOriginatorData(wfMessage.MetaHeader.originatorAddress, function verifyOrigGetDataCb(err, originator) {
        if (err) return callback(err, wfMessage);
        // Originator found in state
        if (originator && wfMessage.MetaHeader.originatorAddress.toLowerCase() === originator.address.toLowerCase()) {
            if (originator.authenticationValid) {
                wfMessage.MetaHeader.originatorValid = true;
                return callback(null, wfMessage);
            }
        }
        // Originator not found in state or no valid authentication data
        if (wfConfigData.authentication.strict) {
            wfMessage.MetaHeader.originatorValid = false;
        }
        return callback(null, wfMessage);
    });
}

/**
 * Checks the authentication information of the message originator and updates metaheader accordingly
 * @function verifyAuthentication
 * @alias module:lib/protocol/authenticate.verify
 * @param {wfMessage} wfAuthMessage a Whiteflag authentication message
 * @param {wfMessageCb} callback function called on completion
 */
function verifyAuthentication(wfAuthMessage = {}, callback) {
    if (wfAuthMessage?.MessageHeader?.MessageCode !== AUTHMESSAGECODE) {
        return callback(new ProcessingError(`Not an authentication message: ${type(wfAuthMessage)} message`), wfAuthMessage);
    }
    // Check indicator for authentication type
    switch (wfAuthMessage.MessageBody.VerificationMethod) {
        case '1': {
            // Digital Signature
            return wfAuthentication1(wfAuthMessage, callback);
        }
        case '2': {
            // Shared Token
            return wfAuthentication2(wfAuthMessage, callback);
        }
        default: {
            // Method does not exist
            return callback(new ProtocolError(`Invalid authentication method: ${type(wfAuthMessage)}`));
        }
    }
}

/**
 * Removes the authentication information of the message originator
 * @function removeAuthentication
 * @alias lib/protocol/authenticate.remove
 * @param {wfMessage} wfAuthMessage a Whiteflag authentication message
 * @param {wfMessageCb} callback function called on completion
 */
function removeAuthentication(wfAuthMessage = {}, callback) {
    // Check messageheader
    if (wfAuthMessage?.MessageHeader?.MessageCode !== AUTHMESSAGECODE) {
        return callback(new ProcessingError(`Cannot remove authentication: Not an authentication message: ${type(wfAuthMessage)}`), wfAuthMessage);
    }
    if (
        wfAuthMessage.MessageHeader?.ReferenceIndicator !== '1'
        && wfAuthMessage.MessageHeader?.ReferenceIndicator !== '4'
    ) {
        return callback(new ProcessingError(`Cannot remove authentication: ${type(wfAuthMessage)} message does not have reference code 1 or 4`), wfAuthMessage);
    }
    // Check for referenced message in originators state
    wfState.getOriginatorData(wfAuthMessage.MetaHeader.originatorAddress, function authGetOriginatorCb(err, originator) {
        if (err) log.error(MODULELOG, `Error getting originator state: ${err.message}`);

        // Check originator
        if (!originator) {
            // Authentication message from previously unknown originator
            log.debug(MODULELOG, `Cannot remove authentication: ${type(wfAuthMessage)} message is from unknown originator: ${wfAuthMessage.MetaHeader.originatorAddress}`);
            wfAuthMessage.MetaHeader.validationErrors = arr.addArray(wfAuthMessage.MetaHeader.validationErrors, 'Unknown originator');
            return callback(null, wfAuthMessage);
        }
        // Check if any known authentication messages
        if (!originator.authenticationMessages) {
            log.debug(MODULELOG, `Cannot process ${type(wfAuthMessage)} message: No authentication messages known for originator: ${originator.address}`);
            return callback(null, wfAuthMessage);
        }
        // Authentication message from known originator
        wfAuthMessage.MetaHeader.originatorValid = true;
        const authIndex = originator.authenticationMessages.findIndex(hash => hash === wfAuthMessage.MessageHeader.ReferencedMessage);
        if (authIndex >= 0) {
            log.debug(MODULELOG, `Removing authentication message from originators state: ${originator.authenticationMessages[authIndex]}`);
            originator.authenticationMessages.splice(authIndex, 1);
            originator.updated = new Date().toISOString();
            wfState.upsertOriginatorData(originator);
        }
        // Check if any authentication message transaction hashes left
        if (originator.authenticationMessages.length === 0) {
            log.debug(MODULELOG, `No valid authentication messages anymore for originator: ${originator.address}`);
            originator.authenticationValid = false;
            originator.updated = new Date().toISOString();
            wfState.upsertOriginatorData(originator);
        }
        return callback(null, wfAuthMessage);
    });
}

/**
 * Requests verification data of an authentication token for the specified blockchain address
 * @function generateToken
 * @alias module:lib/protocol/authenticate.generateToken
 * @param {string} authToken the secret authentication token in hexadecimal
 * @param {string} address the address of the account for which the signature is requested
 * @param {string} blockchain the name of the blockchain
 * @param {genericCb} callback function called on completion
 */
function generateToken(authToken, address, blockchain, callback) {
    let tokenBuffer = hexToBuffer(authToken);
    authToken = undefined;

    // Get blockchain address is binary
    wfBlockchains.getBinaryAddress(address, blockchain, function authGetAddressCb(err, addressBuffer) {
        if (err) return callback(err, null);

        // Generate authentication token and compare with message
        wfCrypto.getTokenVerificationData(tokenBuffer, addressBuffer, function authGenerateTokenCb(err, dataBuffer) {
            if (err) return callback(err, null);
            return callback(null, dataBuffer.toString('hex').toLowerCase());
        });
    });
}

/**
 * Creates a authentication signature for the appropriate blockchain
 * @function createSignature
 * @alias module:lib/protocol/authenticate.sign
 * @param {wfSignPayload} signPayload the signature payload object to be signed
 * @param {string} address the address of the account for which the signature is requested
 * @param {string} blockchain the blockchain for which the signature is requested
 * @param {requestSignatureCb} callback function called on completion
 */
function createSignature(signPayload, address, blockchain, callback) {
    // Check blockchain and address
    if (!blockchain || !address) {
        return callback(new ProcessingError('Missing blockchain or address', null, 'WF_API_BAD_REQUEST'));
    }
    // Check request for complete signature payload
    let signErrors = [];
    if (!signPayload?.addr) signPayload.addr = address;
    if (signPayload.addr !== address) signErrors.push('Signature address does not match blockchain account');
    arr.addArray(signErrors, checkSignPayload(signPayload));
    if (signErrors.length > 0) {
        return callback(new ProtocolError('Invalid Whiteflag authentication signature request', signErrors, 'WF_SIGN_ERROR'), null);
    }
    /**
     * @callback authRequestSignatureCb
     * @param {Error} err any error
     * @param {wfSignature} wfSignature the Whiteflag JWS to be signs
     */
    wfBlockchains.requestSignature(signPayload, blockchain, function authRequestSignatureCb(err, wfSignature) {
        if (err) return callback(err);
        decodeSignature(wfSignature, function authDecodeSignatureCb(err, wfSignDecoded) {
            if (err) return callbacl(err);

            return callback(null, wfSignature, wfSignDecoded);
        });
    });
}

/**
 * Decodes authentication signature
 * @function decodeSignature
 * @alias module:lib/protocol/authenticate.decodeSignature
 * @param {wfSignature} signature a Whiteflag authentication signature
 * @param {genericCb} callback function called on completion
 */
function decodeSignature(wfSignature, callback) {
    try {
        const wfSignDecoded = jws.decode(wfSignature);
        return callback(null, wfSignDecoded);
    } catch(err) {
        if (err.causes?.length > 0) return callback(new ProcessingError('Cannot decode Whiteflag authentication signature', err.causes));
        return callback(new ProcessingError('Cannot decode Whiteflag authentication signature', err.message));
    }
}

/**
 * Verifies authentication signature
 * @function verifySignature
 * @alias module:lib/protocol/authenticate.verifySignature
 * @param {wfExtSignature} wfExtSignature an extended Whiteflag authentication signature
 * @param {endpointSignatureVerifyCb} callback function called on completion
 */
function verifySignature(wfExtSignature, callback) {
    // Check properties of the extended signature object
    let signErrors = [];
    if (!wfExtSignature?.blockchain) signErrors.push('Missing blockchain property: blockchain');
    if (!wfExtSignature?.pubkey) signErrors.push('Missing originator public key property: pubkey');
    if (!wfExtSignature?.jws) signErrors.push('Missing Whiteflag authentication signature property: jws');
    if (signErrors.length > 0) {
        return callback(new ProcessingError('Invalid extended Whiteflag authentication signature data', signErrors, 'WF_API_BAD_REQUEST'));
    }
    // Decode signature and check properties of the payload
    const wfSignature = wfExtSignature.jws;
    decodeSignature(wfSignature, function(err, wfSignDecoded){
        if (err) return callback (err);
        signErrors = checkSignPayload(wfSignDecoded.payload);
        if (signErrors.length > 0) {
            return callback(new ProtocolError('Invalid Whiteflag authentication signature', signErrors, 'WF_SIGN_ERROR'), null);
        }
        const blockchain = wfExtSignature.blockchain;
        const signAddress = wfSignDecoded.payload.addr;
        const orgPubkey = wfExtSignature.pubkey;
        /**
         * @callback authVerifySignatureCb
         * @param {Error} err any error
         * @param {wfSignDecoded} [result] the verified and decoded signature
         */
        wfBlockchains.verifySignature(wfSignature, signAddress, orgPubkey, blockchain, function authVerifySignatureCb(err, result) {
            if (err) return callback(err);
            if (result) return callback(null, wfSignDecoded);
            return callback(null, wfSignDecoded);
        });
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Verifies the information for authentication method 1
 * @private
 * @param {Object} wfAuthMessage a Whiteflag authentication message
 * @param {wfMessageCb} callback function called on completion
 */
function wfAuthentication1(wfAuthMessage, callback) {
    let authURL;
    let validDomains = [];

    // Get URL in authentication message and from valid domain list in config file
    try {
        // eslint-disable-next-line no-undef
        authURL = new URL(wfAuthMessage.MessageBody.VerificationData);
        validDomains = wfConfigData.authentication['1'].validDomains || [];
    } catch(err) {
        log.error(MODULELOG, `Could not get signature URLs: ${err.message}`);
        wfAuthMessage.MetaHeader.validationErrors = arr.addItem(
            wfAuthMessage.MetaHeader.validationErrors,
            `Could not get signature URLs: ${err.message}`
        );
        return callback(err, wfAuthMessage);
    }
    // Check for valid domain names
    if (validDomains.length > 0 && !validDomains.includes(authURL.hostname)) {
        wfAuthMessage.MetaHeader.validationErrors = arr.addItem(
            wfAuthMessage.MetaHeader.validationErrors,
            `The domain that holds the authentication signature is not considered valid: ${authURL.hostname}`
        );
        wfAuthMessage.MetaHeader.originatorValid = false;
        return callback(null, wfAuthMessage);
    }
    // Check availability of public key
    if (!wfAuthMessage.MetaHeader?.originatorPubKey) {
        return callback(new Error(`No public key available for authentication of originator of ${type(wfAuthMessage)} message: ${wfAuthMessage.MetaHeader.transactionHash}`));
    }
    // Get signature from an internet resource
    retrieveSignature(authURL, function authGetSignatureCb(err, wfSignature) {
        if (err) {
            if (!(err instanceof ProcessingError || err instanceof ProtocolError)) {
                log.error(MODULELOG, `Could not get signature: ${err.message}`);
            }
            wfAuthMessage.MetaHeader.validationErrors = arr.addItem(
                wfAuthMessage.MetaHeader.validationErrors,
                `Could not get signature: ${err.message}`);
            return callback(err, wfAuthMessage);
        }
        // Verify the signature
        const wfExtSignature = {
            blockchain: wfAuthMessage.MetaHeader.blockchain,
            address: wfAuthMessage.MetaHeader.originatorAddress,
            pubkey: wfAuthMessage.MetaHeader.originatorPubKey,
            jws: wfSignature
        };
        verifySignature(wfExtSignature, function authVerifySignatureCb(err, wfSignDecoded) {
            if (err && !(err instanceof ProtocolError)) {
                log.warn(MODULELOG, `Could not verify signature from ${wfAuthMessage.MessageBody.VerificationData}: ${err.message}`);
                wfAuthMessage.MetaHeader.validationErrors = arr.addItem(
                    wfAuthMessage.MetaHeader.validationErrors,
                    `Could not verify signature: ${err.message}`
                );
                return callback(null, wfAuthMessage);
            }
            if (!wfSignDecoded) {
                log.debug(MODULELOG, `Could not decode and verify signature from ${wfAuthMessage.MessageBody.VerificationData}`);
                wfAuthMessage.MetaHeader.validationErrors = arr.addItem(
                    wfAuthMessage.MetaHeader.validationErrors,
                    'Could not decode and verify signature'
                );
                return callback(null, wfAuthMessage);
            }
            log.trace(MODULELOG, `Verified signature from ${wfAuthMessage.MessageBody.VerificationData}: ` + JSON.stringify(wfSignDecoded));

            // Perform authentication checks
            let authenticationErrors = [];
            if (err instanceof ProtocolError) {
                if (err.causes?.length > 0) {
                    authenticationErrors = arr.addArray(authenticationErrors, err.causes);
                } else {
                    authenticationErrors.push(err.message);
                }
            }
            if (wfSignDecoded.addr.toLowerCase() !== wfAuthMessage.MetaHeader.originatorAddress.toLowerCase()) {
                authenticationErrors.push(`Signature address does not correspond with message address: ${wfSignDecoded.addr} != ${wfAuthMessage.MetaHeader.originatorAddress}`);
                wfAuthMessage.MetaHeader.originatorValid = false;
            }
            if (wfSignDecoded.url !== wfAuthMessage.MessageBody.VerificationData) {
                authenticationErrors.push(`Signature URL does not correspond with authentication message URL: ${wfSignDecoded.url} != ${wfAuthMessage.MessageBody.VerificationData}`);
                wfAuthMessage.MetaHeader.originatorValid = false;
            }
            // Check result and update metaheader and state
            if (authenticationErrors.length > 0) {
                // Return with authentication errors
                wfAuthMessage.MetaHeader.originatorValid = false;
                wfAuthMessage.MetaHeader.validationErrors = arr.addArray(wfAuthMessage.MetaHeader.validationErrors, authenticationErrors);
                let err = new ProtocolError(`Could not authenticate originator of ${type(wfAuthMessage)} message: ${wfAuthMessage.MetaHeader.transactionHash}`, authenticationErrors, 'WF_AUTH_ERROR');
                return callback(err, wfAuthMessage);
            }
            // Authentication is valid
            wfAuthMessage.MetaHeader.originatorValid = true;

            // Update originator state
            let originatorData = {
                name: wfSignDecoded.orgname,
                blockchain: wfAuthMessage.MetaHeader.blockchain,
                address: wfAuthMessage.MetaHeader.originatorAddress,
                originatorPubKey: wfAuthMessage.MetaHeader.originatorPubKey,
                url: wfSignDecoded.url,
                updated: new Date().toISOString(),
                authenticationValid: true,
                authenticationMessages: [ wfAuthMessage.MetaHeader.transactionHash ]
            };
            if (wfAuthMessage.MessageHeader.ReferenceIndicator === '0') {
                originatorData.authenticationMessages = [ wfAuthMessage.MetaHeader.transactionHash ];
            }
            log.debug(MODULELOG, `Updating state with authenticated originator of ${type(wfAuthMessage)} message: ${wfAuthMessage.MetaHeader.transactionHash}: ` + JSON.stringify(originatorData));
            originatorData.updated = new Date().toISOString();
            wfState.upsertOriginatorData(originatorData);
            return callback(null, wfAuthMessage);
        });
    });
}

/**
 * Verifies the information for authentication method 2
 * @private
 * @param {Object} wfAuthMessage a Whiteflag authentication message
 * @param {wfMessageCb} callback
 */
function wfAuthentication2(wfAuthMessage, callback) {
    // Get known authentication tokens and iterate over them
    wfState.getKeyIds('authTokens', function authGetKeyIdsCb(err, authTokenIds) {
        if (err) return callback(err, wfAuthMessage);
        iterateAuthTokens(authTokenIds, 0);
    });

    /**
     * Tries to match a known authentication token with the received authentication message
     * @private
     * @param {Array} authTokenIds Identifiers of all known authentication tokens
     * @param {number} t Token counter
     */
    function iterateAuthTokens(authTokenIds = [], t = 0) {
        // Return message if no more tokens
        if (t >= authTokenIds.length) {
            log.debug(MODULELOG, `Unknown originator authentication token in ${type(wfAuthMessage)} message: ${wfAuthMessage.MetaHeader.transactionHash}`);
            wfAuthMessage.MetaHeader.validationErrors = arr.addItem(
                wfAuthMessage.MetaHeader.validationErrors,
                'Unknown originator authentication token'
            );
            return callback(null, wfAuthMessage);
        }
        log.trace(MODULELOG, `Trying authentication token ${(t + 1)}/${authTokenIds.length} for ${type(wfAuthMessage)} message: ${wfAuthMessage.MetaHeader.transactionHash} from ${wfAuthMessage.MetaHeader.blockchain} account ${wfAuthMessage.MetaHeader.originatorAddress}`);

        // Get secret authentication token from state and put in buffer
        wfState.getKey('authTokens', authTokenIds[t], function authGetKey(err, authToken) {
            if (err) return callback(err, wfAuthMessage);

            // Generate authentication token and compare with message
            generateToken(authToken, wfAuthMessage.MetaHeader.originatorAddress, wfAuthMessage.MetaHeader.blockchain, function authGenerateTokenCb(err, token) {
                if (err) return callback(err, wfAuthMessage);

                // Comnpare message authentication data with known token
                if (token !== wfAuthMessage.MessageBody.VerificationData.toLowerCase()) {
                    // No match; try next token
                    return iterateAuthTokens(authTokenIds, (t + 1));
                }
                log.trace(MODULELOG, `Found a matching authentication token for ${type(wfAuthMessage)} message: ${wfAuthMessage.MetaHeader.transactionHash}`);
                wfAuthMessage.MetaHeader.originatorValid = true;

                // Get originator data and update originator state
                wfState.getOriginatorAuthToken(authTokenIds[t], function authGetOriginatorTokenCb(err, originator) {
                    if (err) return callback(err, wfAuthMessage);
                    let name = '(unknown)';
                    if (originator?.name) name = originator.name;
                    let originatorData = {
                        name: name,
                        blockchain: wfAuthMessage.MetaHeader.blockchain,
                        address: wfAuthMessage.MetaHeader.originatorAddress,
                        originatorPubKey: wfAuthMessage.MetaHeader.originatorPubKey,
                        authTokenId: authTokenIds[t],
                        updated: new Date().toISOString(),
                        authenticationValid: true
                    };
                    if (wfAuthMessage.MessageHeader.ReferenceIndicator === '0') {
                        originatorData.authenticationMessages = [ wfAuthMessage.MetaHeader.transactionHash ];
                    }
                    log.debug(MODULELOG, `Updating state with authenticated originator of ${type(wfAuthMessage)} message: ${wfAuthMessage.MetaHeader.transactionHash}: ` + JSON.stringify(originatorData));
                    wfState.upsertOriginatorData(originatorData);
                    return callback(null, wfAuthMessage);
                });
            });
        });
    }
}

/**
 * Gets an authentication signature from an url
 * @private
 * @param {URL} authURL a URL to get the authentication signature from
 * @param {genericCb} callback function called on completion
 */
function retrieveSignature(authURL, callback) {
    // Get data based on protocol specified in url
    switch (authURL.protocol) {
        case 'http:': {
                // Get signature over http
                http.get(
                    authURL,
                    httpResponseHandler
                ).on('error', errorHandler);
            break;
        }
        case 'https:': {
                // Get signature over https
                https.get(
                    authURL,
                    httpResponseHandler
                ).on('error', errorHandler);
            break;
        }
        default: {
            // Method does not exist
            errorHandler(new ProcessingError(`Unsupported protocol for retrieving signature: ${authURL.protocol}`, null, 'WF_API_NOT_IMPLEMENTED'));
        }
    }
    /**
     * Handles http request errors
     * @private
     * @param {Error} err any error
     */
    function errorHandler(err) {
        if (err && err instanceof ProcessingError) return callback(err);
        return callback(new Error(`Error when retrieving signature from ${authURL.href}: ${err.message}`));
    }
    /**
     * Handles http responses
     * @private
     * @param {Object} res http response
     */
    function httpResponseHandler(res) {
        let resBody = '';
        // Get data chuncks
        res.on('data', function authHttpDataCb(data) {
            resBody += data;
        });
        // Get signature from response body
        let wfSignature;
        res.on('end', function authHttpEndCb() {
            try {
                wfSignature = JSON.parse(resBody);
            } catch(err) {
                errorHandler(err);
            }
            return callback(null, wfSignature);
        });
    }
}

/**
 * @private
 * @param {Object} signPayload the signature payload to be checked
 * @returns {Array} error messages, if any
 */
function checkSignPayload(signPayload) {
    let signErrors = [];
    if (!signPayload?.addr) signErrors.push('Missing authentication signature property: \'addr\'');
    if (!signPayload?.orgname) signErrors.push('Missing authentication signature property: \'orgname\'');
    if (!signPayload?.url) signErrors.push('Missing authentication signature property: \'url\'');
    return signErrors;
}
