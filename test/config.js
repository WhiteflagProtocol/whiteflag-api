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

// Common internal functions and classes //
const { ignore } = require('../lib/_common/processing');
const log = require('../lib/_common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
const wfApiConfig = require('../lib/config');

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
