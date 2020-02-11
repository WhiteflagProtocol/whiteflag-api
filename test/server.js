'use strict';
/**
 * @module test/server
 * @summary Whiteflag server test script
 * @description Script for testing the server functions
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');

// Project modules required for test //
const wfApiServer = require('../lib/server');

// Set logger to log only fatal conditions //
const log = require('../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //

// TEST SCRIPT //
testCase('Whiteflag API server module', function() {
    testCase('Starting and stopping the server', function() {
        assertion(' 1. should succesfully start the server', function(done) {
            wfApiServer.start(function test1StartServerCb(err, url) {
                if (err) return done(err);
                assert(url);
                return done();
            });
        });
        assertion(' 2. should succesfully create server endpoints', function(done) {
            wfApiServer.createEndpoints(function dummy() {}, function test2EndpointsCb(err) {
                if (err) return done(err);
                return done();
            });
        });
        assertion(' 3. should succesfully stop the server', function(done) {
            wfApiServer.stop(function test3StopServerCb(err) {
                if (err) return done(err);
                return done();
            });
        });
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

