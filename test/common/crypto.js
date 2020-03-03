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
const fs = require('fs');

// Project modules required for test //
const { hkdf, zeroise } = require('../../lib/common/crypto');

// Set logger to log only fatal conditions //
const log = require('../../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //
const BINENCODING = 'hex';
/**
 * @constant {Object} testVector
 * @description Defines the common cryptographic functions test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/static/common/crypto.testvector.json'));

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

