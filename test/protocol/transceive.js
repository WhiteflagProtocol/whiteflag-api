'use strict';
/**
 * @module test/protocol/transceive
 * @summary Whiteflag message transmit and reveive test script
 * @description Script for testing Whiteflag message receive (rx) event chain
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
const wfTransmit = require('../../lib/protocol/transmit');
const wfReceive = require('../../lib/protocol/receive');
const wfRxEvent = require('../../lib/protocol/events').rxEvent;
const wfTxEvent = require('../../lib/protocol/events').txEvent;
const { ProcessingError,
        ProtocolError } = require('../../lib/_common/errors');

/* Constants */
/**
 * @constant {Object} testVector
 * @description Defines the encoding and decoding test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/_static/protocol/transceive.testvector.json'));

/* TEST SCRIPT */
testCase('Whiteflag message transceive modules', function() {
    testCase('Initialisation of tx and rx event chains', function() {
        // Test 1
        assertion(' 1. should initialise rx events without errors', function(done) {
            wfReceive.init(function test1InitReceiveCb() {
                return done();
            });
        });
        // Test 2
        assertion(' 2. should initialise tx events without errors', function(done) {
            wfTransmit.init(function test2InitTransmitCb() {
                return done();
            });
        });
    });
    testCase('Processing of incoming messages', function() {
        // Test 3
        assertion(' 3. should pass the full rx chain without errors', function(done) {
            wfRxEvent.emit('messageReceived', testVector['3'].wfMessageEncoded, function test3ReceiveCb(err, wfMessage) {
                if (err) return done(err);
                assert.strictEqual(wfMessage.MetaHeader.transceiveDirection, 'RX');
                assert.deepStrictEqual(wfMessage.MessageHeader, testVector['3'].wfMessageUnecoded.MessageHeader);
                assert.deepStrictEqual(wfMessage.MessageBody, testVector['3'].wfMessageUnecoded.MessageBody);
                return done();
            });
        });
        // Test 4
        assertion(' 4. should return protocol error if incorrect metaheader', function(done) {
            wfRxEvent.emit('messageReceived', testVector['4'].wfMessageEncoded, function test4ReceiveCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_METAHEADER_ERROR');
                return done();
            });
        });
        // Test 5
        assertion(' 5. should return protocol error if invalid message format', function(done) {
            wfRxEvent.emit('messageReceived', testVector['5'].wfMessageEncoded, function test5ReceiveCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
    });
    testCase('Processing of outgoing messages', function() {
        // Test 6
        assertion(' 6. should pass the tx chain without errors until message is passed to blockchain', function(done) {
            wfTxEvent.emit('messageCommitted', testVector['6'].wfMessageUnecoded, function test6TransmitCb(err, wfMessage) {
                if (err && !(err instanceof ProcessingError)) return done(err);
                if (err) assert.strictEqual(err.code, 'WF_API_NOT_IMPLEMENTED');
                assert.strictEqual(wfMessage.MetaHeader.transceiveDirection, 'TX');
                assert.strictEqual(wfMessage.MetaHeader.encodedMessage, testVector['6'].wfMessageEncoded.MetaHeader.encodedMessage);
                return done();
            });
        });
        // Test 7
        assertion(' 7. should prevent a message other than a test message to be sent to the blockchain', function(done) {
            wfTxEvent.emit('messageCommitted', testVector['7'].wfMessageUnecoded, function test7TransmitCb(err, wfMessage) {
                if (err && !(err instanceof ProcessingError)) return done(err);
                if (err) assert.strictEqual(err.code, 'WF_API_NOT_ALLOWED');
                assert.strictEqual(wfMessage.MetaHeader.transceiveDirection, 'TX');
                assert.strictEqual(wfMessage.MetaHeader.encodedMessage, testVector['7'].wfMessageEncoded.MetaHeader.encodedMessage);
                return done();
            });
        });
        // Test 8
        assertion(' 8. should return protocol error if incorrect metaheader', function(done) {
            wfTxEvent.emit('messageCommitted', testVector['8'].wfMessageUnecoded, function test8TransmitCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_METAHEADER_ERROR');
                return done();
            });
        });
        // Test 9
        assertion(' 9. should return protocol error if invalid message format', function(done) {
            wfTxEvent.emit('messageCommitted', testVector['9'].wfMessageUnecoded, function test9TransmitCb(err, wfMessage) {
                ignore(wfMessage);
                assert(err);
                if (!(err instanceof ProtocolError)) return done(err);
                assert.strictEqual(err.code, 'WF_FORMAT_ERROR');
                return done();
            });
        });
    });
});
