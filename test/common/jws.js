'use strict';
/**
 * @module test/common/jws
 * @summary Common JSON web signature test script
 * @description Script for testing all common JWS functions
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');
const fs = require('fs');

// Whiteflag common functions and classes //
const { ignore } = require('../../lib/common/processing');
const log = require('../../lib/common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
const jws = require('../../lib/common/jws');

// Constants //
/**
 * @constant {Object} testVector
 * @description Defines the common array functions test data
 */
const testVector = JSON.parse(fs.readFileSync('./test/static/common/jws.testvector.json'));

// TEST SCRIPT //
testCase('Common JWS module', function() {
    testCase('JSON Base64URL encoding', function() {
        assertion(' 1. should correctly convert random object to base64URL and back', function(done) {
            const obj1 = { prop1: 'string', prop2: { key: 'value'}, prop3: [ "one", "two"] };
            const str = jws.toBase64u(obj1);
            const obj2 = jws.toObject(str);
            assert.deepStrictEqual(obj1, obj2);
            return done();
        });
        assertion(' 2. should correctly convert RFC 7515 Annex A.1.2 header example to base64URL', function(done) {
            const obj = testVector['0'].full.protected;
            const encoded = testVector['0'].compact;
            assert.deepStrictEqual(jws.toBase64u(obj), encoded);
            return done();
        });
    });
    testCase('JWS encoding and conversions i.a.w. RFC 7515 Annex A.1.1 example', function() {
        assertion(' 3. should correctly transform flattened JWS to compact JWS', function(done) {
            const flatJWS = testVector['1'].flat;
            const compactJWS = testVector['1'].compact;
            assert.deepStrictEqual(jws.toCompact(flatJWS), compactJWS);
            return done();
        });
        assertion(' 4. should correctly transform full JWS to compact JWS', function(done) {
            // TODO: the RFC has spaces in the example JSON, so the test fails
            const fullJWS = testVector['1'].full;
            const compactJWS = testVector['1'].compact;
            assert.deepStrictEqual(jws.toCompact(fullJWS), compactJWS);
            return done();
        });
        assertion(' 5. should correctly transform compact JWS to flattened JWS', function(done) {
            const compactJWS = testVector['1'].compact;
            const flatJWS = testVector['1'].flat;
            assert.deepStrictEqual(jws.toFlattened(compactJWS), flatJWS);
            return done();
        });
        assertion(' 6. should correctly transform full JWS to flattened JWS', function(done) {
            // TODO: the RFC has spaces in the example JSON, so the test fails
            const fullJWS = testVector['1'].full;
            const flatJWS = testVector['1'].flat;
            assert.deepStrictEqual(jws.toFlattened(fullJWS), flatJWS);
            return done();
        });
        assertion(' 7. should correctly transform compact JWS to full JWS', function(done) {
            const compactJWS = testVector['1'].compact;
            const fullJWS = testVector['1'].full;
            assert.deepStrictEqual(jws.toFull(compactJWS), fullJWS);
            return done();
        });
        assertion(' 8. should correctly transform flattened JWS to full JWS', function(done) {
            const flatJWS = testVector['1'].flat;
            const fullJWS = testVector['1'].full;
            assert.deepStrictEqual(jws.toFull(flatJWS), fullJWS);
            return done();
        });
    });   
    testCase('JWS encoding and conversions i.a.w. Whiteflag Standard Annex C example', function() {
        assertion(' 9. should correctly transform flattened JWS to compact JWS', function(done) {
            const flatJWS = testVector['2'].flat;
            const compactJWS = testVector['2'].compact;
            assert.deepStrictEqual(jws.toCompact(flatJWS), compactJWS);
            return done();
        });
        assertion('10. should correctly transform full JWS to compact JWS', function(done) {
            const fullJWS = testVector['2'].full;
            const compactJWS = testVector['2'].compact;
            assert.deepStrictEqual(jws.toCompact(fullJWS), compactJWS);
            return done();
        });
        assertion('11. should correctly transform compact JWS to flattened JWS', function(done) {
            const compactJWS = testVector['2'].compact;
            const flatJWS = testVector['2'].flat;
            assert.deepStrictEqual(jws.toFlattened(compactJWS), flatJWS);
            return done();
        });
        assertion('12. should correctly transform full JWS to flattened JWS', function(done) {
            const fullJWS = testVector['2'].full;
            const flatJWS = testVector['2'].flat;
            assert.deepStrictEqual(jws.toFlattened(fullJWS), flatJWS);
            return done();
        });
        assertion('13. should correctly transform compact JWS to full JWS', function(done) {
            const compactJWS = testVector['2'].compact;
            const fullJWS = testVector['2'].full;
            assert.deepStrictEqual(jws.toFull(compactJWS), fullJWS);
            return done();
        });
        assertion('14. should correctly transform flattened JWS to full JWS', function(done) {
            const flatJWS = testVector['2'].flat;
            const fullJWS = testVector['2'].full;
            assert.deepStrictEqual(jws.toFull(flatJWS), fullJWS);
            return done();
        });
    });    
});
