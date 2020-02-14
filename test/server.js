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
        const METHOD = 1;
        const OPERATIONID = 2;
        const endpoints = wfApiServer.test.getEndpoints();

        // OpenAPI definition data
        const openapi = JSON.parse(fs.readFileSync(OPENAPIFILE)).paths;
        const openapiPaths = Object.keys(openapi);

        // Compare server endpoints with OpenAPI defintion
        assertion(' 4. all server endpoints should be in the OpenAPI definition', function(done) {
            let undefinedEnpoints = [];
            let paths = openapiPaths.map(path => {
                return path.replace(/{/g, ':').replace(/}/g, '');
            });
            endpoints.forEach(endpoint => {
                if (paths.indexOf(endpoint[PATH]) === -1) {
                    undefinedEnpoints.push(`${endpoint[OPERATIONID]}: ${endpoint[METHOD].toUpperCase()} ${endpoint[PATH]}`);
                }
            });
            if (undefinedEnpoints.length > 0) {
                return done(new Error(`Endpoints not in OpenAPI defintion (${undefinedEnpoints.length}): ${JSON.stringify(undefinedEnpoints)}`));
            }
            return done();
        });
        assertion(' 5. all OpenAPI defined methods and operations should be implemented', function(done) {
            let unimplementedMethods = [];

            // Get path from openapi defintion
            openapiPaths.forEach(path => {
                // Get methods for this path from openapi
                const openapiMethods = Object.keys(openapi[path]);
                openapiMethods.forEach(method => {
                    // OpenAPI defintion data for this endpoint
                    const openapiEndpoint = [ path.replace(/{/g, ':').replace(/}/g, ''), method.toUpperCase(), openapi[path][method].operationId ];

                    // Count how many times this endpoint is implemented
                    let n = 0;
                    endpoints.forEach(endpoint => {
                        if (endpoint.slice(0, 3)[0] === openapiEndpoint[0] &&
                            endpoint.slice(0, 3)[1] === openapiEndpoint[1] &&
                            endpoint.slice(0, 3)[2] === openapiEndpoint[2]) n += 1;
                    });
                    // The endppoint and operation should only occur once
                    if (n !== 1) unimplementedMethods.push(`${openapi[path][method].operationId}: ${method.toUpperCase()} ${path}`);
                });
            });
            if (unimplementedMethods.length > 1) {
                return done(new Error(`Not implemented endpoints in OpenAPI defintion (${unimplementedMethods.length}): ${JSON.stringify(unimplementedMethods)}`));
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
