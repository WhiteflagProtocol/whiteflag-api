/**
 * @module test/dependecnies
 * @summary Whiteflag dependencies test script
 * @description Script for testing and troubleshooting constructs based on external modules
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');
const fs = require('fs');

// Whiteflag common functions and classes //
const { ignore } = require('../../lib/common/processing');
const log = require('../../lib/common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
const { ProtocolError } = require('../../lib/common/errors');
const jwt = require('jsonwebtoken');
const KeyEncoder = require('key-encoder').default;

// Constants //
const SIGNKEYTYPE = 'secp256k1';
/**
 * @constant {Object} testVector
 * @description Defines the encoding and decoding test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/static/protocol/authentication.testvector.json'));


// TEST SCRIPT //
testCase('Whiteflag authentication tests', function() {
    testCase('Key encoding and signature pseudo tests', function() {
        const keyEncoder = new KeyEncoder(SIGNKEYTYPE);
        let pemkey;

        // Test 1
        assertion(' 1A. should correctly encode raw public key in PEM format', function(done) {
            // Signature Key in PEM encoding
            try {
                pemkey = keyEncoder.encodePublic(testVector[1].pubkey, 'raw', 'pem');
                assert.equal(pemkey, testVector[1].pemkey);
                ignore(pemkey);
            } catch(err) {
                return done(err);
            }
            return done();
        });
        // Test 2
        assertion(' 1B. should correctly verify authentication signature', function(done) {
            // Construct JSON Web Token for verification
            const signatureToken = testVector[1].signature.protected
            + '.' + testVector[1].signature.payload
            + '.' + testVector[1].signature.signature;

            // Call verification function and check for errors
            jwt.verify(signatureToken,
                       pemkey,
                       { allowInvalidAsymmetricKeyTypes: true },
                       function authVerifySignatureCb(err, signatureDecoded) {
                if (err) {
                    if (err.name === 'JsonWebTokenError'
                        || err.name === 'TokenExpiredError'
                        || err.name === 'NotBeforeError'
                    ) {
                        return done(new ProtocolError('Invalid Whiteflag authentication signature', [ `${err.name}: ${err.message}` ], 'WF_SIGN_ERROR'));
                    }
                    return done(new Error(`Could not verify signature: ${err.message}`));
                }
                ignore(signatureDecoded);
                return done();
            });
        });
    });
});
