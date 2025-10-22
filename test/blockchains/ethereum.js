/**
 * @module test/blockchains/ethereum/accounts
 * @summary Whiteflag test script for Ethereum accounts
 * @description Script for testing Ethereum accounts
 */

/* Node.js core and external modules */
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');
const fs = require('fs');

/* Common internal functions and classes */
const { ignore } = require('../../lib/_common/processing');
const log = require('../../lib/_common/logger');
log.setLogLevel(1, ignore);

/* Project modules required for test */
const ethAccounts = require('../../lib/blockchains/ethereum/accounts');

/* Constants */
/**
 * @constant {Object} testVector
 * @description Defines the encoding and decoding test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/_static/blockchains/ethereum.testvector.json'));

/* TEST SCRIPT */
testCase('Ethereum blockchain module', function() {
    let account;
    testCase('Ethereum accounts', function() {
        assertion(' 1. should correctly create account from private key', function(done) {
            account = ethAccounts.test.createAccountEntry(testVector.accounts['1'].privateKey);
            assert.strictEqual(account.address, testVector.accounts['1'].address);
            assert.strictEqual(account.publicKey, testVector.accounts['1'].publicKey);
            return done();
        });
    });
});
