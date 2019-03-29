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

// Project modules required for test //
const wfState = require('../../lib/protocol/state');

// Whiteflag common functions and classes //
const { hash } = require('../../lib/common/crypto');

// Set logger to log only fatal conditions //
const log = require('../../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //
/**
 * @constant {object} testVector
 * @description Defines state test data
 */
const testVector = {
    '1': {
        message: 'K(3)',
        transactionHash: '3abeef169a98c82467404525397f56b3199fd4eeb8466cb6fdb359495590e01f',
        referencedMessage: '4eeb1c7e45c4642fa2071bee9037324bb81424976dabf9c444a0ba33f51231ff',
        initVector: 'd36ce641790f6901278c5aa84a317706'
    },
    '2': {
        message: 'K(2)',
        transactionHash: '6aa545a84974d6b0e4388b72a249eedd52335847360394cfe465d3c48fb6b2b6',
        referencedMessage: '3abeef169a98c82467404525397f56b3199fd4eeb8466cb6fdb359495590e01f',
        initVector: 'ff9d88900a45e66375a477dbfdfa09bb'
    },
    '5': {
        name: 'Orange 1',
        url: 'https://organisation.int/signature.json',
        blockchain: 'blockchain-test',
        address: '32f2df2820df8d04f602592bd3c8776f7f44c52c',
        originatorPubKey: '049eba9b08425ef10dda9fc6b3db7c77bbd490150038a26cf921e27af182799dcb8e7b5e866611cca661c61689f01da9f37eb01587c5a48cd4be22de3b5935a462',
        authenticationValid: true,
        authenticationMessages: [
            '66902594f0b101287e9baede15d52192ed8b31dc03ff245fae9efa5dc9b27cb6',
            '094ac86d1990989c67d87337847d78078dac66cc99a5c30cf220a0a27aaa3780',
            'ca34fce22951269a153ee697c6a861a1a948207381f20af6bbf8f223c37883de',
            '465afe4ad4af5a3f6c2df22c7e4cb292ad45a69e32402173e652df26f9290ac3',
            'd2a82d10d36493c87fd5f38a4e695bf43e4c39a198d7ca83f1cedb6ed86962db',
            '2ca92f02530411653db5011674e9b52d72871c19a705b4f61141d63aa1ba080d',
            'ec7d47efb9c6ecd787d4110b724aa5cf667628ead147d7d00eb8d07acd28903c'
        ]
    },
    '6': {
        name: 'Orange 1',
        url: 'https://organisation.int/signature.json',
        blockchain: 'blockchain-test',
        address: '32f2df2820df8d04f602592bd3c8776f7f44c52c',
        originatorPubKey: '049eba9b08425ef10dda9fc6b3db7c77bbd490150038a26cf921e27af182799dcb8e7b5e866611cca661c61689f01da9f37eb01587c5a48cd4be22de3b5935a462',
        authenticationMessage: 'ec7d47efb9c6ecd787d4110b724aa5cf667628ead147d7d00eb8d07acd28903c'
    },
    '7': {
        name: 'Black 1',
        url: 'https://organisation.org/whiteflag/black1.json',
        blockchain: 'blockchain-test',
        address: '194f88933f00F9400b34d75E5987361302208770',
        originatorPubKey: '044d142e0af89ff36b234a3d02a77eac6d8b17cea9c21936cf143f9cb3c0394f17bd5e44aa9e356901f1ccdd7aaccf0c02227265a56d1b0b90e3af0053937a9399',
        authenticationValid: true,
        authenticationMessages: [
            'b6a332cdbcb32a2cde6bde55deddfb6bf0011addff26d66e35af78c06ee8e38d',
            '6766f3b8d3e5322f3334b7ca2bc2eaf0e25acbfcd8554323e486917758b78ed5',
            '7c362fd1036dc5d324411caf8bdd1f36707fcbc0b53bc9855f7c954fb24cd933'
        ]
    },
    '9': {
        blockchain: 'blockchain-test',
        account: {
            address: '32f2df2820df8d04f602592bd3c8776f7f44c52c',
            publicKey: '049eba9b08425ef10dda9fc6b3db7c77bbd490150038a26cf921e27af182799dcb8e7b5e866611cca661c61689f01da9f37eb01587c5a48cd4be22de3b5935a462'
        }
    },
    '10': {
        category: 'blockchainKeys',
        id: '17SiLwHvDQaJRxFqnSSZgHv7G59oWwfHT7',
        key: 'C9F4F0536E56AF8AC868E8AE032D2EFEFBCDE9D0F8AD46E16C8AB8DCF1C07175'
    },
    '11': {
        category: 'ecdhPrivateKeys',
        id: '17SiLwHvDQaJRxFqnSSZgHv7G59oWwfHT7',
        key: 'b2b4ea6ebca176560f430a330ff931d90950541a37f6b0c8802eb2a2370d7252'
    },
    '12': {
        category: 'presharedKeys',
        id: '32f2df2820df8d04f602592bd3c8776f7f44c52c',
        key: 'ab7c2f450d73db685d84551e05ffa0a73f8344f0ff96cadba68cabfe4b3f7597'
    },
    '13': {
        category: 'negotiatedKeys',
        id: '32f2df2820df8d04f602592bd3c8776f7f44c52c',
        key: '961632bf5091f4ec7a9fdec74a9b36ea19f3b1cc293c50b337618ee1c695f2af'
    },
    '14': {
        category: 'authTokens',
        id: '32f2df2820df8d04f602592bd3c8776f7f44c52c',
        key: '85b8f3d22f17fd087e5cb5b99cb5b02fdc9a6f6f66e4957f3c89229190f2d088479fc21f877598319fb8129abbeb861f19368f6f1e773aa13b996f17a5ed3de1'
    },
    '15': {
        blockchain: 'blockchain-test',
        address: '194f88933f00F9400b34d75E5987361302208770',
        privateKey: 'e9873d79c6d87dc0fb6a5778633389f4453213303da61f20bd67fc233aa33262'
    }
};

// TEST SCRIPT //
testCase('Whiteflag protocol state management module', function() {
    // Queue
    testCase('Queuing initialisation vector data', function() {
        // Test 1
        assertion(' 1. should successfully put new initialisation vector data on queue', function(done) {
            const ivObject = testVector['1'];
            wfState.updateQueueData('initVectors', 'referencedMessage', ivObject);

            // Check state against state schema
            let valerr = validateState();
            if (valerr) return done(valerr);
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
                wfState.updateQueueData('initVectors', 'transactionHash', ivObject);

                // Check state against state schema
                let valerr = validateState();
                if (valerr) return done(valerr);
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
                let valerr = validateState();
                if (valerr) return done(valerr);
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
    testCase('Originator state functions', function() {
        // Preserve test vector information
        let authMessagesLength = testVector['5'].authenticationMessages.length;

        // Test 5
        assertion(' 5. should successfully put new originator in state', function(done) {
            wfState.updateOriginatorData(testVector['5']);

            // Check state against state schema
            let valerr = validateState();
            if (valerr) return done(valerr);

            // Only one originator should be in state
            wfState.getOriginators(function test5GetOriginatorsCb(err, originators) {
                if (err) return done(err);
                assert.strictEqual(originators.length, 1);
                assert.deepStrictEqual(originators[0], testVector['5']);
                return done();
            });
        });
        // Test 6
        assertion(' 6. should correctly update originator in state', function(done) {
            const originatorAddress = testVector['6'].address;
            const transactionHash = testVector['6'].authenticationMessage;
            wfState.getOriginatorData(originatorAddress, function test6GetOriginator1Cb(err, originator1) {
                if (err) return done(err);
                assert(originator1);
                assert(originator1.authenticationValid);

                // Update data
                originator1.authenticationValid = false;
                originator1.authenticationMessages.push(transactionHash);
                wfState.updateOriginatorData(originator1);

                // Check state against state schema
                let valerr = validateState();
                if (valerr) return done(valerr);

                // Check data after update
                wfState.getOriginatorData(originatorAddress, function test6GetOriginator2Cb(err, originator2) {
                    if (err) return done(err);
                    assert(originator2);
                    assert(!originator2.authenticationValid);
                    assert.strictEqual(originator2.authenticationMessages.length, (authMessagesLength + 1));
                    return done();
                });
            });
        });
        // Test 7
        assertion(' 7. should remove the correct originator from state', function(done) {
            // Add another originator and remove the first
            wfState.updateOriginatorData(testVector['7']);
            wfState.removeOriginatorData(testVector['5'].address);

            // Check state against state schema
            let valerr = validateState();
            if (valerr) return done(valerr);

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
            wfState.getBlockchainData('iuqwp', function test8GetBlockchainCb(err, blockchainState) {
                if (err) return done(err);
                assert.strictEqual(blockchainState, null);
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
            let valerr = validateState();
            if (valerr) return done(valerr);

            // Check data after adding new blockchain
            wfState.getBlockchainData(blockchain, function test9GetBlockchainCb(err, blockchainState) {
                if (err) return done(err);
                assert(blockchainState);
                assert.strictEqual(blockchainState.accounts.length, 1);
                assert.strictEqual(blockchainState.accounts[0].address, testVector['9'].account.address);
                return done();
            });
        });
    });
    // Cryptographic key storage
    testCase('Cryptographic key storage', function() {
        // Test 10
        assertion('10a. should store new private blockchain key in state', function(done) {
            wfState.storeKey('blockchainKeys', testVector['10'].id, testVector['10'].key);
            let valerr = validateState();
            if (valerr) return done(valerr);
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
            wfState.storeKey('ecdhPrivateKeys', testVector['11'].id, testVector['11'].key);
            let valerr = validateState();
            if (valerr) return done(valerr);
            return done();
        });
        assertion('11b. should correctly retrieve ECDH private key from state', function(done) {
            wfState.getKey('ecdhPrivateKeys', testVector['11'].id, function test10GetKey(err, key) {
                if (err) return done(err);
                assert.strictEqual(key, testVector['11'].key);
                return done();
            });
        });
        // Test 12
        assertion('12a. should store new preshared secret in state', function(done) {
            wfState.storeKey('presharedKeys', testVector['12'].id, testVector['12'].key);
            let valerr = validateState();
            if (valerr) return done(valerr);
            return done();
        });
        assertion('12b. should correctly retrieve preshared secret from state', function(done) {
            wfState.getKey('presharedKeys', testVector['12'].id, function test10GetKey(err, key) {
                if (err) return done(err);
                assert.strictEqual(key, testVector['12'].key);
                return done();
            });
        });
        // Test 13
        assertion('13a. should store new ECDH negotiated secret in state', function(done) {
            wfState.storeKey('negotiatedKeys', testVector['13'].id, testVector['13'].key);
            let valerr = validateState();
            if (valerr) return done(valerr);
            return done();
        });
        assertion('13b. should correctly retrieve ECDH negotiated secret from state', function(done) {
            wfState.getKey('negotiatedKeys', testVector['13'].id, function test10GetKey(err, key) {
                if (err) return done(err);
                assert.strictEqual(key, testVector['13'].key);
                return done();
            });
        });
        // Test 14
        assertion('14a. should store new originator authentication token in state', function(done) {
            wfState.storeKey('authTokens', testVector['14'].id, testVector['14'].key);
            let valerr = validateState();
            if (valerr) return done(valerr);
            return done();
        });
        assertion('14b. should correctly retrieve originator authentication token from state', function(done) {
            wfState.getKey('authTokens', testVector['14'].id, function test10GetKey(err, key) {
                if (err) return done(err);
                assert.strictEqual(key, testVector['14'].key);
                return done();
            });
        });
    });
    // State enclosing/encryption and extraction/decryption
    testCase('State enclosing/encryption and extraction/decryption functions', function() {
        let stateObject = {};

        // Test 15
        assertion('15. should correctly enclose and encrypt state', function(done) {
            // Some test data with old private keys
            let blockchainState = {};
            blockchainState.accounts = [];
            blockchainState.accounts.push(testVector['15']);
            wfState.updateBlockchainData(testVector['15'].blockchain, blockchainState);

            // Check state against state schema
            let valerr = validateState();
            if (valerr) return done(valerr);

            // Enclose and encrypt
            stateObject = wfState.test.enclose();
            assert(stateObject);
            assert(stateObject.hasOwnProperty('state'));

            // Check state against state schema
            let stateErrors = wfState.test.validate();
            if (stateErrors.length > 0) return done(new Error('State does not validate against schema: ' + JSON.stringify(stateErrors)));
            done();
        });
        // Test 16
        assertion('16. should correctly decrypt, extract and update state ', function(done) {
            // Decrypt and extract
            let wfStateData = wfState.test.extract(stateObject);

            // Check extracted state against the unenclosed state
            assert(wfStateData.hasOwnProperty('blockchains'));
            assert(wfStateData.hasOwnProperty('originators'));
            assert(wfStateData.hasOwnProperty('queue'));
            assert(wfStateData.hasOwnProperty('crypto'));

            // Check state against state schema
            let stateErrors = wfState.test.validate(wfStateData);
            if (stateErrors.length > 0) return done(new Error('State does not validate against schema: ' + JSON.stringify(stateErrors)));

            // Check extracted state against the one originator from test vector 7
            assert.deepStrictEqual(wfStateData.originators[0], testVector['7']);

            // Check private blockchain keys moved to keystore, as second item after test vector 10
            let privateKeyId = hash(testVector['15'].blockchain + testVector['15'].address, 12);
            assert.strictEqual(wfStateData.crypto.blockchainKeys[1].id, privateKeyId);
            done();
        });
    });
});

// PRIVATE TEST FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}

/**
 * Validates state
 * @private
 */
// Check state against state schema
function validateState() {
    let stateErrors = wfState.test.validate();
    if (stateErrors.length > 0) return new Error('State does not validate against schema: ' + JSON.stringify(stateErrors));
    return null;
}
