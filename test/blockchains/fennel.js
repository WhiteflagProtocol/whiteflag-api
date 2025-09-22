/**
 * @module test/blockchains/fennel/accounts
 * @summary Whiteflag test script for Fennel accounts
 * @description Script for testing Fennel accounts
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');
const fs = require('fs');

// Whiteflag common functions and classes //
const { ignore } = require('../../lib/_common/processing');
const log = require('../../lib/_common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
const { base64uToHex,
        hexToBase64u,
        hexToU8a,
        u8aToHex } = require('../../lib/_common/encoding');
const fnlAccounts = require('../../lib/blockchains/fennel/accounts');

// Constants //
/**
 * @constant {Object} testVector
 * @description Defines the encoding and decoding test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/_static/blockchains/fennel.testvector.json'));

// TEST SCRIPT //
testCase('Fennel blockchain module', function() {
    let account;
    let keypair;
    testCase('Fennel accounts', function() {
        assertion(' 1. should correctly create second account from seed', function(done) {
            account = fnlAccounts.test.create(testVector.accounts['1'].seed);
            keypair = fnlAccounts.test.createKeypair(account.publicKey, account.privateKey);
            assert.strictEqual(account.address, testVector.accounts['1'].address);
            assert.strictEqual(account.publicKey, testVector.accounts['1'].publicKey);
            return done();
        });
        assertion(' 2. should correctly create and verify signature', function(done) {
            // Create signature
            const input = "Message to be signed!";
            const signature = fnlAccounts.test.sign(input, keypair);
            
            // Verify signature
            const valid = fnlAccounts.test.verify(input, signature, keypair.publicKey);
            assert.strictEqual(valid, true);
            return done();
        });
        assertion(' 2. should correctly create and verify hex encoded signature', function(done) {
            // Create hexadecimal signature
            const input = "Message to be signed!";
            const output = fnlAccounts.test.sign(input, keypair);
            const signatureB64u = hexToBase64u(u8aToHex(output));
            
            // Prepare verification
            const signature = hexToU8a(base64uToHex(signatureB64u));
            const publicKey = hexToU8a(account.publicKey);

            // Verify signature
            const valid = fnlAccounts.test.verify(input, signature, publicKey);
            assert.strictEqual(valid, true);
            return done();
        });
    });
});
