'use strict';
/**
 * @module lib/common/arrays
 * @summary Whiteflag API common array functions module
 * @description Module with synchronous array functions making life easier
 */
module.exports = {
    // Array functions
    addItem,
    addArray,
    pluck,
    plucksub
};

// MAIN MODULE FUNCTIONS //
/**
 * Adds item to array
 * @function addItem
 * @alias module:lib/common/arrays.addItem
 * @param {array} array
 * @param {*} item
 * @returns {array}
 */
function addItem(array, item) {
    if (Array.isArray(array)) {
        array.push(item);
        return array;
    }
    return [ item ];
}

/**
 * Adds array 2 to the end of array 1
 * @function addArray
 * @alias module:lib/common/arrays.addArray
 * @param {array} array1
 * @param {array} array2
 * @returns {array}
 */
function addArray(array1, array2) {
    if (Array.isArray(array1)) {
        if (Array.isArray(array2)) return array1.concat(array2);
        return array1;
    }
    if (Array.isArray(array2)) return array2;
    return [];
}

/**
 * Gets single property from array of objects
 * @function pluck
 * @alias module:lib/common/arrays.pluck
 * @param {array} array array of objects
 * @param {string} key object property name
 * @returns {array}
 */
function pluck(array, key) {
    return array.map(object => {
        return object[key];
    });
}

/**
 * Gets single subobject property from array of objects
 * @function plucksub
 * @alias module:lib/common/arrays.plucksub
 * @param {array} array array of objects
 * @param {string} key object property name
 * @param {string} subkey object property name
 * @returns {array}
 */
function plucksub(array, key, subkey) {
    return array.map(object => {
        return object[key][subkey];
    });
}
