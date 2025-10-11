'use strict';
/**
 * @module lib/_common/encoding
 * @summary Whiteflag API common data encoding   module
 * @description Module for common basic checks and conversions on primitive data types
 * @tutorial modules
 */
module.exports = {
    isObject,
    isString,
    bufferToBase64u,
    bufferToHex,
    bufferToString,
    base64uToBuffer,
    base64uToHex,
    base64uToString,
    hexToBuffer,
    hexToBase64u,
    hexToString,
    hexToU8a,
    stringToBuffer,
    stringToBase64u,
    stringToHex,
    u8aToHex
}

// Global scope //
const { Buffer } = require('node:buffer');

// Module constants //
const BASE64URL = 'base64url'
const HEXSTRING = 'hex'

/**
 * Checks if something is an object
 * @param {*} obj something that might be an object
 * @returns true if object, else false
 */
function isObject(obj) {
    return (typeof obj === 'object' || obj instanceof Object);
}

/**
 * Checks if something is a string
 * @param {*} string something that might be a string
 * @returns true if string, else false
 */
function isString(string) {
    return (typeof string === 'string' || string instanceof String); 
}

/**
 * Creates a base64url encoded string from a buffer
 * @param {Buffer} buffer a buffer
 * @returns a base64url encoded string
 */
function bufferToBase64u(buffer) {
    return buffer.toString(BASE64URL);
}

/**
 * Creates a hexadecimal string from a buffer
 * @param {Buffer} buffer a buffer
 * @returns a hexadecimal string
 */
function bufferToHex(buffer) {
    return buffer.toString(HEXSTRING);
}

/**
 * Creates a standard string from a buffer
 * @param {Buffer} buffer a buffer
 * @returns a standard string
 */
function bufferToString(buffer) {
    return buffer.toString();
}

/**
 * Creates a buffer from a base64utf encoded string
 * @param {string} base64u a base64utf encoded string
 * @returns a buffer
 */
function base64uToBuffer(base64u) {
    return Buffer.from(base64u, BASE64URL);
}

/**
 * Creates hexadecimal string from a base64utf encoded string
 * @param {string} base64u a base64utf encoded string
 * @returns a hexadecimal encoded string
 */
function base64uToHex(base64u) {
    return Buffer.from(base64u, BASE64URL).toString(HEXSTRING);
}

/**
 * Creates a standard string from a base64utf encoded string
 * @param {string} base64u a base64utf encoded string
 * @returns a standard string
 */
function base64uToString(base64u) {
    return Buffer.from(base64u, BASE64URL).toString();
}

/**
 * Creates a buffer from a hexadecimal string
 * @param {string} hexString a hexadecimal string
 * @returns a buffer
 */
function hexToBuffer(hexString) {
    return Buffer.from(hexString, HEXSTRING);
}

/**
 * Creates a base64url encoded string from a hexadecimal string
 * @param {string} hexString a hexadecimal string
 * @returns a base64url encoded string
 */
function hexToBase64u(hexString) {
    return Buffer.from(hexString, HEXSTRING).toString(BASE64URL);
}

/**
 * Creates a regular string from a hexadecimal string
 * @param {string} hexString a hexadecimal string
 * @returns a regular string
 */
function hexToString(hexString) {
    return Buffer.from(hexString, HEXSTRING).toString();
}

/**
 * Creates a buffer from a hexadecimal string
 * @param {string} hexString a hexadecimal string
 * @returns {Uint8Array} an array of 8-bit unsigned integers
 */
function hexToU8a(hexString) {
    return Uint8Array.from(Buffer.from(hexString, HEXSTRING));
}

/**
 * Creates a buffer from a regular string
 * @param {string} string a regular string
 * @returns a buffer
 */
function stringToBuffer(string) {
    return Buffer.from(string);
}

/**
 * Creates a base64url encoded string from a regular string
 * @param {string} string a regular string
 * @returns a base64url encoded string
 */
function stringToBase64u(string) {
    return Buffer.from(string).toString(BASE64URL);
}

/**
 * Creates a hexadecimal string from a regular string
 * @param {string} string a regular string
 * @returns a hexadecimal string
 */
function stringToHex(string) {
    return Buffer.from(string).toString(HEXSTRING);
}

/**
 * Creates a hexadecimal string from an Uint8Array
 * @param {Uint8Array} u8array an array of 8-bit unsigned integers
 * @returns {string} a hexadecimal string
 */
function u8aToHex(u8array) {
    return Buffer.from(u8array).toString(HEXSTRING);
}
