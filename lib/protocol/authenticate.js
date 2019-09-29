'use strict';
/**
 * @module  lib/protocol/authenticate
 * @summary Whiteflag authentication module
 * @description Module for Whiteflag authentication
 * @todo complete authentication methods
 */
module.exports = {
    // Authentication functions
    message: verifyMessage,
    verify: verifyAuthentication,
    remove: removeAuthentication,
    sign: createSignature,
    decodeSignature,
    verifySignature
};

// Node.js core and external modules //
const jwt = require('jsonwebtoken');
const http = require('http');
const https = require('https');

// Whiteflag common functions and classes //
const log = require('../common/logger');
const array = require('../common/arrays');
const { ProcessingError, ProtocolError } = require('../common/errors');

// Whiteflag modules //
const wfApiBlockchain = require('../blockchains');
const wfState = require('./state');

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
 * @param {object} wfMessage a Whiteflag message
 * @param {function} callback function to be called upon completion
 * @returns
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
 * @param {object} wfAuthMessage a Whiteflag authentication message
 * @param {function} callback function called upon completion
 */
function verifyAuthentication(wfAuthMessage = {}, callback) {
    if (wfAuthMessage.MessageHeader.MessageCode !== AUTHMESSAGECODE) {
        return callback(new ProcessingError(`Not an authentication message: ${wfAuthMessage.MessageHeader.MessageCode}`), wfAuthMessage);
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
            return callback(new ProtocolError(`Invalid authentication method: ${wfAuthMessage.MessageBody.VerificationMethod}`));
        }
    }
}

/**
 * Removes the authentication information of the message originator
 * @function removeAuthentication
 * @alias lib/protocol/authenticate.remove
 * @param {object} wfAuthMessage a Whiteflag authentication message
 * @param {function} callback
 */
function removeAuthentication(wfAuthMessage = {}, callback) {
    // Check messageheader
    if (wfAuthMessage.MessageHeader.MessageCode !== AUTHMESSAGECODE) {
        return callback(new ProcessingError(`Not an authentication message: ${wfAuthMessage.MessageHeader.MessageCode}`), wfAuthMessage);
    }
    if (wfAuthMessage.MessageHeader.ReferenceIndicator !== '1'
        && wfAuthMessage.MessageHeader.ReferenceIndicator !== '4') {
        return callback(new ProcessingError('Authentication message does not have reference code 1 or 4'), wfAuthMessage);
    }
    // Check for referenced message in originators state
    wfState.getOriginatorData(wfAuthMessage.MetaHeader.originatorAddress, function authGetOriginatorCb(err, originator) {
        if (err) log.error(MODULELOG, `Error getting originator state: ${err.message}`);

        // Check originator
        if (!originator) {
            // Authentication message from previously unknown originator
            log.debug(MODULELOG, `Authentication message with reference code ${wfAuthMessage.MessageHeader.ReferenceIndicator} from unknown originator account: ${wfAuthMessage.MetaHeader.originatorAddress}`);
            wfAuthMessage.MetaHeader.messageErrors = array.addArray(wfAuthMessage.MetaHeader.messageErrors, 'Unknown originator');
            return callback(null, wfAuthMessage);
        }
        // Check if any known authentication messages
        if (!originator.authenticationMessages) {
            log.debug(MODULELOG, `No authentication messages known for originator: ${originator.address}`);
            return callback(null, wfAuthMessage);
        }
        // Authentication message from known originator
        wfAuthMessage.MetaHeader.originatorValid = true;
        const authIndex = originator.authenticationMessages.findIndex(hash => hash === wfAuthMessage.MessageHeader.ReferencedMessage);
        if (authIndex >= 0) {
            log.debug(MODULELOG, `Removing authentication message from originators state: ${originator.authenticationMessages[authIndex]}`);
            originator.authenticationMessages.splice(authIndex, 1);
            wfState.upsertOriginatorData(originator);
        }
        // Check if any authentication message transaction hashes left
        if (originator.authenticationMessages.length === 0) {
            log.debug(MODULELOG, `No valid authentication messages anymore for originator: ${originator.address}`);
            originator.authenticationValid = false;
            wfState.upsertOriginatorData(originator);
        }
        return callback(null, wfAuthMessage);
    });
}

