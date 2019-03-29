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

// Project modules required for test //
const wfCrypto = require('../../lib/protocol/crypto');
const { ProcessingError, ProtocolError } = require('../../lib/common/errors');

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
    '1-obsolete': {
        $description: 'NIST SP 800-38A F.5.1 CTR-AES128.Encrypt',
        algorithm: 'aes-128-ctr',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        initCounter: 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
        plaintext1: '6bc1bee22e409f96e93d7e117393172a',
        ciphertext1: '874d6191b620e3261bef6864990db6ce',
        plaintext2: 'ae2d8a571e03ac9c9eb76fac45af8e51',
        ciphertext2: '9806f66b7970fdff8617187bb9fffdff',
        plaintext3: '30c81c46a35ce411e5fbc1191a0a52ef',
        ciphertext3: '5ae4df3edbd5d35e5b4f09020db03eab',
        plaintext4: 'f69f2445df4f9b17ad2b417be66c3710',
        ciphertext4: '1e031dda2fbe03d1792170a0f3009cee'
    },
    '2-obsolete': {
        $description: 'NIST SP 800-38A F.5.2 CTR-AES128.Decrypt',
        algorithm: 'aes-128-ctr',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        initCounter: 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
        ciphertext1: '874d6191b620e3261bef6864990db6ce',
        plaintext1: '6bc1bee22e409f96e93d7e117393172a',
        ciphertext2: '9806f66b7970fdff8617187bb9fffdff',
        plaintext2: 'ae2d8a571e03ac9c9eb76fac45af8e51',
        ciphertext3:'5ae4df3edbd5d35e5b4f09020db03eab',
        plaintext3: '30c81c46a35ce411e5fbc1191a0a52ef',
        ciphertext4: '1e031dda2fbe03d1792170a0f3009cee',
        plaintext4: 'f69f2445df4f9b17ad2b417be66c3710'
    },
    '1': {
        $description: 'NIST SP 800-38A F.5.5 CTR-AES256.Encrypt',
        algorithm: 'aes-256-ctr',
        key: '603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4',
        initCounter: 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
        plaintext1: '6bc1bee22e409f96e93d7e117393172a',
        ciphertext1: '601ec313775789a5b7a7f504bbf3d228',
        plaintext2: 'ae2d8a571e03ac9c9eb76fac45af8e51',
        ciphertext2: 'f443e3ca4d62b59aca84e990cacaf5c5',
        plaintext3: '30c81c46a35ce411e5fbc1191a0a52ef',
        ciphertext3: '2b0930daa23de94ce87017ba2d84988d',
        plaintext4: 'f69f2445df4f9b17ad2b417be66c3710',
        ciphertext4: 'dfc9c58db67aada613c2dd08457941a6'
    },
    '2': {
        $description: 'NIST SP 800-38A F.5.6 CTR-AES256.Decrypt',
        algorithm: 'aes-256-ctr',
        key: '603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4',
        initCounter: 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
        ciphertext1: '601ec313775789a5b7a7f504bbf3d228',
        plaintext1: '6bc1bee22e409f96e93d7e117393172a',
        ciphertext2: 'f443e3ca4d62b59aca84e990cacaf5c5',
        plaintext2: 'ae2d8a571e03ac9c9eb76fac45af8e51',
        ciphertext3: '2b0930daa23de94ce87017ba2d84988d',
        plaintext3: '30c81c46a35ce411e5fbc1191a0a52ef',
        ciphertext4: 'dfc9c58db67aada613c2dd08457941a6',
        plaintext4: 'f69f2445df4f9b17ad2b417be66c3710'
    },
    '3': {
        blockchain: 'test',
        originatorAddress: '007a0baf6f84f0fa7402ea972686e56d50b707c9b67b108866',
        unencryptedMessage: '574631302280000088891111999a2222aaab3333bbbc4444cccd5555ddde6666eeef7777fff8010000080800000000000284c80000006a0000002020020020',
        encryptionIndicator: '0',
        encryptionKeyInput: '',
        encryptionInitVector: ''
    },
    '4': {
        blockchain: 'test',
        originatorAddress: '007a0baf6f84f0fa7402ea972686e56d50b707c9b67b108866',
        recipientAddress: '00000000000000000000000000000000000000000000000000',
        unencryptedMessage: '5746313123000000000088888889111111119999999a22222222aaaaaaab33333333bbbbbbbb0983098309830983118b118b118b118b1993199319931993219b219b219b219b29a329a329a329a331ab31ab31ab31a9b1b9b1b9b1b9b1b9c1c9c1c9c1c9c1c8',
        encryptionIndicator: '1',
        encryptionKeyInput: '',
        encryptionInitVector: '487118c758922d50c2d4110550b68c43',
        encodedMessage: '574631311f8a71076475407e372e3d5ba7023d8f2774631e55424e07cbfbd41d3e14f61fc08c7194c1ba7d3d222f4344d91e930b02b3f3ed8959316a5db0d75344e6f68dabd1b0072725a8552aa499de90c2db24b60cb01cda10629198c1e8af4359e6874c1d'
    },
    '5': {
        blockchain: 'test',
        originatorAddress: '007a0baf6f84f0fa7402ea972686e56d50b707c9b67b108866',
        unencryptedMessage: '5746313123000000000088888889111111119999999a22222222aaaaaaab33333333bbbbbbbb0983098309830983118b118b118b118b1993199319931993219b219b219b219b29a329a329a329a331ab31ab31ab31a9b1b9b1b9b1b9b1b9c1c9c1c9c1c9c1c8',
        encryptionIndicator: '2',
        encryptionKeyInput: '32676187ba7badda85ea63a69870a7133909f1999774abb2eed251073616a6e7'
    },
    '6': {
        blockchain: 'test',
        originatorAddress: '007a0baf6f84f0fa7402ea972686e56d50b707c9b67b108866',
        unencryptedMessage: '5746313223000000000088888889111111119999999a22222222aaaaaaab33333333bbbbbbbb0983098309830983118b118b118b118b1993199319931993219b219b219b219b29a329a329a329a331ab31ab31ab31a9b1b9b1b9b1b9b1b9c1c9c1c9c1c9c1c8',
        encryptionIndicator: '2',
        encryptionKeyInput: '32676187ba7badda85ea63a69870a7133909f1999774abb2eed251073616a6e7'
    },
    '7': {
        blockchain: 'test',
        originatorAddress: '007a0baf6f84f0fa7402ea972686e56d50b707c9b67b108866',
        unencryptedMessage: '5746313223000000000088888889111111119999999a22222222aaaaaaab33333333bbbbbbbb0983098309830983118b118b118b118b1993199319931993219b219b219b219b29a329a329a329a331ab31ab31ab31a9b1b9b1b9b1b9b1b9c1c9c1c9c1c9c1c8',
        encryptionIndicator: '2',
        encryptionKeyInput: '32676187ba7badda85ea63a69870a7133909f1999774abb2eed251073616a6e7',
        encryptionInitVector: '40aa85015d24e4601448c1ba8d7bf1aa',
        encodedMessage: '574631326d7658e7d17479677a0de95076989fcd7825b709349b143f2b17644e5cb2c8ded5c7f18d77447cf9dc2115e0c1c81d717b57fadaeedf27bfef8926448ff666d3d9a65168827c94b393974ebbe6b7f0599e184bfd1ace3569117c23ae17c5640f2f2d'
    },
    '8': {
        blockchain: 'test',
        originatorAddress: '007a0baf6f84f0fa7402ea972686e56d50b707c9b67b108866',
        unencryptedMessage: '5746313123000000000088888889111111119999999a22222222aaaaaaab33333333bbbbbbbb0983098309830983118b118b118b118b1993199319931993219b219b219b219b29a329a329a329a331ab31ab31ab31a9b1b9b1b9b1b9b1b9c1c9c1c9c1c9c1c8',
        encryptionIndicator: '2',
        encryptionKeyInput: '32676187ba7badda85ea63a69870a7133909f1999774abb2eed251073616a6e7',
        encryptionInitVector: '',
        encodedMessage: '574631311f8a71076475407e372e3d5ba7023d8f2774631e55424e07cbfbd41d3e14f61fc08c7194c1ba7d3d222f4344d91e930b02b3f3ed8959316a5db0d75344e6f68dabd1b0072725a8552aa499de90c2db24b60cb01cda10629198c1e8af4359e6874c1d'
    }
};

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

// PRIVATE TEST FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}
