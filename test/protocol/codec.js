'use strict';
/**
 * @module test/protocol/codec
 * @summary Whiteflag message encoding and decoding test script
 * @description Script for testing all Whiteflag encoding and decoding functions
 * @todo test full message set covering all functionalities
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');

// Project modules required for test //
const wfCodec = require('../../lib/protocol/codec');
const { ProtocolError } = require('../../lib/common/errors');

// Set logger to log only fatal conditions //
const log = require('../../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //
/**
 * @constant {object} testVector
 * @description Defines the encoding and decoding test data
 */
const testVector = {
    '1': {
        encodedMessage: '5746313020800000000000000000000000000000000000000000000000000000000000000000b43a3a38399d1797b7b933b0b734b9b0ba34b7b71734b73a17bbb434ba32b33630b380',
        concatinatedMessage: 'WF110A000000000000000000000000000000000000000000000000000000000000000001https://organisation.int/whiteflag',
        wfMessage: {
            'MetaHeader': {
                'test': true,
                'originatorAddress': '1C8KSK68SJjfDSBx9BpSx3qB3bePf23r77'
            },
            'MessageHeader': {
                'Prefix': 'WF',
                'Version': '1',
                'EncryptionIndicator': '0',
                'DuressIndicator': '0',
                'MessageCode': 'A',
                'ReferenceIndicator': '0',
                'ReferencedMessage': '0000000000000000000000000000000000000000000000000000000000000000'
            },
            'MessageBody': {
                'VerificationMethod': '1',
                'VerificationData': 'https://organisation.int/whiteflag'
            }
        }
    },
    '2': {
        encodedMessage: '57463130a6a1f7da7067d41891592131a12a60c9053b4eb0aefe6263385da9f5b789421e1d7401009841882148a800000114c1e596006f04c050eca6420084',
        concatinatedMessage: 'WF101M43efb4e0cfa83122b242634254c1920a769d615dfcc4c670bb53eb6f12843c3ae802013-08-31T04:29:15ZP00D00H00M22+30.79658-037.8260287653210042',
        wfMessage: {
            'MetaHeader': {
                'test': true,
                'originatorAddress': '1C8KSK68SJjfDSBx9BpSx3qB3bePf23r77'
            },
            'MessageHeader': {
                'Prefix': 'WF',
                'Version': '1',
                'EncryptionIndicator': '0',
                'DuressIndicator': '1',
                'MessageCode': 'M',
                'ReferenceIndicator': '4',
                'ReferencedMessage': '3efb4e0cfa83122b242634254c1920a769d615dfcc4c670bb53eb6f12843c3ae'
            },
            'MessageBody': {
                'SubjectCode': '80',
                'DateTime': '2013-08-31T04:29:15Z',
                'Duration': 'P00D00H00M',
                'ObjectType': '22',
                'ObjectLatitude': '+30.79658',
                'ObjectLongitude': '-037.82602',
                'ObjectSizeDim1': '8765',
                'ObjectSizeDim2': '3210',
                'ObjectOrientation': '042'
            }
        }
    },
    '3': {
        encodedMessage: '57463130232fb60f0f6c4a8589bddcf076e790ac9eb1601d3fd9ced67eaaa62c9fb9644a16fabb434ba32b33630b3903a32b9ba1036b2b9b9b0b3b2908',
        concatinatedMessage: 'WF100F5f6c1e1ed8950b137bb9e0edcf21593d62c03a7fb39dacfd554c593f72c8942dfWhiteflag test message!',
        wfMessage: {
            'MetaHeader': {
                'test': true,
                'originatorAddress': '1C8KSK68SJjfDSBx9BpSx3qB3bePf23r77'
            },
            'MessageHeader': {
                'Prefix': 'WF',
                'Version': '1',
                'EncryptionIndicator': '0',
                'DuressIndicator': '0',
                'MessageCode': 'F',
                'ReferenceIndicator': '5',
                'ReferencedMessage': 'f6c1e1ed8950b137bb9e0edcf21593d62c03a7fb39dacfd554c593f72c8942df'
            },
            'MessageBody': {
                'Text': 'Whiteflag test message!'
            }
        }
    }
};

