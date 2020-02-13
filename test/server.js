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
const fs = require('fs');

// Project modules required for test //
const wfApiServer = require('../lib/server');

// Set logger to log only fatal conditions //
const log = require('../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //
const OPENAPIFILE = './static/openapi.json';

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
    testCase('Consistency with the OpenAPI definition', function() {
        // Server endpoints data
        const PATH = 0;
        const endpoints = wfApiServer.test.getEndpoints();

        // OpenAPI definition data
        const openapi = JSON.parse(fs.readFileSync(OPENAPIFILE));
        let paths = Object.keys(openapi.paths).map(path => {
            return path.replace(/{/g, ':').replace(/}/g, '');
        });
        // Compare server endpoints with OpenAPI defintion
        assertion(' 4. all server endpoints must be in the OpenAPI definition', function(done) {
            let undefinedEnpoints = [];
            endpoints.forEach(endpoint => {
                if (paths.indexOf(endpoint[PATH]) === -1) {
                    undefinedEnpoints.push(endpoint[PATH]);
                }
            });
            if (undefinedEnpoints.length > 0) {
                return done(new Error(`Endpoints not in OpenAPI defintion: ${JSON.stringify(undefinedEnpoints)}`));
            }
            return done();
        });
    });
});

/*
 * No server operations are currently tested here.
 * Server functions are assumed to be online end-to-end tested
 */

// PRIVATE TEST FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}
