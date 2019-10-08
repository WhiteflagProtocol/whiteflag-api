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
 * @param {object} sourceObject object with new data
 * @param {object} targetObject object to be updated
 * @param {boolean} arrays indicates whether arrays should be merged
 */
function update(sourceObject, targetObject, arrays = false) {
    Object.keys(sourceObject).forEach(key => {
        if (typeof sourceObject[key] === 'object' && targetObject[key]) {
            if (arrays && Array.isArray(sourceObject[key]) && Array.isArray(targetObject[key])) {
                targetObject[key] = targetObject[key].concat(sourceObject[key]);
            } else {
                update(sourceObject[key], targetObject[key]);
            }
        } else {
            if (arrays && Array.isArray(targetObject[key])) {
                targetObject[key] = targetObject[key].push(sourceObject[key]);
            } else {
                targetObject[key] = sourceObject[key];
            }
        }
    });
}