/**
 * Requests a authentication signature for the appropriate blockchain
 * @function createSignature
 * @alias module:lib/protocol/authenticate.sign
 * @param {object} signPayload the signature payload object to be signed
 * @param {string} address the address of the account for which the signature is requested
 * @param {string} blockchain the blockchain for which the signature is requested
 * @param {function} callback function to be called upon completion
 */
function createSignature(signPayload = {}, address, blockchain, callback) {
    // Check blockchain and address
    if (!blockchain || !address) {
        return callback(new ProcessingError('Missing blockchain or address', null, 'WF_API_BAD_REQUEST'));
    }
    // Check request for complete signature payload
    let signErrors = [];
    if (!signPayload.addr) signPayload.addr = address;
    if (signPayload.addr !== address) signErrors.push('Signature address does not match blockchain account');
    if (!signPayload.orgname) signErrors.push('Missing authentication signature property: orgname');
    if (!signPayload.url) signErrors.push('Missing authentication signature property: url');
    if (signErrors.length > 0) {
        return callback(new ProtocolError('Invalid Whiteflag authentication signature request', signErrors, 'WF_SIGN_ERROR'), null);
    }
    // Get signature for the appropriate blockchain
    wfApiBlockchain.requestSignature(signPayload, blockchain, function authRequestSignatureCb(err, wfSignature) {
        if (err) return callback(err);

        // Check signature before returning response
        decodeSignature(wfSignature, function authVerifySignatureCb(err, wfSignatureDecoded) {
            if (err) return callback(err);

            // Return verified signature with decoded signature
            return callback(null, wfSignature, wfSignatureDecoded);
        });
    });
}

/**
 * Decodes authentication signature
 * @function decodeSignature
 * @alias module:lib/protocol/authenticate.decodeSignature
 * @param {object} wfSignature a Whiteflag authentication signature
 * @param {function} callback function to be called upon completion
 */
function decodeSignature(wfSignature, callback) {
    // Check properties of the signature object
    let signErrors = [];
    if (!wfSignature.protected) signErrors.push('Missing object property: protected');
    if (!wfSignature.payload) signErrors.push('Missing object property: payload');
    if (!wfSignature.signature) signErrors.push('Missing object property: signature');
    if (signErrors.length > 0) {
        return callback(new ProtocolError('Invalid Whiteflag authentication signature', signErrors, 'WF_SIGN_ERROR'), null);
    }
    // Try to decode the signature and return result
    let wfSignatureDecoded = {};
    try {
        const signatureToken = wfSignature.protected
                        + '.' + wfSignature.payload
                        + '.' + wfSignature.signature;
        wfSignatureDecoded = jwt.decode(signatureToken, {complete: true});
    } catch(err) {
        // TODO: check err object
        return callback(err, null);
    }
    return callback(null, wfSignatureDecoded);
}

/**
 * Verifies authentication signature
 * @function verifySignature
 * @alias module:lib/protocol/authenticate.verifySignature
 * @param {object} wfExtSignature an extended Whiteflag authentication signature
 * @param {function} callback function to be called upon completion
 */
