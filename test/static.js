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
const jsonValidate = require('jsonschema').validate;

// Project modules required for test //
const array = require('../lib/common/arrays');

// Set logger to log only fatal conditions //
const log = require('../lib/common/logger');
log.setLogLevel(1, ignore);

// Constants //
const _metaSchema = JSON.parse(fs.readFileSync('./test/static/json-schema.schema.json'));
const _staticSchemas = [
    './test/static/json-schema.schema.json',
    './lib/blockchains/static/blockchains.config.schema.json',
    './lib/datastores/static/datastores.config.schema.json',
    './lib/protocol/static/message.schema.json',
    './lib/protocol/static/metaheader.schema.json',
    './lib/protocol/static/signature.schema.json',
    './lib/protocol/static/state.schema.json'
];

// TEST SCRIPT //
testCase('Whiteflag API static data tests', function() {
    // JSON Schemas
    let n = 0;
    testCase('Validation of JSON schemas', function() {
        _staticSchemas.forEach(schemaFile => {
            n += 1;
            assertion(` ${n}. should validate against metaschema: ${schemaFile}`, function(done) {
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
 * Ignores its arguments
 * @private
 */
function ignore() {}

/**
 * Validates a JSON specification against a JSON schema
 * @private
 * @param {object} specification the json specification to be validated
 * @param {object} [schema] the json schema to be validated against
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
