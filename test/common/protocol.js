'use strict';
/**
 * @module test/common/protocol
 * @summary Common array functions test script
 * @description Script for testing common protocol functions
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
const { type } = require('../../lib/_common/protocol');

// Constants //
/**
 * @constant {Object} testVector
 * @description Defines the common protocol functions test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/_static/common/protocol.testvector.json'));

// TEST SCRIPT //
testCase('Common protocol module', function() {
    testCase('Determining message types', function() {
        assertion(' 1. should return "NULL" if no message', function(done) {
            let messageType = type(testVector['1'].message);
            assert.strictEqual(messageType, testVector['1'].type);
            return done();
        });
        assertion(' 2. should return "INVALID" if no message header', function(done) {
            let messageType = type(testVector['1'].message);
            assert.strictEqual(messageType, testVector['1'].type);
            return done();
        });
        assertion(' 3. should return "unknown" if no message type', function(done) {
            let messageType = type(testVector['1'].message);
            assert.strictEqual(messageType, testVector['1'].type);
            return done();
        });
        assertion(' 4. should return message type without reference indicator', function(done) {
            let messageType = type(testVector['4'].message);
            assert.strictEqual(messageType, testVector['4'].type);
            return done();
        });
        assertion(' 5. should return message type without subtype', function(done) {
            let messageType = type(testVector['5'].message);
            assert.strictEqual(messageType, testVector['5'].type);
            return done();
        });
        assertion(' 6. should return correct sign/signal message type', function(done) {
            let messageType = type(testVector['6'].message);
            assert.strictEqual(messageType, testVector['6'].type);
            return done();
        });
        assertion(' 7. should return correct crypto message type', function(done) {
            let messageType = type(testVector['7'].message);
            assert.strictEqual(messageType, testVector['7'].type);
            return done();
        });
        assertion(' 8. should return correct authentication message type without subtype', function(done) {
            let messageType = type(testVector['8'].message);
            assert.strictEqual(messageType, testVector['8'].type);
            return done();
        });
        assertion(' 9. should return correct resource message type', function(done) {
            let messageType = type(testVector['9'].message);
            assert.strictEqual(messageType, testVector['9'].type);
            return done();
        });
    });
});
