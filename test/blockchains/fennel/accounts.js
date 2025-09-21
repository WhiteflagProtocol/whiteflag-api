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
const { ignore } = require('../../../lib/_common/processing');
const log = require('../../../lib/_common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
const fnlAccounts = require('../../../lib/blockchains/fennel/accounts');

// Constants //
/**
 * @constant {Object} testVector
 * @description Defines the encoding and decoding test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/_static/blockchains/fennel.testvector.json'));

// TEST SCRIPT //
testCase('Fennel blockchain accounts module', function() {
    assertion(' 1. should correctly create second account from seed', function(done) {
        const account = fnlAccounts.test.create(testVector.accounts['1'].seed);
        assert.strictEqual(account.address, testVector.accounts['1'].address);
        assert.strictEqual(account.publicKey, testVector.accounts['1'].publicKey);
        return done();
    });
});
