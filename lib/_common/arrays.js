'use strict';
/**
 * @module lib/_common/arrays
 * @summary Whiteflag API common array functions module
 * @description Module with synchronous array functions making life easier
 * @tutorial modules
 */
module.exports = {
    addItem,
    addArray,
    pluck,
    plucksub
};

/* MAIN MODULE FUNCTIONS */
/**
 * Adds item to array
 * @function addItem
 * @alias module:lib/_common/arrays.addItem
 * @param {Array} array
 * @param {*} item
 * @returns {Array}
 */
function addItem(array, item) {
    if (!item) return array;
    if (Array.isArray(array)) {
        array.push(item);
        return array;
    }
    return [ item ];
}

/**
 * Adds array 2 to the end of array 1
 * @function addArray
 * @alias module:lib/_common/arrays.addArray
 * @param {Array} array1
 * @param {Array} array2
 * @returns {Array}
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
 * @alias module:lib/_common/arrays.pluck
 * @param {Array} array array of objects
 * @param {string} key object property name
 * @returns {Array}
 */
function pluck(array, key) {
    return array.map(object => {
        return object[key];
    });
}

/**
 * Gets single subobject property from array of objects
 * @function plucksub
 * @alias module:lib/_common/arrays.plucksub
 * @param {Array} array array of objects
 * @param {string} key object property name
 * @param {string} subkey object property name
 * @returns {Array}
 */
function plucksub(array, key, subkey) {
    return array.map(object => {
        return object[key][subkey];
    });
}
