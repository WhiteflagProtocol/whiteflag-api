'use strict';
/**
 * @module test/protocol/codec
 * @summary Whiteflag message encoding and decoding test script
 * @description Script for testing all Whiteflag encoding and decoding functions
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
const wfCodec = require('../../lib/protocol/codec');
const { ProtocolError } = require('../../lib/_common/errors');

// Constants //
/**
 * @constant {Object} testVector
 * @description Defines the encoding and decoding test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/_static/protocol/codec.testvector.json'));

// TEST SCRIPT //
testCase('Whiteflag message encoding and decoding module', function() {
    let encodedMessage1;
    let encodedMessage2;
    let encodedMessage3;
    let encodedMessage4;
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
        // Test 4
        assertion(' 4a. should return a correctly binary encoded test message', function(done) {
            const wfMessage = testVector['4'].wfMessage;
            wfCodec.encode(wfMessage, function test4EncodeCb(err, wfMessage) {
                if (err) return done(err);
                encodedMessage4 = wfMessage.MetaHeader.encodedMessage;
                assert.strictEqual(encodedMessage4, testVector['4'].encodedMessage);
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
        // Test 4
        assertion(' 4b. should return a correctly decoded test message', function(done) {
            const wfMessage = { MetaHeader: { encodedMessage: encodedMessage4 }};
            wfCodec.decode(wfMessage, function test4DecodeCb(err, wfMessage, ivMissing) {
                if (err) return done(err);
                assert(!ivMissing);
                assert.deepStrictEqual(wfMessage.MessageHeader, testVector['4'].wfMessage.MessageHeader);
                assert.deepStrictEqual(wfMessage.MessageBody, testVector['4'].wfMessage.MessageBody);
                return done();
            });
        });
    });
    testCase('Verification of message format', function() {
        assertion(' 5. should return protocol error for invalid protocol version', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.Version = '2';
            wfCodec.verifyFormat(wfMessage, function test5VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion(' 6. should return protocol error for reserved encryption indicator', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.EncryptionIndicator = '3';
            wfCodec.verifyFormat(wfMessage, function test6VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion(' 7. should return protocol error for invalid duress indicator', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.DuressIndicator = '3';
            wfCodec.verifyFormat(wfMessage, function test7VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion(' 8. should return protocol error for not existing message code', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.MessageCode = 'Z';
            wfCodec.verifyFormat(wfMessage, function test8VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion(' 9. should return protocol error for not existing reference indicator', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.ReferenceIndicator = 'Z';
            wfCodec.verifyFormat(wfMessage, function test9VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion('10. should return protocol error for invalid referenced message transaction hash', function(done) {
            let wfMessage = testVector['1'].wfMessage;
            wfMessage.MessageHeader.ReferencedMessage = 'gz001';
            wfCodec.verifyFormat(wfMessage, function test10VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion('11. should return protocol error for invalid object code', function(done) {
            let wfMessage = testVector['2'].wfMessage;
            wfMessage.MessageHeader.MessageCode = 'P';
            wfMessage.MessageHeader.SubjectCode = '11';
            wfMessage.MessageBody.ObjectType = '99';
            wfCodec.verifyFormat(wfMessage, function test11VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
        assertion('12. should return protocol error for invalid combination of subject and object', function(done) {
            let wfMessage = testVector['2'].wfMessage;
            wfMessage.MessageHeader.MessageCode = 'S';
            wfMessage.MessageBody.SubjectCode = '10';
            wfMessage.MessageBody.ObjectType = '30';
            wfCodec.verifyFormat(wfMessage, function test12VerifyFormatCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
    });
});
