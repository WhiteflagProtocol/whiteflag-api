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
const fs = require('fs');

// Whiteflag common functions and classes //
const { ignore } = require('../../lib/_common/processing');
const log = require('../../lib/_common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
const object = require('../../lib/_common/objects');

// Constants //
/**
 * @constant {Object} testVector
 * @description Defines the common object functions test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/static/common/objects.testvector.json'));

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
