'use strict';
/**
 * @module test/datastores
 * @summary Whiteflag datastores test script
 * @description Script for testing the blockchain abstraction layer
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;

// Project modules required for test //
// const wfApiDatastores = require('../../lib/datastores');

// Set logger to log only fatal conditions //
const log = require('../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //

// TEST SCRIPT //
testCase('Whiteflag API datastores module', function() {
    assertion(' ... should correctly load the general datastores module', function(done) {
        const wfApiDatastores = require('../lib/datastores');
        ignore(wfApiDatastores);
        done();
    });
});

/*
 * No specific datastore functions are currently unit tested here.
 * Datastore functions are assumed to be online end-to-end tested
 */

// PRIVATE TEST FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}

