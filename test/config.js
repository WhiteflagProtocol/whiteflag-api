'use strict';
/**
 * @module test/config
 * @summary Whiteflag config test script
 * @description Script for testing Whiteflag API configuration loader
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');

// Project modules required for test //
const wfApiConfig = require('../lib/config');

// Set logger to log only fatal conditions //
const log = require('../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //

// TEST SCRIPT //
testCase('Whiteflag API configuration module', function() {
    testCase('Loading configuration', function() {
        assertion(' 1. should return the configuration object', function(done) {
            wfApiConfig.getConfig(function test1ConfigCb(err, apiConfig) {
                if (err) done(err);
                assert(apiConfig);
                done();
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

