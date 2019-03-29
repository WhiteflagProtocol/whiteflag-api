'use strict';
/**
 * @module test/blockchains
 * @summary Whiteflag blockchains test script
 * @description Script for testing the blockchain abstraction layer
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;

// Project modules required for test //
// const wfApiBlockchains = require('../../lib/blockchains');

// Set logger to log only fatal conditions //
const log = require('../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //

// TEST SCRIPT //
testCase('Whiteflag API blockchains module', function() {
    assertion(' ... should correctly load the general blockchains module', function(done) {
        const wfApiBlockchains = require('../lib/blockchains');
        ignore(wfApiBlockchains);
        done();
    });
});

/*
 * No specific blockchain functions are currently unit tested here.
 * Blockchain functions are assumed to be online end-to-end tested
 */

// PRIVATE TEST FUNCTIONS //
/**
 * Ignores its arguments
 * @private
 */
function ignore() {}

