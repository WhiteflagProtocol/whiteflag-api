'use strict';
/**
 * @module test/common/arrays
 * @summary Common array functions test script
 * @description Script for testing all common array functions
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');

// Project modules required for test //
const array = require('../../lib/common/arrays');

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
        orgArray: [ '1', '2' ],
        item: '3',
        newArray: [ '1', '2', '3' ]
    },
    '2': {
        orgArray: null,
        item: '3',
        newArray: [ '3' ]
    },
    '3': {
        orgArray: [ '1', '2' ],
        item: { name: 'object' },
        newArray: [ '1', '2', { name: 'object' } ]
    },
    '4': {
        array1: [ '1', '2' ],
        array2: [ '3', '4' ],
        newArray: [ '1', '2', '3', '4' ]
    },
    '5': {
        array1: null,
        array2: [ '3', '4' ],
        newArray: [ '3', '4' ]
    },
    '6': {
        array1: [ '1', '2' ],
        array2: null,
        newArray: [ '1', '2' ]
    },
    '7': {
        array1: null,
        array2: null,
        newArray: []
    },
    '8': {
        array: [
            {
                name: 'A',
                something: 'foo'
            },
            {
                name: 'B',
                something: 'bar'
            }
        ],
        property: 'name',
        newArray: [ 'A', 'B' ]
    },
    '9': {
        array: [
            {
                name: {
                    main: 'A',
                    second: '1'
                },
                something: 'foo'
            },
            {
                name: {
                    main: 'B',
                    second: '2'
                },
                something: 'bar'
            }
        ],
        property: 'name',
        subname: 'second',
        newArray: [ '1', '2' ]
    }
};

// TEST SCRIPT //
testCase('Common array module', function() {
    testCase('Adding items to array', function() {
        assertion(' 1. should correctly add a string item to array', function(done) {
            let newArray = array.addItem(testVector['1'].orgArray, testVector['1'].item);
            assert.deepStrictEqual(newArray, testVector['1'].newArray);
            return done();
        });
        assertion(' 2. should return item in new array when adding item to null', function(done) {
            let newArray = array.addItem(testVector['2'].orgArray, testVector['2'].item);
            assert.deepStrictEqual(newArray, testVector['2'].newArray);
            return done();
        });
        assertion(' 3. should correctly add an object item to array', function(done) {
            let newArray = array.addItem(testVector['3'].orgArray, testVector['3'].item);
            assert.deepStrictEqual(newArray, testVector['3'].newArray);
            return done();
        });
    });
    testCase('Adding array to array', function() {
        assertion(' 4. should correctly add an array to an array', function(done) {
            let newArray = array.addArray(testVector['4'].array1, testVector['4'].array2);
            assert.deepStrictEqual(newArray, testVector['4'].newArray);
            return done();
        });
        assertion(' 5. should return the second array if the first is not an array', function(done) {
            let newArray = array.addArray(testVector['5'].array1, testVector['5'].array2);
            assert.deepStrictEqual(newArray, testVector['5'].newArray);
            return done();
        });
        assertion(' 6. should return the first array if the second is not an array', function(done) {
            let newArray = array.addArray(testVector['6'].array1, testVector['6'].array2);
            assert.deepStrictEqual(newArray, testVector['6'].newArray);
            return done();
        });
        assertion(' 7. should return empty array if combining to non-arrays', function(done) {
            let newArray = array.addArray(testVector['7'].array1, testVector['7'].array2);
            assert.deepStrictEqual(newArray, testVector['7'].newArray);
            return done();
        });
    });
    testCase('Pluck array of objects', function() {
        assertion(' 8. should return new array with the requested property values', function(done) {
            let newArray = array.pluck(testVector['8'].array, testVector['8'].property);
            assert.deepStrictEqual(newArray, testVector['8'].newArray);
            return done();
        });
        assertion(' 9. should return new array with the requested subproperty values', function(done) {
            let newArray = array.plucksub(testVector['9'].array, testVector['9'].property, testVector['9'].subname);
            assert.deepStrictEqual(newArray, testVector['9'].newArray);
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

