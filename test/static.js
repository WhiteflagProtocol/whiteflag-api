'use strict';
/**
 * @module test/static
 * @summary Whiteflag static data test script
 * @description Script for testing Whiteflag API static data
 */

// Node.js core and external modules //
const testCase = require('mocha').describe;
const assertion = require('mocha').it;
const assert = require('assert');
const fs = require('fs');
const semver = require('semver');
const jsonValidate = require('jsonschema').validate;

// Whiteflag common functions and classes //
const { ignore } = require('../lib/_common/processing');
const log = require('../lib/_common/logger');
log.setLogLevel(1, ignore);

// Project modules required for test //
const array = require('../lib/_common/arrays');

// Constants //
const _metaSchema = JSON.parse(fs.readFileSync('./test/_static/json-schema.schema.json'));

// TEST SCRIPT //
testCase('Whiteflag API static data tests', function() {
    // Version numbers
    testCase('OpenAPI definition', function() {
        // Data
        const packageObj = JSON.parse(fs.readFileSync('./package.json'));
        const openapiObj = JSON.parse(fs.readFileSync('./static/openapi.json'));

        // Test
        assertion(' 1. should correspond with the software version', function(done) {
            // Software package version
            if (!packageObj.version) return done(new Error('Could not determine software package version'));
            const packageVersion = semver.clean(packageObj.version);

            // OpenAPI definition version
            if (!openapiObj.info.version) return done(new Error('Could not determine OpenAPI definition version'));
            const openapiVersion = semver.clean(openapiObj.info.version);

            // Compare versions
            if (semver.eq(packageVersion, openapiVersion)) return done();
            done(new Error(`The OpenAPI definition version ${openapiVersion} does not correspond with the software package version ${packageVersion}`));
        });
    });
    // JSON Schemas
    testCase('JSON schemas', function() {
        // Schemas
        const staticSchemas = [
            './test/_static/json-schema.schema.json',
            './lib/blockchains/_static/blockchains.config.schema.json',
            './lib/datastores/_static/datastores.config.schema.json',
            './static/protocol/message.schema.json',
            './static/protocol/metaheader.schema.json',
            './static/protocol/signature.schema.json',
            './static/protocol/state.schema.json'
        ];
        // Validate each schema in the array
        let n = 0;
        staticSchemas.forEach(schemaFile => {
            n += 1;
            assertion(` 2.${n}. should validate against metaschema: ${schemaFile}`, function(done) {
                const schema = JSON.parse(fs.readFileSync(schemaFile));
                let errors = validateJSON(schema);
                assert.deepStrictEqual(errors, []);
                done();
            });
        });
    });
});

// PRIVATE TEST FUNCTIONS //
/**
 * Validates a JSON specification against a JSON schema
 * @private
 * @param {Object} specification the json specification to be validated
 * @param {Object} [schema] the json schema to be validated against
 * @returns {array} validation errors, empty if no errors
 */
function validateJSON(specification, schema = _metaSchema) {
    try {
        return [].concat(array.pluck(jsonValidate(specification, schema).errors, 'stack'));
    } catch(err) {
        console.log(err);
        return [].push(err.message);
    }
}
