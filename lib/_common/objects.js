'use strict';
/**
 * @module lib/_common/objects
 * @summary Whiteflag API common objects functions module
 * @description Module with synchronous objects functions making life easier
 * @tutorial modules
 */
module.exports = {
    update
};

// MAIN MODULE FUNCTIONS //
/**
 * Update properties from source object to target object recursively.
 * If object property does not exists it will be created in target object.
 * If both source and target properties are arrays, they will be merged with duplicates removed
 * @function update
 * @alias module:lib/common/objects.update
 * @param {Object} sourceObj object with new data
 * @param {Object} targetObj object to be updated
 */
function update(sourceObj, targetObj) {
    Object.keys(sourceObj).forEach(key => {
        if (typeof sourceObj[key] === 'object' && targetObj[key]) {
            if (Array.isArray(sourceObj[key]) && Array.isArray(targetObj[key])) {
                targetObj[key] = [...new Set(targetObj[key].concat(sourceObj[key]))];
            } else {
                update(sourceObj[key], targetObj[key]);
            }
        } else {
            targetObj[key] = sourceObj[key];
        }
    });
}