// TEST SCRIPT //
testCase('Whiteflag message encoding and decoding module', function() {
    let encodedMessage1;
    let encodedMessage2;
    let encodedMessage3;
    testCase('Encoding of unencrypted messages', function() {
        // Test 1
        assertion(' 1a. should return a correctly binary encoded authentication message', function(done) {
            const wfMessage = testVector['1'].wfMessage;
            wfCodec.encode(wfMessage, function test1EncodeCb(err, wfMessage) {
                if (err) return done(err);
                encodedMessage1 = wfMessage.MetaHeader.encodedMessage;
                assert.strictEqual(encodedMessage1, testVector['1'].encodedMessage);
                return done();
            });
        });
        // Test 2
        assertion(' 2a. should return a correctly binary encoded sign/signal message', function(done) {
            const wfMessage = testVector['2'].wfMessage;
            wfCodec.encode(wfMessage, function test2EncodeCb(err, wfMessage) {
                if (err) return done(err);
                encodedMessage2 = wfMessage.MetaHeader.encodedMessage;
                assert.strictEqual(encodedMessage2, testVector['2'].encodedMessage);
                return done();
            });
        });
        // Test 3
        assertion(' 3a. should return a correctly binary encoded free text message', function(done) {
            const wfMessage = testVector['3'].wfMessage;
            wfCodec.encode(wfMessage, function test3EncodeCb(err, wfMessage) {
                if (err) return done(err);
                encodedMessage3 = wfMessage.MetaHeader.encodedMessage;
                assert.strictEqual(encodedMessage3, testVector['3'].encodedMessage);
                return done();
            });
        });
    });
    testCase('Decoding of unencrypted messages', function() {
        // Test 1
        assertion(' 1b. should return a correctly decoded authentication message', function(done) {
            const wfMessage = { MetaHeader: { encodedMessage: encodedMessage1 }};
            wfCodec.decode(wfMessage, function test1DecodeCb(err, wfMessage, ivMissing) {
                if (err) return done(err);
                assert(!ivMissing);
                assert.deepStrictEqual(wfMessage.MessageHeader, testVector['1'].wfMessage.MessageHeader);
                assert.deepStrictEqual(wfMessage.MessageBody, testVector['1'].wfMessage.MessageBody);
                return done();
            });
        });
        // Test 2
        assertion(' 2b. should return a correctly decoded sign/signal message', function(done) {
            const wfMessage = { MetaHeader: { encodedMessage: encodedMessage2 }};
            wfCodec.decode(wfMessage, function test2DecodeCb(err, wfMessage, ivMissing) {
                if (err) return done(err);
                assert(!ivMissing);
                assert.deepStrictEqual(wfMessage.MessageHeader, testVector['2'].wfMessage.MessageHeader);
                assert.deepStrictEqual(wfMessage.MessageBody, testVector['2'].wfMessage.MessageBody);
                return done();
            });
        });
        // Test 3
        assertion(' 3b. should return a correctly decoded free text message', function(done) {
            const wfMessage = { MetaHeader: { encodedMessage: encodedMessage3 }};
            wfCodec.decode(wfMessage, function test3DecodeCb(err, wfMessage, ivMissing) {
                if (err) return done(err);
                assert(!ivMissing);
                assert.deepStrictEqual(wfMessage.MessageHeader, testVector['3'].wfMessage.MessageHeader);
                assert.deepStrictEqual(wfMessage.MessageBody, testVector['3'].wfMessage.MessageBody);
                return done();
            });
        });
    });
    testCase('Verification of message format', function() {
        assertion(' 4. should return protocol error for invalid protocol version', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.Version = '2';
            wfCodec.verifyFormat(wfMessage, function test4VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion(' 5. should return protocol error for reserved encryption indicator', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.EncryptionIndicator = '3';
            wfCodec.verifyFormat(wfMessage, function test5VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion(' 6. should return protocol error for invalid duress indicator', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.DuressIndicator = '3';
            wfCodec.verifyFormat(wfMessage, function test6VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion(' 7. should return protocol error for not existing message code', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.MessageCode = 'Z';
            wfCodec.verifyFormat(wfMessage, function test7VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion(' 8. should return protocol error for not existing reference indicator', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.ReferenceIndicator = 'Z';
            wfCodec.verifyFormat(wfMessage, function test8VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion(' 9. should return protocol error for invalid referenced message transaction hash', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.ReferencedMessage = 'gz001';
            wfCodec.verifyFormat(wfMessage, function test9VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
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
