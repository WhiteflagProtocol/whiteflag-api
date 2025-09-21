'use strict';
/**
 * @module test/common/encoding
 * @summary Common JSON web signature test script
 * @description Script for testing all common JWS functions
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
const data = require('../../lib/_common/encoding');

// Constants //
/**
 * @constant {Object} testVector
 * @description Defines the common array functions test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/_static/common/encoding.testvector.json'));

// TEST SCRIPT //
testCase('Common encoding module', function() {
    testCase('Standard string encoding', function() {
        assertion(' 1. should correctly transform to buffer', function(done) {
            const buffer = data.stringToBuffer(testVector.utf8.string);
            const string = data.bufferToString(buffer);
            assert.deepStrictEqual(string, testVector.utf8.string);
            return done();
        });
        assertion(' 2. should correctly encode to base4url string', function(done) {
            const base64url = data.stringToBase64u(testVector.utf8.string);
            assert.deepStrictEqual(base64url, testVector.base64url.string);
            return done();
        });
        assertion(' 3. should correctly encode to hexadecimal string', function(done) {
            const hexString = data.stringToHex(testVector.utf8.string);
            assert.deepStrictEqual(hexString, testVector.hex.string);
            return done();
        });
    });
    testCase('Base64URL encoding', function() {
        assertion(' 4. should correctly transform to buffer', function(done) {
            const buffer = data.base64uToBuffer(testVector.base64url.string);
            const base64url = data.bufferToBase64u(buffer);
            assert.deepStrictEqual(base64url, testVector.base64url.string);
            return done();
        });
        assertion(' 5. should correctly encode to standard string', function(done) {
            const utf8 = data.base64uToString(testVector.base64url.string);
            assert.deepStrictEqual(utf8, testVector.utf8.string);
            return done();
        });
        assertion(' 6. should correctly encode to hexadecimal string', function(done) {
            const hexString = data.base64uToHex(testVector.base64url.string);
            assert.deepStrictEqual(hexString, testVector.hex.string);
            return done();
        });
    });   
    testCase('Hexadecimal encoding', function() {
        assertion(' 7. should correctly transform to buffer', function(done) {
            const buffer = data.hexToBuffer(testVector.hex.string);
            const hex = data.bufferToHex(buffer);
            assert.deepStrictEqual(hex, testVector.hex.string);
            return done();
        });
        assertion(' 8. should correctly encode to standard string', function(done) {
            const utf8 = data.hexToString(testVector.hex.string);
            assert.deepStrictEqual(utf8, testVector.utf8.string);
            return done();
        });
        assertion(' 9. should correctly encode to base4url string', function(done) {
            const base64url = data.hexToBase64u(testVector.hex.string);
            assert.deepStrictEqual(base64url, testVector.base64url.string);
            return done();
        });
    });    
});
