'use strict';
/**
 * @module test/blockchains
 * @summary Whiteflag blockchains test script
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
// const wfApiBlockchains = require('../../lib/blockchains');

// TEST SCRIPT //
testCase('Whiteflag API blockchains module', function() {
    assertion(' 0. should correctly load', function(done) {
        const wfApiBlockchains = require('../lib/blockchains');
        ignore(wfApiBlockchains);
        done();
    });
});

/*
 * Only some blockchain functions are currently unit tested here.
 * Blockchain functions are assumed to be online end-to-end tested
 */

