'use strict';
/**
 * @module test/common/crypto
 * @summary Common cryptographic functions test script
 * @description Script for testing all common cryptographic functions
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');

// Project modules required for test //
const { hkdf, zeroise } = require('../../lib/common/crypto');

// Set logger to log only fatal conditions //
const log = require('../../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //
const BINENCODING = 'hex';
/**
 * @constant {object} testVector
 * @description Defines the cryptographic test data
 */
const testVector = {
    '1': {
        $description: 'RFC 5869 A.1 Test Case 1',
        IKM: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
        salt: '000102030405060708090a0b0c',
        info: 'f0f1f2f3f4f5f6f7f8f9',
        L: 42,
        PKM: '077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5',
        OKM: '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865'
    },
    '2': {
        $description: 'RFC 5869 A.2 Test Case 2',
        IKM: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f',
        salt: '606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
        info: 'b0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
        L: 82,
        PKM: '06a6b88c5853361a06104c9ceb35b45cef760014904671014a193f40c15fc244',
        OKM: 'b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87'
    },
    '3': {
        $description: 'RFC 5869 A.3 Test Case 3',
        IKM: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
        salt: '',
        info: '',
        L: 42,
        PKM: '19ef24a32c717b167f33a91d6f648bdf96596776afdb6377ac434c1c293ccb04',
        OKM: '8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8'
    }
};

// TEST SCRIPT //
testCase('Common cryptography module', function() {
    testCase('Hash-based Key Derivation Function using SHA-256', function() {
        assertion(' 1. should pass RFC 5869 Test Case 1', function(done) {
            // RFC 5869 Test Vectors
            const ikm = Buffer.from(testVector['1'].IKM, BINENCODING);
            const salt = Buffer.from(testVector['1'].salt, BINENCODING);
            const info = Buffer.from(testVector['1'].info, BINENCODING);
            const keylen = testVector['1'].L;

            // Test the function
            const okm = hkdf(ikm, salt, info, keylen);
            const outcome = okm.toString(BINENCODING);
            assert.strictEqual(outcome, testVector['1'].OKM);
            return done();
        });
        assertion(' 2. should pass RFC 5869 Test Case 2', function(done) {
            // RFC 5869 Test Vectors
            const ikm = Buffer.from(testVector['2'].IKM, BINENCODING);
            const salt = Buffer.from(testVector['2'].salt, BINENCODING);
            const info = Buffer.from(testVector['2'].info, BINENCODING);
            const keylen = testVector['2'].L;

            // Test the function
            const okm = hkdf(ikm, salt, info, keylen);
            const outcome = okm.toString(BINENCODING);
            assert.strictEqual(outcome, testVector['2'].OKM);
            return done();
        });
        assertion(' 3. should pass RFC 5869 Test Case 3', function(done) {
            // RFC 5869 Test Vectors
            const ikm = Buffer.from(testVector['3'].IKM, BINENCODING);
            const salt = Buffer.from(testVector['3'].salt, BINENCODING);
            const info = Buffer.from(testVector['3'].info, BINENCODING);
            const keylen = testVector['3'].L;

            // Test the function
            const okm = hkdf(ikm, salt, info, keylen);
            const outcome = okm.toString(BINENCODING);
            assert.strictEqual(outcome, testVector['3'].OKM);
            return done();
        });
    });
    testCase('Zeroisation of buffers with sensitive data', function() {
        assertion(' 4. should fully zeroise buffer', function(done) {
            const buffer = Buffer.from('3f6a4c8d732e', 'hex');
            assert.strictEqual(buffer.toString('hex'), '3f6a4c8d732e');
            const dummy = zeroise(buffer);
            ignore(dummy);
            assert.strictEqual(buffer.toString('hex'), '000000000000');
            return done();
        });
    });
});

// PRIVATE TEST FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}

