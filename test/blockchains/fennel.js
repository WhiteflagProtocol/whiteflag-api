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

// Common internal functions and classes //
const { ignore } = require('../../lib/_common/processing');
const log = require('../../lib/_common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
const jws = require('../../lib/_common/jws');
const { base64uToHex,
        hexToBase64u } = require('../../lib/_common/encoding');
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
        assertion(' 1. should correctly create account from seed', function(done) {
            account = fnlAccounts.test.createAccountEntry(testVector.accounts['1'].seed);
            keypair = fnlAccounts.createKeypair(account.publicKey, account.privateKey);
            assert.strictEqual(account.address, testVector.accounts['1'].address);
            assert.strictEqual(account.publicKey, testVector.accounts['1'].publicKey);
            return done();
        });
        assertion(' 2. should correctly create and verify raw signature', function(done) {
            // Create signature
            const input = "Message to be signed!";
            const signature = fnlAccounts.test.generateSignature(input, account.publicKey, account.privateKey);
            
            // Verify signature
            const valid = fnlAccounts.test.testSignature(input, signature, keypair.publicKey);
            assert.strictEqual(valid, true);
            return done();
        });
        assertion(' 3. should correctly create and verify Whiteflag signature', function(done) {
            // Create hexadecimal signature
            const payload = testVector.accounts['1'].payload;
            const input1 = jws.createSignInput(payload, 'sr25519');
            const output = fnlAccounts.test.generateSignature(input1, account.publicKey, account.privateKey);
            const wfSignature = jws.createFlattened(input1, hexToBase64u(output));
            
            // Prepare verification
            const input2 = jws.serializeSignInput(wfSignature);
            const signature = base64uToHex(wfSignature.signature);

            // Verify signature
            const valid = fnlAccounts.test.testSignature(input2, signature, testVector.accounts['1'].publicKey);
            assert.strictEqual(valid, true);
            return done();
        });
    });
});
