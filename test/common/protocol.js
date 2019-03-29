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

// Project modules required for test //
const { type } = require('../../lib/common/protocol');

// Set logger to log only fatal conditions //
const log = require('../../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //
/**
 * @constant {object} testVector
 * @description Defines the cryptographic test data
 */
const testVector = {
    '1': {
        type: 'NULL'
    },
    '2': {
        message: {
            property: null
        },
        type: 'INVALID'
    },
    '3': {
        message: {
            MessageHeader: {
                property: null
            }
        },
        type: 'unknown'
    },
    '4': {
        message: {
            MessageHeader: {
                MessageCode: 'I'
            }
        },
        type: 'I'
    },
    '5': {
        message: {
            MessageHeader: {
                MessageCode: 'S',
                ReferenceIndicator: '1'
            }
        },
        type: 'S(1)'
    },
    '6': {
        message: {
            MessageHeader: {
                MessageCode: 'P',
                ReferenceIndicator: '6'
            },
            MessageBody: {
                SubjectCode: '10'
            }
        },
        type: 'P10(6)'
    },
    '7': {
        message: {
            MessageHeader: {
                MessageCode: 'K',
                ReferenceIndicator: '3'
            },
            MessageBody: {
                CryptoDataType: '11'
            }
        },
        type: 'K11(3)'
    },
    '8': {
        message: {
            MessageHeader: {
                MessageCode: 'A',
                ReferenceIndicator: '0'
            },
            MessageBody: {
                VerificationMethod: '2'
            }
        },
        type: 'A2(0)'
    },
    '9': {
        message: {
            MessageHeader: {
                MessageCode: 'R',
                ReferenceIndicator: '3'
            },
            MessageBody: {
                SubjectCode: '1'
            }
        },
        type: 'R1(3)'
    }
};

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

// PRIVATE TEST FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}

