'use strict';
/**
 * @module test/datastores
 * @summary Whiteflag datastores test script
 * @description Script for testing the blockchain abstraction layer
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;

// Common internal functions and classes //
const { ignore } = require('../lib/_common/processing');
const log = require('../lib/_common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
// const wfDatastores = require('../../lib/datastores');

// TEST SCRIPT //
testCase('Whiteflag API datastores module', function() {
    assertion(' 0. should correctly load', function(done) {
        const wfDatastores = require('../lib/datastores');
        ignore(wfDatastores);
        done();
    });
});

/*
 * No specific datastore functions are currently unit tested here.
 * Datastore functions are assumed to be online end-to-end tested
 */
