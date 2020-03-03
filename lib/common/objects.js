'use strict';
/**
 * @module lib/common/objects
 * @summary Whiteflag API common objects functions module
 * @description Module with synchronous objects functions making life easier
 * @tutorial modules
 */
module.exports = {
    // Object functions
    update
};

// MAIN MODULE FUNCTIONS //
/**
 * Update properties from source object to target object recursively.
 * If object property does not exists it will be created in target object.
 * If both source and target properties are arrays, they will be merged with duplicates removed
 * @function update
 * @alias module:lib/common/objects.update
 * @param {Object} sourceObject object with new data
 * @param {Object} targetObject object to be updated
 */
function update(sourceObject, targetObject) {
    Object.keys(sourceObject).forEach(key => {
        if (typeof sourceObject[key] === 'object' && targetObject[key]) {
            if (Array.isArray(sourceObject[key]) && Array.isArray(targetObject[key])) {
                targetObject[key] = [...new Set(targetObject[key].concat(sourceObject[key]))];
            } else {
                update(sourceObject[key], targetObject[key]);
            }
        } else {
            targetObject[key] = sourceObject[key];
        }
    });
}
