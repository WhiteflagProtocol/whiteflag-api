'use strict';
/**
 * @module test/datastores
 * @summary Whiteflag datastores test script
 * @description Script for testing the blockchain abstraction layer
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;

// Whiteflag common functions and classes //
const { ignore } = require('../lib/_common/processing');
const log = require('../lib/_common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
// const wfApiDatastores = require('../../lib/datastores');

// TEST SCRIPT //
testCase('Whiteflag API datastores module', function() {
    assertion(' 0. should correctly load', function(done) {
        const wfApiDatastores = require('../lib/datastores');
        ignore(wfApiDatastores);
        done();
    });
});

/*
 * No specific datastore functions are currently unit tested here.
 * Datastore functions are assumed to be online end-to-end tested
 */
