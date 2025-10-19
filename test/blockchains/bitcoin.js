/**
 * @module test/blockchains/bitcoin/accounts
 * @summary Whiteflag test script for Bitcoin accounts
 * @description Script for testing Bitcoin accounts
 */

/* Node.js core and external modules */
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');
const fs = require('fs');
const bitcoin = require('bitcoinjs-lib');

/* Common internal functions and classes */
const { ignore } = require('../../lib/_common/processing');
const log = require('../../lib/_common/logger');
log.setLogLevel(1, ignore);

/* Project modules required for test */
const btcAccounts = require('../../lib/blockchains/bitcoin/accounts');

/* Constants */
/**
 * @constant {Object} testVector
 * @description Defines the encoding and decoding test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/_static/blockchains/bitcoin.testvector.json'));

/* TEST SCRIPT */
testCase('Bitcoin blockchain module', function() {
    let account;
    testCase('Bitcoin accounts', function() {
        assertion(' 1. should correctly create account from wif', function(done) {
            account = btcAccounts.test.createAccountEntry(testVector.accounts['1'].wif, bitcoin.networks.bitcoin);
            assert.strictEqual(account.address, testVector.accounts['1'].address);
            assert.strictEqual(account.publicKey, testVector.accounts['1'].publicKey);
            return done();
        });
    });
});
