'use strict';
/**
 * @module test/common/objects
 * @summary Common object functions test script
 * @description Script for testing common object functions
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');

// Project modules required for test //
const object = require('../../lib/common/objects');

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
        sourceObject: {
            prop1: {
                subprop22: 'X'
            },
            prop2: [
                's21',
                's22'
            ],
            prop3: 'Z',
            prop4: {
                subprop41: 'Y'
            }
        },
        targetObject: {
            prop1: {
                subprop12: 'A',
                subprop22: 'B'
            },
            prop2: [
                't21',
                't22'
            ]
        },
        newObject: {
            prop1: {
                subprop12: 'A',
                subprop22: 'X'
            },
            prop2: [
                't21',
                't22',
                's21',
                's22'
            ],
            prop3: 'Z',
            prop4: {
                subprop41: 'Y'
            }
        }
    }
};

// TEST SCRIPT //
testCase('Common objects module', function() {
    testCase('Updating object with other object', function() {
        assertion(' 1. should correctly merge source object into target object', function(done) {
            object.update(testVector['1'].sourceObject, testVector['1'].targetObject, true);
            assert.deepStrictEqual(testVector['1'].targetObject, testVector['1'].newObject);
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

