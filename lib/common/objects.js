'use strict';
/**
 * @module lib/common/objects
 * @summary Whiteflag API common objects functions module
 * @description Module with synchronous objects functions making life easier
 */
module.exports = {
    // Object functions
    update
};

// MAIN MODULE FUNCTIONS //
/**
 * Update properties from source object to target object recursively.
 * If object property does not exists it will be created in target object.
 * @function update
 * @alias module:lib/common/objects.update
 * @param {object} sourceObject
 * @param {object} targetObject
 */
function update(sourceObject, targetObject) {
    Object.keys(sourceObject).forEach(key => {
        if (typeof sourceObject[key] === 'object') {
            update(sourceObject[key], targetObject[key]);
        } else {
            targetObject[key] = sourceObject[key];
        }
    });
}
