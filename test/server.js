'use strict';
/**
 * @module test/server
 * @summary Whiteflag server test script
 * @description Script for testing the server functions
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;

// Project modules required for test //
// const wfApiServer = require('../lib/server');

// Set logger to log only fatal conditions //
const log = require('../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //

// TEST SCRIPT //
testCase('Whiteflag API server module', function() {
    assertion(' 0. should correctly load', function(done) {
        const wfApiServer = require('../lib/server');
        ignore(wfApiServer);
        done();
    });
});

/*
 * No server functions are currently unit tested here.
 * Server functions are assumed to be online end-to-end tested
 */

// PRIVATE TEST FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}