function verifySignature(wfExtSignature, callback) {
    // Check properties of the extended signature object
    let signErrors = [];
    if (!wfExtSignature.blockchain) signErrors.push('Missing object property: blockchain');
    if (!wfExtSignature.originatorPubKey) signErrors.push('Missing object property: originatorPubKey');
    if (!wfExtSignature.wfSignature) signErrors.push('Missing object property: wfSignature');
    if (signErrors.length > 0) {
        return callback(new ProcessingError('Invalid extended Whiteflag authentication signature', signErrors), null);
    }
    // Check properties of the signature object
    if (!wfExtSignature.wfSignature.protected) signErrors.push('Missing object property: protected');
    if (!wfExtSignature.wfSignature.payload) signErrors.push('Missing object property: payload');
    if (!wfExtSignature.wfSignature.signature) signErrors.push('Missing object property: signature');
    if (signErrors.length > 0) {
        return callback(new ProtocolError('Invalid Whiteflag authentication signature', signErrors, 'WF_SIGN_ERROR'), null);
    }
    // Construct JSON Web Token for verification
    const signatureToken = wfExtSignature.wfSignature.protected
        + '.' + wfExtSignature.wfSignature.payload
        + '.' + wfExtSignature.wfSignature.signature;

    // Get keys and verify signature
    wfApiBlockchain.requestKeys(wfExtSignature.originatorPubKey, wfExtSignature.blockchain, function authRequestKeysCb(err, originatorKeys) {
            if (err) return callback(err);

            // Call verification function and check for errors
            jwt.verify(signatureToken, originatorKeys.pemkey, function authVerifySignatureCb(err, wfSignatureDecoded) {
                if (err) {
                    if (err.name === 'JsonWebTokenError'
                        || err.name === 'TokenExpiredError'
                        || err.name === 'NotBeforeError'
                    ) {
                        return callback(new ProtocolError('Invalid Whiteflag authentication signature', [ `${err.name}: ${err.message}` ], 'WF_SIGN_ERROR'));
                    }
                    return callback(new Error(`Could not verify signature: ${err.message}`));
                }
                return callback(null, wfSignatureDecoded, originatorKeys);
            }
        );
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Verifies the information for authentication method 1
 * @private
 * @param {object} wfAuthMessage a Whiteflag authentication message
 * @param {function} callback function to be called upon completion
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
        log.error(MODULELOG, `Cannot get signature URLs: ${err.message}`);
        wfAuthMessage.MetaHeader.messageErrors = array.addItem(
            wfAuthMessage.MetaHeader.messageErrors,
            `Cannot get signature URLs: ${err.message}`
        );
        return callback(err, wfAuthMessage);
    }
    // Check for valid domain names
    if (validDomains.length > 0 && !validDomains.includes(authURL.hostname)) {
        wfAuthMessage.MetaHeader.messageErrors = array.addItem(
            wfAuthMessage.MetaHeader.messageErrors,
            `The domain that holds the authentication signature is not considered valid: ${authURL.hostname}`
        );
        wfAuthMessage.MetaHeader.originatorValid = false;
        return callback(null, wfAuthMessage);
    }
    // Get signature from an internet resource
    getSignature(authURL, function authGetSignatureCb(err, wfSignature) {
        if (err) {
            if (!(err instanceof ProcessingError || err instanceof ProtocolError)) {
                log.error(MODULELOG, `Cannot get signature: ${err.message}`);
            }
            wfAuthMessage.MetaHeader.messageErrors = array.addItem(
                wfAuthMessage.MetaHeader.messageErrors,
                `Cannot get signature: ${err.message}`);
            return callback(err, wfAuthMessage);
        }
        // Verify the signature
        const wfExtSignature = {
            blockchain: wfAuthMessage.MetaHeader.blockchain,
            originatorPubKey: wfAuthMessage.MetaHeader.originatorPubKey,
            wfSignature: wfSignature
        };
        verifySignature(wfExtSignature, function authVerifySignatureCb(err, wfSignatureDecoded, originatorKeys) {
            if (err) {
                log.warn(MODULELOG, `Cannot verify signature from ${wfAuthMessage.MessageBody.VerificationData}: ${err.message}`);
                wfAuthMessage.MetaHeader.messageErrors = array.addItem(
                    wfAuthMessage.MetaHeader.messageErrors,
                    `Cannot verify signature: ${err.message}`
                );
                return callback(null, wfAuthMessage);
            }
            if (!wfSignatureDecoded) {
                log.debug(MODULELOG, `Cannot decode and verify signature from ${wfAuthMessage.MessageBody.VerificationData}`);
                wfAuthMessage.MetaHeader.messageErrors = array.addItem(
                    wfAuthMessage.MetaHeader.messageErrors,
                    'Cannot decode and verify signature'
                );
                return callback(null, wfAuthMessage);
            }
            log.trace(MODULELOG, `Verified signature from ${wfAuthMessage.MessageBody.VerificationData}: ` + JSON.stringify(wfSignatureDecoded));

            // Perform authentication checks
            let authenticationErrors = [];
            if (wfSignatureDecoded.addr.toLowerCase() !== originatorKeys.address.toLowerCase()) {
                authenticationErrors.push(`Signature address does not correspond with derived blockchain address: ${wfSignatureDecoded.addr} != ${originatorKeys.address}`);
                wfAuthMessage.MetaHeader.originatorValid = false;
            }
            if (wfSignatureDecoded.addr.toLowerCase() !== wfAuthMessage.MetaHeader.originatorAddress.toLowerCase()) {
                authenticationErrors.push(`Signature address does not correspond with message address: ${wfSignatureDecoded.addr} != ${wfAuthMessage.MetaHeader.originatorAddress}`);
                wfAuthMessage.MetaHeader.originatorValid = false;
            }
            if (wfSignatureDecoded.url !== wfAuthMessage.MessageBody.VerificationData) {
                authenticationErrors.push(`Signature URL does not correspond with authentication message URL: ${wfSignatureDecoded.url} != ${wfAuthMessage.MessageBody.VerificationData}`);
                wfAuthMessage.MetaHeader.originatorValid = false;
            }
            // Check result and update metaheader and state
            if (authenticationErrors.length === 0) {
                wfAuthMessage.MetaHeader.originatorValid = true;

                // Update originator or create new one
                wfState.getOriginatorData(wfAuthMessage.MetaHeader.originatorAddress, function authGetOriginatorCb(err, originator) {
                    if (err) log.error(MODULELOG, `Error getting originator state: ${err.message}`);

                    if (!originator) {
                        // Authentication message from previously unknown originator
                        const newOriginator = {
                            name: wfSignatureDecoded.orgname,
                            blockchain: wfAuthMessage.MetaHeader.blockchain,
                            address: wfAuthMessage.MetaHeader.originatorAddress,
                            originatorPubKey: wfAuthMessage.MetaHeader.originatorPubKey,
                            ecdhPublicKey: null,
                            url: wfSignatureDecoded.url,
                            authTokenId: null,
                            authenticationValid: true,
                            authenticationMessages: [ wfAuthMessage.MetaHeader.transactionHash ]
                        };
                        log.debug(MODULELOG, 'Adding previously unknown originator to state: ' + JSON.stringify(newOriginator));
                        wfState.upsertOriginatorData(newOriginator);
                    } else {
                        // Authentication message from known originator
                        if (originator.address.toLowerCase() === wfAuthMessage.MetaHeader.originatorAddress.toLowerCase()) {
                            originator.name = wfSignatureDecoded.orgname;
                            originator.url = wfSignatureDecoded.url;
                            originator.authenticationValid = true;
                            if (wfAuthMessage.MessageHeader.ReferenceIndicator === '0') {
                                if (originator.authenticationMessages) {
                                    let index = originator.authenticationMessages.findIndex(hash => hash.toLowerCase() === wfAuthMessage.MetaHeader.transactionHash.toLowerCase());
                                    if (index < 0) {
                                        array.addItem(originator.authenticationMessages, wfAuthMessage.MetaHeader.transactionHash);
                                    }
                                } else {
                                    originator.authenticationMessages = [ wfAuthMessage.MetaHeader.transactionHash ];
                                }
                            }
                            log.trace(MODULELOG, 'Updating known originator in state: ' + JSON.stringify(originator));
                            wfState.upsertOriginatorData(originator);
                        }
                    }
                });
            } else {
                // Authentication errors
                log.trace(MODULELOG, 'Originator could not be authenticated: ' + JSON.stringify(authenticationErrors));
                wfAuthMessage.MetaHeader.messageErrors = array.addArray(wfAuthMessage.MetaHeader.messageErrors, authenticationErrors);
                wfAuthMessage.MetaHeader.originatorValid = false;
            }
            return callback(null, wfAuthMessage);
        });
    });
}

/**
 * Verifies the information for authentication method 2
 * @private
 * @param {object} wfAuthMessage a Whiteflag authentication message
 * @param {function} callback
 * @todo implement authentication method 2
 */
function wfAuthentication2(wfAuthMessage, callback) {
    return callback(new ProcessingError('Shared token authentication not implemented', null, 'WF_API_NOT_IMPLEMENTED'));
}

/**
 * Gets an authentication signature from an url
 * @private
 * @param {URL} authURL a URL to get the authentication signature from
 * @param {function} callback function to be called upon completion
 */
function getSignature(authURL, callback) {
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
            errorHandler(new ProcessingError(`Unsupported protocol for retrieving signature: ${authURL.protocol}`), null, 'WF_API_NOT_IMPLEMENTED');
        }
    }
    /**
     * Handles http request errors
     * @private
     * @param {object} err error object if any error
     */
    function errorHandler(err) {
        if (err && err instanceof ProcessingError) return callback(err);
        return callback(new Error(`Error when retrieving signature from ${authURL.href}: ${err.message}`));
    }
    /**
     * Handles http responses
     * @private
     * @param {object} res http response
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
