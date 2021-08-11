'use strict';
/**
 * @module test/protocol/crypto
 * @summary Whiteflag cryptography test script
 * @description Script for testing all Whiteflag cryptographic functions
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
const wfCrypto = require('../../lib/protocol/crypto');
const { ProcessingError, ProtocolError } = require('../../lib/common/errors');

// Constants //
const BINENCODING = 'hex';
/**
 * @constant {Object} testVector
 * @description Defines the cryptographic test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/static/protocol/crypto.testvector.json'));

// TEST SCRIPT //
testCase('Whiteflag cryptography module', function() {
    testCase('AES 256 CTR Mode function for Whiteflag encryption methods 1 and 2', function() {
        assertion(' 1. should encrypt NIST SP 800-38A F.5.5 CTR-AES256.Encrypt test vectors correctly', function() {
            // NIST SP 800-38A Test Vectors; also pass the Whiteflag prefix the function expects
            const WFHEXPREFIX = '57463132';
            const plaintextBuffer = Buffer.from(WFHEXPREFIX
                + testVector['1'].plaintext1
                + testVector['1'].plaintext2
                + testVector['1'].plaintext3
                + testVector['1'].plaintext4, BINENCODING);
            const keyBuffer = Buffer.from(testVector['1'].key, BINENCODING);
            const ivBuffer = Buffer.from(testVector['1'].initCounter, BINENCODING);

            // Test the Whiteflag message encryption function for method 1
            const ciphertextBuffer1 = wfCrypto.test.encrypt(plaintextBuffer, '1', keyBuffer, ivBuffer);
            const outcome1 = ciphertextBuffer1.slice(4).toString(BINENCODING);
            assert.strictEqual(outcome1,
                testVector['1'].ciphertext1
                + testVector['1'].ciphertext2
                + testVector['1'].ciphertext3
                + testVector['1'].ciphertext4
            );
            // Test the Whiteflag message encryption function for method 2
            const ciphertextBuffer2 = wfCrypto.test.encrypt(plaintextBuffer, '2', keyBuffer, ivBuffer);
            const outcome2 = ciphertextBuffer2.slice(4).toString(BINENCODING);
            assert.strictEqual(outcome2,
                testVector['1'].ciphertext1
                + testVector['1'].ciphertext2
                + testVector['1'].ciphertext3
                + testVector['1'].ciphertext4
            );
        });
        assertion(' 2. should decrypt NIST SP 800-38A F.5.6 CTR-AES256.Decrypt test vectors correctly', function() {
            // NIST SP 800-38A Test Vectors; also pass the Whiteflag prefix the function expects
            const WFHEXPREFIX = '57463132';
            const encryptedMessageBuffer = Buffer.from(WFHEXPREFIX
                + testVector['2'].ciphertext1
                + testVector['2'].ciphertext2
                + testVector['2'].ciphertext3
                + testVector['2'].ciphertext4, BINENCODING);
            const keyBuffer = Buffer.from(testVector['2'].key, BINENCODING);
            const ivBuffer = Buffer.from(testVector['2'].initCounter, BINENCODING);

            // Test the Whiteflag message encryption function for method 1
            const ciphertextBuffer1 = wfCrypto.test.decrypt(encryptedMessageBuffer, '1', keyBuffer, ivBuffer);
            const outcome1 = ciphertextBuffer1.slice(4).toString(BINENCODING);
            assert.strictEqual(outcome1,
                testVector['2'].plaintext1
                + testVector['2'].plaintext2
                + testVector['2'].plaintext3
                + testVector['2'].plaintext4
            );
            // Test the Whiteflag message encryption function for method 2
            const ciphertextBuffer2 = wfCrypto.test.decrypt(encryptedMessageBuffer, '2', keyBuffer, ivBuffer);
            const outcome2 = ciphertextBuffer2.slice(4).toString(BINENCODING);
            assert.strictEqual(outcome2,
                testVector['2'].plaintext1
                + testVector['2'].plaintext2
                + testVector['2'].plaintext3
                + testVector['2'].plaintext4
            );
        });
    });
    let encryptedMessage5;
    let initVector5;
    let encryptedMessage6;
    let initVector6;
    testCase('Encryption of encoded messages', function() {
        assertion(' 3a. should return unencrypted message if encryption indicator is 0', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['3'];
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['3'].encryptionIndicator;
            wfCrypto.encrypt(
                wfMessage,
                Buffer.from(testVector['3'].unencryptedMessage, BINENCODING),
                function test3EncryptCb(err, wfMessage) {
                    if (err) return done(err);
                    assert.strictEqual(
                        wfMessage.MetaHeader.encodedMessage,
                        testVector['3'].unencryptedMessage
                    );
                    return done();
                }
            );
        });
        assertion(' 4a. should return protocol error if no negotiated key available for recipient', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['4'];
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['4'].encryptionIndicator;
            wfCrypto.encrypt(
                wfMessage,
                Buffer.from(testVector['4'].unencryptedMessage, BINENCODING),
                function test4EncryptCb(err, wfMessage) {
                    ignore(wfMessage);
                    assert(err);
                    if (!(err instanceof ProtocolError)) return done(err);
                    assert.strictEqual(err.code, 'WF_ENCRYPTION_ERROR');
                    return done();
                }
            );
        });
        assertion(' 5a. should correctly encrypt encoded message with method 2 and random initialisation vector', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['5'];
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['5'].encryptionIndicator;
            wfCrypto.encrypt(
                wfMessage,
                Buffer.from(testVector['5'].unencryptedMessage, BINENCODING),
                function test5EncryptCb(err, wfMessage) {
                    if (err) return done(err);
                    assert(wfMessage.MetaHeader.encryptionInitVector, 'No initialisation vector returned');
                    assert.notStrictEqual(wfMessage.MetaHeader.encryptionInitVector, testVector['7'].initVector);
                    initVector5 = wfMessage.MetaHeader.encryptionInitVector;
                    encryptedMessage5 = wfMessage.MetaHeader.encodedMessage;
                    assert.notStrictEqual(encryptedMessage5, testVector['5'].unencryptedMessage);
                    assert.notStrictEqual(encryptedMessage5, testVector['7'].encryptedMessage);
                    return done();
                }
            );
        });
        assertion(' 6a. should correctly encrypt encoded message with method 2 and random initialisation vector', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['6'];
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['6'].encryptionIndicator;
            wfCrypto.encrypt(
                wfMessage,
                Buffer.from(testVector['6'].unencryptedMessage, BINENCODING),
                function test6EncryptCb(err, wfMessage) {
                    if (err) return done(err);
                    assert(wfMessage.MetaHeader.encryptionInitVector, 'No initialisation vector returned');
                    assert.notStrictEqual(wfMessage.MetaHeader.encryptionInitVector, initVector5);
                    assert.notStrictEqual(wfMessage.MetaHeader.encryptionInitVector, testVector['7'].initVector);
                    initVector6 = wfMessage.MetaHeader.encryptionInitVector;
                    encryptedMessage6 = wfMessage.MetaHeader.encodedMessage;
                    assert.notStrictEqual(encryptedMessage6, encryptedMessage5);
                    assert.notStrictEqual(encryptedMessage6, testVector['6'].unencryptedMessage);
                    assert.notStrictEqual(encryptedMessage6, testVector['7'].encryptedMessage);
                    return done();
                }
            );
        });
    });
    testCase('Decryption of encrypted messages', function() {
        assertion(' 3b. should return unencrypted message if encryption indicator is 0', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['3'];
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['3'].encryptionIndicator;
            const encryptedMessage = Buffer.from(wfMessage.MetaHeader.encodedMessage, BINENCODING);
            wfCrypto.decrypt(
                wfMessage,
                encryptedMessage,
                function test3DecryptCb(err, decryptedMessage) {
                    if (err) return done(err);
                    assert.strictEqual(
                        decryptedMessage.toString(BINENCODING),
                        testVector['3'].unencryptedMessage
                    );
                    return done();
                }
            );
        });
        assertion(' 4b. should return protocol error if no negotiated key available for recipient', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['4'];
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['4'].encryptionIndicator;
            wfCrypto.decrypt(
                wfMessage,
                Buffer.from(testVector['4'].encodedMessage, BINENCODING),
                function test4DecryptCb(err, decryptedMessage) {
                    ignore(decryptedMessage);
                    assert(err);
                    if (!(err instanceof ProtocolError)) return done(err);
                    assert.strictEqual(err.code, 'WF_ENCRYPTION_ERROR');
                    return done();
                }
            );
        });
        assertion(' 5b. should correctly decrypt the encrypted message with method 2 and random initialisation vector', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['5'];
            wfMessage.MetaHeader.encodedMessage = encryptedMessage5;
            wfMessage.MetaHeader.encryptionInitVector = initVector5;
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['5'].encryptionIndicator;
            wfCrypto.decrypt(
                wfMessage,
                Buffer.from(encryptedMessage5, BINENCODING),
                function test5DecryptCb(err, decryptedMessage) {
                    if (err) return done(err);
                    assert.strictEqual(
                        decryptedMessage.toString(BINENCODING),
                        testVector['5'].unencryptedMessage
                    );
                    return done();
                }
            );
        });
        assertion(' 6b. should correctly decrypt the encrypted message with method 2 and random initialisation vector', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['6'];
            wfMessage.MetaHeader.encodedMessage = encryptedMessage6;
            wfMessage.MetaHeader.encryptionInitVector = initVector6;
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['6'].encryptionIndicator;
            wfCrypto.decrypt(
                wfMessage,
                Buffer.from(encryptedMessage6, BINENCODING),
                function test6DecryptCb(err, decryptedMessage) {
                    if (err) return done(err);
                    assert.strictEqual(
                        decryptedMessage.toString(BINENCODING),
                        testVector['6'].unencryptedMessage
                    );
                    return done();
                }
            );
        });
        assertion(' 7.  should correctly decrypt encrypted message with transmitted initialisation vector', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['7'];
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['7'].encryptionIndicator;
            wfCrypto.decrypt(
                wfMessage,
                Buffer.from(testVector['7'].encodedMessage, BINENCODING),
                function test7DecryptCb(err, decryptedMessage) {
                    if (err) return done(err);
                    assert.strictEqual(
                        decryptedMessage.toString(BINENCODING),
                        testVector['7'].unencryptedMessage
                    );
                    return done();
                }
            );
        });
        assertion(' 8.  should return processing error if no initialisation vector provided', function(done) {
            let wfMessage = {};
            wfMessage.MetaHeader = testVector['8'];
            wfMessage.MessageHeader = {};
            wfMessage.MessageHeader.EncryptionIndicator = testVector['8'].encryptionIndicator;
            wfCrypto.decrypt(
                wfMessage,
                Buffer.from(testVector['8'].encodedMessage, BINENCODING),
                function test8DecryptCb(err, decryptedMessage) {
                    ignore(decryptedMessage);
                    assert(err);
                    if (!(err instanceof ProcessingError)) return done(err);
                    return done();
                }
            );
        });
    });
    testCase('Elliptic Curve Diffie-Hellman (ECDH) key exchange', function() {
        let self = 'a10a42f7ed7339fd6f2336cc';
        let other = 'bf6cbd5d7bcfff237b1c0f8a';
        let ownPublicKey;
        let otherPublicKey;
        assertion(' 9.  should generate own ECDH key pair without errors', function(done) {
            wfCrypto.getECDHpublicKey(self, false, function test9getECDHpublicKeyCb(err, ecdhPublicKey) {
                if (err) done(err);
                ownPublicKey = ecdhPublicKey;
                assert.strictEqual(ownPublicKey.length, (((256 / 8) * 2) + 2));
                return done();
            });
        });
        assertion('10.  should generate other ECDH key pair without errors', function(done) {
            wfCrypto.getECDHpublicKey(other, true, function test10getECDHpublicKeyCb(err, ecdhPublicKey) {
                if (err) done(err);
                otherPublicKey = ecdhPublicKey;
                assert.strictEqual(otherPublicKey.length, (((256 / 8) * 2) + 2));
                return done();
            });
        });
        assertion('11.  should compute two equal shared secrets', function(done) {
            wfCrypto.generateECDHsecret(self, otherPublicKey, function test11generateECDHownSecret(err, ownSecret) {
                if (err) done(err);
                wfCrypto.generateECDHsecret(other, ownPublicKey, function test11generateECDHotherSecret(err, otherSecret) {
                    if (err) done(err);
                    assert.strictEqual(ownSecret, otherSecret);
                    return done();
                });
            });
        });
    });
});
