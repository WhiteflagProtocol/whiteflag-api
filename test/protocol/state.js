'use strict';
/**
 * @module test/protocol/state
 * @summary Whiteflag state test script
 * @description Script for testing Whiteflag protocol state management functions
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
const wfState = require('../../lib/protocol/state');

// Common internal functions and classes //
const { hash } = require('../../lib/_common/crypto');

// Constants //
/**
 * @constant {Object} testVector
 * @description Defines state test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/_static/protocol/state.testvector.json'));

// TEST SCRIPT //
testCase('Whiteflag protocol state management module', function() {
    // Queue
    testCase('Queuing initialisation vector data', function() {
        // Test 1
        assertion(' 1. should successfully put new initialisation vector data on queue', function(done) {
            const ivObject = testVector['1'];
            wfState.upsertQueueData('initVectors', 'referencedMessage', ivObject);

            // Check state against state schema
            let stateError = validateState();
            if (stateError) return done(stateError);
            return done();
        });
        // Test 2
        assertion(' 2. should correctly update the initialisation vector data on queue', function(done) {
            const referencedMessage = testVector['2'].referencedMessage;
            const initVector = testVector['2'].initVector;
            wfState.getQueueData('initVectors', 'transactionHash', referencedMessage, function test2GetInitVectorQueueCb(err, ivObject) {
                if (err) return done(err);
                assert(ivObject);
                ivObject.initVector = initVector;
                wfState.upsertQueueData('initVectors', 'transactionHash', ivObject);

                // Check state against state schema
                let stateError = validateState();
                if (stateError) return done(stateError);
                return done();
            });
        });
        // Test 3
        assertion(' 3. should find and remove the correct initialisation vector data on queue', function(done) {
            const messageTransactionHash = testVector['1'].referencedMessage;
            const initVector = testVector['2'].initVector;
            wfState.getQueueData('initVectors', 'referencedMessage', messageTransactionHash, function test3GetInitVectorQueueCb(err, ivObject) {
                if (err) return done(err);
                assert(ivObject);
                assert.strictEqual(ivObject.initVector, initVector);
                wfState.removeQueueData('initVectors', 'referencedMessage', messageTransactionHash);

                // Check state against state schema
                let stateError = validateState();
                if (stateError) return done(stateError);
                return done();
            });
        });
        // Test 4
        assertion(' 4. should find no more initialisation vectors on queue', function(done) {
            wfState.getQueue('initVectors', function test4GetQueueCb(err, queue) {
                if (err) return done(err);
                assert.strictEqual(queue.length, 0);
                return done();
            });
        });
    });
    // Originators
    let authMessagesLength = testVector['5A'].authMessages.length;
    testCase('Originator state functions', function() {
        // Test 5
        assertion(' 5a. should successfully put new originator in state', function(done) {
            wfState.upsertOriginatorData(testVector['5A']);

            // Check state against state schema
            let stateError = validateState();
            if (stateError) return done(stateError);

            // Only one originator should be in state
            wfState.getOriginators(function test5GetOriginatorsCb(err, originators) {
                if (err) return done(err);
                assert.strictEqual(originators.length, 1);
                assert.deepStrictEqual(originators[0], testVector['5A']);
                return done();
            });
        });
        assertion(' 5b. should correctly update originator in state', function(done) {
            wfState.upsertOriginatorData(testVector['5B']);

            // Check state against state schema
            let stateError = validateState();
            if (stateError) return done(stateError);

            // Check data after update
            wfState.getOriginatorData(testVector['5B'].address, function test5GetOriginator2Cb(err, originator2) {
                if (err) return done(err);
                assert(originator2);
                assert(!originator2.authValid);
                assert.strictEqual(originator2.authMessages.length, (authMessagesLength + 1));
                return done();
            });
        });
        // Test 6
        assertion(' 6a. should successfully put originator authentication token in state', function(done) {
            wfState.upsertOriginatorData(testVector['6A']);

            // Check state against state schema
            let stateError = validateState();
            if (stateError) return done(stateError);

            // Check data after update
            wfState.getOriginatorAuthToken(testVector['6A'].authTokenId, function test6GetOriginatorAuthTokenCb(err, originator) {
                if (err) return done(err);
                assert(originator);
                assert(!originator.address);
                assert.strictEqual(originator.address, '');
                return done();
            });
        });
        assertion(' 6b. should correctly update originator based on authentication token', function(done) {
            wfState.upsertOriginatorData(testVector['6B']);

            // Check state against state schema
            let stateError = validateState();
            if (stateError) return done(stateError);

            // Check data after update
            wfState.getOriginatorData(testVector['5A'].address, function test6GetOriginatorAuthTokenCb(err, originator) {
                if (err) return done(err);
                assert(originator);
                assert(originator.authValid);
                assert.strictEqual(originator.authMessages.length, (authMessagesLength + 2));
                return done();
            });
        });
        // Test 7
        assertion(' 7. should remove the correct originator from state', function(done) {
            // Add another originator and remove the first
            wfState.upsertOriginatorData(testVector['7']);
            wfState.removeOriginatorData(testVector['5A'].address);

            // Check state against state schema
            let stateError = validateState();
            if (stateError) return done(stateError);

            // Only one originator should be left in state
            wfState.getOriginators(function test7GetOriginatorsCb(err, originators) {
                if (err) return done(err);
                assert.strictEqual(originators.length, 1);
                assert.deepStrictEqual(originators[0], testVector['7']);
                return done();
            });
        });
    });
    // Blockchains
    testCase('Blockchain state functions', function() {
        // Test 8
        assertion(' 8. should return processing error when requesting non existing blockchain', function(done) {
            wfState.getBlockchainData('iuqwp', function test8GetBlockchainCb(err, bcState) {
                if (err) return done(err);
                assert.strictEqual(bcState, null);
                return done();
            });
        });
        // Test 9
        assertion(' 9. should succesfully add new blockchain to state', function(done) {
            const blockchain = testVector['9'].blockchain;
            let newBlockchainState = {};
            newBlockchainState.accounts = [ testVector['9'].account ];
            wfState.updateBlockchainData(blockchain, newBlockchainState);

            // Check state against state schema
            let stateError = validateState();
            if (stateError) return done(stateError);

            // Check data after adding new blockchain
            wfState.getBlockchainData(blockchain, function test9GetBlockchainCb(err, bcState) {
                if (err) return done(err);
                assert(bcState);
                assert.strictEqual(bcState.accounts.length, 1);
                assert.strictEqual(bcState.accounts[0].address, testVector['9'].account.address);
                return done();
            });
        });
    });
    // Cryptographic key storage
    testCase('Cryptographic key storage', function() {
        // Test 10
        assertion('10a. should store new private blockchain key in state', function(done) {
            wfState.upsertKey('blockchainKeys', testVector['10'].id, testVector['10'].key);
            let stateError = validateState();
            if (stateError) return done(stateError);
            return done();
        });
        assertion('10b. should correctly retrieve private blockchain key from state', function(done) {
            wfState.getKey('blockchainKeys', testVector['10'].id, function test10GetKey(err, key) {
                if (err) return done(err);
                assert.strictEqual(key, testVector['10'].key);
                return done();
            });
        });
        // Test 11
        assertion('11a. should store new ECDH private key in state', function(done) {
            wfState.upsertKey('ecdhPrivateKeys', testVector['11'].id, testVector['11'].key);
            let stateError = validateState();
            if (stateError) return done(stateError);
            return done();
        });
        assertion('11b. should correctly retrieve ECDH private key from state', function(done) {
            wfState.getKey('ecdhPrivateKeys', testVector['11'].id, function test11GetKey(err, key) {
                if (err) return done(err);
                assert.strictEqual(key, testVector['11'].key);
                return done();
            });
        });
        // Test 12
        assertion('12a. should store new preshared secret in state', function(done) {
            wfState.upsertKey('presharedKeys', testVector['12'].id, testVector['12'].key);
            let stateError = validateState();
            if (stateError) return done(stateError);
            return done();
        });
        assertion('12b. should correctly retrieve preshared secret from state', function(done) {
            wfState.getKey('presharedKeys', testVector['12'].id, function test12GetKey(err, key) {
                if (err) return done(err);
                assert.strictEqual(key, testVector['12'].key);
                return done();
            });
        });
        // Test 13
        assertion('13a. should store new ECDH negotiated secret in state', function(done) {
            wfState.upsertKey('negotiatedKeys', testVector['13'].id, testVector['13'].key);
            let stateError = validateState();
            if (stateError) return done(stateError);
            return done();
        });
        assertion('13b. should correctly retrieve ECDH negotiated secret from state', function(done) {
            wfState.getKey('negotiatedKeys', testVector['13'].id, function test13GetKey(err, key) {
                if (err) return done(err);
                assert.strictEqual(key, testVector['13'].key);
                return done();
            });
        });
        // Test 14
        assertion('14a. should store new originator authentication token in state', function(done) {
            wfState.upsertKey('authTokens', testVector['14'].id, testVector['14'].key);
            let stateError = validateState();
            if (stateError) return done(stateError);
            return done();
        });
        assertion('14b. should correctly retrieve originator authentication token from state', function(done) {
            wfState.getKey('authTokens', testVector['14'].id, function test14GetKey(err, key) {
                if (err) return done(err);
                assert.strictEqual(key, testVector['14'].key);
                return done();
            });
        });
        assertion('15. should correctly retrieve key identifiers', function(done) {
            wfState.getKeyIds('authTokens', function testGetKeyId(err, keyArray) {
                if (err) return done(err);
                assert.deepEqual(keyArray, [ testVector['14'].id ]);
                return done();
            });
        });
    });
    // State enclosing/encryption and extraction/decryption
    testCase('State enclosing/encryption and extraction/decryption functions', function() {
        let stateObject = {};

        // Test 16
        assertion('16. should correctly enclose and encrypt state', function(done) {
            // Some test data with old private keys
            let bcState = {};
            bcState.accounts = [];
            bcState.accounts.push(testVector['16']);
            wfState.updateBlockchainData(testVector['16'].blockchain, bcState);

            // Check state against state schema
            let stateError = validateState();
            if (stateError) return done(stateError);

            // Enclose and encrypt
            stateObject = wfState.test.enclose();
            assert(stateObject);
            assert(Object.hasOwn(stateObject, 'state'));
            done();
        });
        // Test 16
        assertion('17. should correctly decrypt, extract and update state ', function(done) {
            // Decrypt and extract
            let wfStateData = wfState.test.extract(stateObject);

            // Check extracted state against the unenclosed state
            assert(Object.hasOwn(wfStateData, 'blockchains'));
            assert(Object.hasOwn(wfStateData, 'originators'));
            assert(Object.hasOwn(wfStateData, 'queue'));
            assert(Object.hasOwn(wfStateData, 'crypto'));

            // Check state against state schema
            let stateError = validateState(wfStateData);
            if (stateError) return done(stateError);

            // Check extracted state against the one originator from test vector 7
            assert.deepStrictEqual(wfStateData.originators[0], testVector['7']);

            // Check private blockchain keys moved to keystore, as second item after test vector 10
            let privateKeyId = hash(testVector['16'].blockchain + testVector['16'].address, 12);
            assert.strictEqual(wfStateData.crypto.blockchainKeys[1].id, privateKeyId);
            done();
        });
    });
});

// PRIVATE TEST FUNCTIONS //
/**
 * Validates state
 * @private
 */
// Check state against state schema
function validateState(stateData) {
    let stateErrors = wfState.test.validate(stateData);
    if (stateErrors.length > 0) return new Error('State does not validate against schema: ' + JSON.stringify(stateErrors));
    return null;
}
