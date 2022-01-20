'use strict';
/**
 * @module lib/protocol/codec
 * @summary Whiteflag message encoding and decoding module
 * @description Module for Whiteflag message encoding and decoding
 * @tutorial modules
 * @tutorial protocol
 */
module.exports = {
    // Codec functions
    encode: encodeMessage,
    decode: decodeMessage,
    // Verification functions
    verifyFormat
};

// Node.js core and external modules //
const fs = require('fs');
const jsonValidate = require('jsonschema').validate;

// Whiteflag common functions and classes //
const array = require('../common/arrays');
const object = require('../common/objects');
const { type } = require('../common/protocol');
const { ProcessingError, ProtocolError } = require('../common/errors');

// Whiteflag modules //
const wfCrypto = require('./crypto');

// Module constants //
const BYTELENGTH = 8;
const BINENCODING = 'hex';
const wfMessageSchema = JSON.parse(fs.readFileSync('./static/protocol/message.schema.json'));

// MAIN MODULE FUNCTIONS //
/**
 * Checks if message formate validates against schema and updates metaheader accordingly
 * @function verifyFormat
 * @alias module:lib/protocol/codec.verifyFormat
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {function(Error, wfMessage)} callback function to be called upon completion
 */
function verifyFormat(wfMessage, callback) {
    // Check for metaheader
    if (!wfMessage.MetaHeader) {
        return callback(new ProtocolError('Missing metaheader', null, 'WF_METAHEADER_ERROR'), wfMessage);
    }
    // Validate message format
    let formatErrors = [];
    try {
        // Check against schema
        formatErrors = formatErrors.concat(
            array.pluck(jsonValidate(wfMessage, wfMessageSchema).errors, 'stack')
        );
        // Check field vaues
        formatErrors = array.addArray(formatErrors, verifyValues(wfMessage));
    } catch(err) {
        return callback(err, wfMessage);
    }
    // Check for format errors, update metaheader and return result
    if (formatErrors.length > 0) {
        wfMessage.MetaHeader.formatValid = false;
        return callback(new ProtocolError('Invalid message format', formatErrors, 'WF_FORMAT_ERROR'), wfMessage);
    }
    wfMessage.MetaHeader.formatValid = true;
    return callback(null, wfMessage);
}

/**
 * Encodes a json formatted message to binary format and updates metaheader accordingly
 * @function encodeMessage
 * @alias lib/protocol/codec.encode
 * @param {wfMessage} wfMessage a Whiteflag message
 * @param {function(Error, wfMessage)} callback function to be called upon completion
 */
function encodeMessage(wfMessage, callback) {
    // Validate message format
    verifyFormat(wfMessage, function encodeVerifyFormatCb(err, wfMessage) {
        if (err) return callback(err, wfMessage);

        // Split into message header and body
        const { MessageHeader: header, MessageBody: body } = wfMessage;

        // Encode message header (generic for all message types):
        // Create character string representing the binary encoding of the header
        let headerBinStr = (
            encodeUTF2BinStr(header.Prefix, 16) +
            encodeUTF2BinStr(header.Version, 8) +
            encodeUTF2BinStr(header.EncryptionIndicator, 8) +
            encodeBDX2BinStr(header.DuressIndicator, 1) +
            encodeUTF2BinStr(header.MessageCode, 8) +
            encodeBDX2BinStr(header.ReferenceIndicator, 4) +
            encodeBDX2BinStr(header.ReferencedMessage, 256)
        );
        // Encode message body (message type specific):
        // Create character string representing the binary encoding of the body
        let messageType = header.MessageCode;
        let encodingBody = body;
        let testBinStr = '';
        let bodyBinStr = '';
        let requestObjectsBinStr = '';

        // Check if test message
        if (header.MessageCode === 'T') {
            messageType = body.PseudoMessageCode;
            encodingBody = body.PseudoMessageBody;
            testBinStr = encodeUTF2BinStr(body.PseudoMessageCode, 8);
        }
        // Encode message body for each (pseudo) message type
        switch (messageType) {
            case 'A': {
                bodyBinStr = (
                    encodeBDX2BinStr(encodingBody.VerificationMethod, 4) +
                    encodeUTF2BinStr(encodingBody.VerificationData, 0)
                );
                break;
            }
            case 'K': {
                bodyBinStr = (
                    encodeBDX2BinStr(encodingBody.CryptoDataType, 8) +
                    encodeBDX2BinStr(encodingBody.CryptoData, (encodingBody.CryptoData.length * 4))
                );
                break;
            }
            case 'Q': {
                if (encodingBody.requestObjects) {
                    encodingBody.requestObjects.forEach(requestObject => {
                        requestObjectsBinStr = (
                            requestObjectsBinStr +
                            encodeBDX2BinStr(requestObject.ObjectType, 8) +
                            encodeBDX2BinStr(requestObject.ObjectTypeQuant, 8)
                        );
                    });
                }
            }
            // fallthrough //
            case 'P':
            case 'D':
            case 'S':
            case 'E':
            case 'I':
            case 'M': {
                bodyBinStr = (
                    encodeBDX2BinStr(encodingBody.SubjectCode, 8) +
                    encodeDatum2BinStr(encodingBody.DateTime) +
                    encodeDatum2BinStr(encodingBody.Duration) +
                    encodeBDX2BinStr(encodingBody.ObjectType, 8) +
                    encodeDatum2BinStr(encodingBody.ObjectLatitude) +
                    encodeDatum2BinStr(encodingBody.ObjectLongitude) +
                    encodeBDX2BinStr(encodingBody.ObjectSizeDim1, 16) +
                    encodeBDX2BinStr(encodingBody.ObjectSizeDim2, 16) +
                    encodeBDX2BinStr(encodingBody.ObjectOrientation, 12) +
                    requestObjectsBinStr
                );
                break;
            }
            case 'R': {
                bodyBinStr = (
                    encodeBDX2BinStr(encodingBody.ResourceMethod, 4) +
                    encodeUTF2BinStr(encodingBody.ResourceData, 0)
                );
                break;
            }
            case 'F': {
                bodyBinStr = encodeUTF2BinStr(encodingBody.Text, 0);
                break;
            }
            case 'T': {
                return callback(new ProcessingError(`Embedding of pseudo message type ${messageType} not implemented`, null, 'WF_API_NOT_IMPLEMENTED'), wfMessage);
            }
            default: {
                return callback(new ProtocolError(`Invalid message type: ${messageType}`), wfMessage);
            }
        }
        // Add encoded pseudo message code for test messages
        bodyBinStr = testBinStr + bodyBinStr;
        // Concatinate binary representation of header and body
        const encodedMessage = encodeBinStr2Buffer(headerBinStr + bodyBinStr);

        // Encrypt binary encoded message
        wfCrypto.encrypt(wfMessage, encodedMessage, function encodeEncryptCb(err, wfMessage) {
            if (err) return callback(err, wfMessage);
            return callback(null, wfMessage);
        });
    });
}

/**
 * Decodes binary message to validated json object and updates metaheader accordingly
 * @function decodeMessage
 * @alias lib/protocol/codec.decode
 * @param {wfMessage} wfMessage Whiteflag message with encoded message string in MetaHeader
 * @param {function(Error, wfMessage, ivMissing)} callback
 * @typedef {boolean} ivMissing indicates whether initialisation vector for decryption is missing
 */
function decodeMessage(wfMessage, callback) {
    // Check metaheader and encoded message
    if (!wfMessage.MetaHeader) {
        return callback(new ProtocolError('Missing metaheader', null, 'WF_METAHEADER_ERROR'), wfMessage);
    }
    if (!wfMessage.MetaHeader.encodedMessage) {
        return callback(new ProtocolError('No encoded message in metaheader', null, 'WF_METAHEADER_ERROR'), wfMessage);
    }
    // Create character string of the binary representation
    const encryptedMessage = Buffer.from(wfMessage.MetaHeader.encodedMessage, BINENCODING);
    let messageBinStr = decodeBin2BinStr(encryptedMessage);

    // Create empty message header and body objects
    wfMessage.MessageHeader = {};
    wfMessage.MessageBody = {};

    // Decoding of first part of message header
    let { MessageHeader: header } = wfMessage;
    header.Prefix = decodeBinStr(messageBinStr, 0, 16, 'utf');
    if (header.Prefix !== 'WF') {
        return callback(new ProtocolError('Encoded message does not have WF prefix', null, 'WF_FORMAT_ERROR'), wfMessage);
    }
    header.Version = decodeBinStr(messageBinStr, 16, 24, 'utf');
    header.EncryptionIndicator = decodeBinStr(messageBinStr, 24, 32, 'utf');

    // Check decryption data
    switch (header.EncryptionIndicator) {
        case '1':
        case '2': {
            // Check initialisation Vector
            if (!wfMessage.MetaHeader.encryptionInitVector) {
                return callback(null, wfMessage, true);
            }
            break;
        }
        default: break;
    }
    // Decrypt message
    wfCrypto.decrypt(wfMessage, encryptedMessage, function decodeDecryptCb(err, decryptedMessage) {
        if (err) return callback(err, wfMessage);

        // Replace binary string with decrypted one
        messageBinStr = decodeBin2BinStr(decryptedMessage);

        // Determine message type
        header.MessageCode = decodeBinStr(messageBinStr, 33, 41, 'utf');
        let messageType = header.MessageCode;

        // Message body
        let { MessageBody: body } = wfMessage;
        let decodingBody = {};

        // Check if test message
        let p = 0;
        if (header.MessageCode === 'T') {
            body.PseudoMessageCode = decodeBinStr(messageBinStr, 301, 309, 'utf').toUpperCase();
            messageType = body.PseudoMessageCode;
            p = 8;
        }
        // Decoding of message body
        const messageLength = messageBinStr.length - BYTELENGTH;
        switch (messageType) {
            case 'A': {
                decodingBody.VerificationMethod = decodeBinStr(messageBinStr, 301 + p, 305 + p, 'hex').toUpperCase();
                decodingBody.VerificationData = decodeBinStr(messageBinStr, 305 + p, messageLength, 'utf');
                break;
            }
            case 'K': {
                decodingBody.CryptoDataType = decodeBinStr(messageBinStr, 301 + p, 309 + p, 'hex').toUpperCase();
                decodingBody.CryptoData = decodeBinStr(messageBinStr, 309 + p, (messageLength + 4), 'hex');
                break;
            }
            case 'P':
            case 'D':
            case 'S':
            case 'E':
            case 'I':
            case 'M':
            case 'Q': {
                decodingBody.SubjectCode = decodeBinStr(messageBinStr, 301 + p, 309 + p, 'hex').toUpperCase();
                decodingBody.DateTime = decodeBinStr(messageBinStr, 309 + p, 365 + p, 'datetime');
                decodingBody.Duration = decodeBinStr(messageBinStr, 365 + p, 389 + p, 'duration');
                decodingBody.ObjectType = decodeBinStr(messageBinStr, 389 + p, 397 + p, 'hex').toUpperCase();
                decodingBody.ObjectLatitude = decodeBinStr(messageBinStr, 397 + p, 426 + p, 'lat');
                decodingBody.ObjectLongitude = decodeBinStr(messageBinStr, 426 + p, 459 + p, 'long');
                decodingBody.ObjectSizeDim1 = decodeBinStr(messageBinStr, 459 + p, 475 + p, 'dec');
                decodingBody.ObjectSizeDim2 = decodeBinStr(messageBinStr, 475 + p, 491 + p, 'dec');
                decodingBody.ObjectOrientation = decodeBinStr(messageBinStr, 491 + p, 503 + p, 'dec');
                if (header.MessageCode === 'Q') {
                    decodingBody.requestObjects = [];
                    for (let b = 503 + p; b <= messageLength; b += (2 * BYTELENGTH)) {
                        let requestObject = {};
                        requestObject.ObjectType = decodeBinStr(messageBinStr, b, (b + 8), 'hex').toUpperCase();
                        requestObject.ObjectTypeQuant = decodeBinStr(messageBinStr, (b + 8), (b + 16), 'dec');
                        decodingBody.requestObjects.push(requestObject);
                    }
                }
                break;
            }
            case 'R': {
                decodingBody.ResourceMethod = decodeBinStr(messageBinStr, 301 + p, 305 + p, 'hex').toUpperCase();
                decodingBody.ResourceData = decodeBinStr(messageBinStr, 305 + p, messageLength, 'utf');
                break;
            }
            case 'F': {
                decodingBody.Text = decodeBinStr(messageBinStr, 301 + p, messageLength, 'utf');
                break;
            }
            case 'T': {
                return callback(new ProcessingError(`Embedding of pseudo message type ${messageType} not implemented`, null, 'WF_API_NOT_IMPLEMENTED'), wfMessage, false);
            }
            default: {
                if (header.EncryptionIndicator !== '0') {
                    header.MessageCode = null;
                    return callback(new ProtocolError('Decryption did not result in valid data; maybe wrong key or message intended for a different recipient', null, 'WF_ENCRYPTION_ERROR'), wfMessage);
                }
                return callback(new ProtocolError(`Invalid message type: ${messageType}`), wfMessage);
            }
        }
        // Further decoding of message header
        header.DuressIndicator = decodeBinStr(messageBinStr, 32, 33, 'bin');
        header.ReferenceIndicator = decodeBinStr(messageBinStr, 41, 45, 'hex').toUpperCase();
        header.ReferencedMessage = decodeBinStr(messageBinStr, 45, 301, 'hex');

        // Message Nody
        if (header.MessageCode === 'T') {
            body.PseudoMessageBody = decodingBody;
        } else {
            object.update(decodingBody, body);
        }
        // Validate message format and return message
        verifyFormat(wfMessage, function decodeVerifyFormatCb(err, wfMessage) {
            if (err) return callback(err, wfMessage);
            return callback(null, wfMessage, false);
        });
    });
}

// PRIVATE MODULE FUNCTIONS //
/**
 * Checks if message content is compliant with the WF specification
 * @private
 * @param {wfMessage} wfMessage a Whiteflag message
 * @returns {Array} content errors
 */
function verifyValues(wfMessage) {
    // Split message, get specification and prepare error array
    const { MessageHeader: header, MessageBody: body } = wfMessage;
    const wfSpec = wfMessageSchema.specifications;
    let contentErrors = [];

    // Find correct message type
    const mesageTypeIndex = wfSpec.MessageCode.findIndex(
        mesageCode => mesageCode.const === header.MessageCode
    );
    if (mesageTypeIndex < 0) {
        return contentErrors.push(`Cannot validate values for non-existing message type: ${header.MessageCode}`);
    }
    const messageType = wfSpec.MessageCode[mesageTypeIndex];

    // CHECK 1A: is the object code valid?
    let objectTypeIndex;
    if (body.ObjectType) {
        objectTypeIndex = wfSpec.ObjectType.findIndex(
            ObjectType => ObjectType.const === body.ObjectType
        );
        if (objectTypeIndex < 0) {
            contentErrors.push(`Object code is not valid: ${body.ObjectType}`);
        }
    }
    // CHECK 1B: is the subject code valid?
    if (body.SubjectCode) {
        const subjectCodeIndex = messageType.SubjectCode.findIndex(
            SubjectCode => SubjectCode.const === body.SubjectCode
        );
        if (subjectCodeIndex < 0) {
            contentErrors.push(`Subject code is not defined for ${header.MessageCode} messages: ${body.SubjectCode}`);
        } else {
            // CHECK 1C: may subject code be used for this object type?
            const allowedObjectIndex = messageType.SubjectCode[subjectCodeIndex].allowedObjectTypes.findIndex(
                objectCat => objectCat === body.ObjectType.slice(0, -1) + '*'
            );
            if (allowedObjectIndex < 0) {
                contentErrors.push(`Object type ${body.ObjectType} cannot be used in ${type(wfMessage)} messages`);
            }
        }
    }
    // Evaluate and return result
    return contentErrors;
}

/**
 * Converts a string with characters representing Binary, Decimal and Hexadecimal values
 * to a character string representing their the binary encoding
 * @private
 * @param {string} fieldStr unencoded/uncompressed field value
 * @param {number} nBits size of field in compressed binary encoding in bits
 * @returns {string} representation of the binary encoding of the field
 */
function encodeBDX2BinStr(fieldStr, nBits) {
    const padding = Math.ceil(nBits / fieldStr.length);
    const padbits = new Array(padding).join('0');
    let binStr = '';

    // Run through characters of the string and convert to binary one by one
    // Treating all integers as hexadecimals always results in correct binary encoding
    for (let i = 0; i < fieldStr.length; i++) {
        let binCNum = parseInt(fieldStr[i], 16).toString(2);
        binStr += (padbits + binCNum).slice(-padding);
    }
    return binStr;
}

/**
 * Converts a string of 1-byte UTF-8 characters to a character string
 * representing the binary encoding of 8-bit bytes
 * @private
 * @param {*} fieldStr unencoded/uncompressed field value
 * @param {*} nBits size of field in compressed binary encoding in bits
 * @returns {string} representation of the binary encoding of the field
 */
function encodeUTF2BinStr(fieldStr, nBits) {
    const padbits = new Array(BYTELENGTH).join('0');
    let binStr = '';

    // Run through characters of the string and convert to binary one by one
    for (let i = 0; i < fieldStr.length; i++) {
        let binChar = fieldStr[i].charCodeAt(0).toString(2);
        binStr += (padbits + binChar).slice(-BYTELENGTH);
    }
    // Add 0s to fill all nBits of the field with UTF-8 NULL character, unless nBits = 0
    if (nBits === 0) return binStr;

    let nullstr = new Array(nBits - binStr.length).join('0');
    return (binStr + nullstr);
}

/**
 * Converts a string with datetime, time periode and lat long coordinates
 * to a character string representing the binary encoding
 * @private
 * @param {string} fieldStr unencoded/uncompressed field value
 * @returns {string} representation of the binary encoding of the field
 */
function encodeDatum2BinStr(fieldStr) {
    let sign = '';

    // Sign of lat long coordinates
    if (fieldStr.charAt(0) === '-') sign = '0';
    if (fieldStr.charAt(0) === '+') sign = '1';

    // Prepare string by removing fixed characters
    const fieldStrCl = fieldStr.replace(/[-+:.A-Z]/g, '');

    // Run through characters of the string and convert to binary one by one
    const padding = 4;
    const padbits = new Array(padding).join('0');
    let binStr = '';
    for (let i = 0; i < fieldStrCl.length; i++) {
        let binCNum = parseInt(fieldStrCl[i], 10).toString(2);
        binStr += (padbits + binCNum).slice(-padding);
    }
    return (sign + binStr);
}

/**
 * Converts a character string representing the binary encoding to a buffer
 * @private
 * @param {string} binStr representation of the binary encoding
 * @returns {buffer} binary ncoding
 */
function encodeBinStr2Buffer(binStr) {
    // Split the string in an array of strings representing 8-bit bytes
    const regexBytes = new RegExp('.{1,' + BYTELENGTH + '}', 'g');
    let binStrArr = binStr.match(regexBytes);

    // Add trailing 0s to fill last byte
    const lastbyte = binStrArr.length - 1;
    const trailzero = new Array(BYTELENGTH - binStrArr[lastbyte].length + 1).join('0');
    binStrArr[lastbyte] += trailzero;

    // Convert the character string with binary representation to a binary buffer of 8-bit words
    const buf = Buffer.alloc(binStrArr.length);
    for (let i = 0; i < binStrArr.length; i++) {
        buf[i] = parseInt(binStrArr[i], 2);
    }
    return buf;
}

/**
 * Converts a binary buffer/array to a character string representation
 * of the binary encoding of a message
 * @private
 * @param {buffer} BufArr binary encoding of a message
 * @returns {string} representation of the binary encoding
 */
function decodeBin2BinStr(BufArr) {
    const padbits = new Array(BYTELENGTH).join('0');
    let binStr = '';

    // Run through characters of the string and convert to binary one by one
    for (let i = 0; i < BufArr.length; i++) {
        let binChars = BufArr[i].toString(2);
        binStr += (padbits + binChars).slice(-BYTELENGTH);
    }
    return binStr;
}

/**
 * Converts a substring of the character string representation
 * of the binary encoding of a message to the uncompressed field value
 * @private
 * @param {*} binStr representation of the binary encoding
 * @param {*} beginBit position in string from where to convert
 * @param {*} endBit position in string before which conversion stops
 * @param {*} type 'utf', 'bin', 'dec', 'hex', 'datetime', 'duration', 'lat', 'long'
 * @returns {string} decoded/uncompressed field value
 */
function decodeBinStr(binStr, beginBit, endBit, type) {
    let i = 0;
    let fieldStr = '';

    // Perform conversion, depending on used binary encoding
    switch (type) {
        case 'utf': {
            // Run through bytes of the substring and convert to UTF-8 one by one
            for (i = beginBit; i < endBit; i += BYTELENGTH) {
                fieldStr += String.fromCharCode(parseInt(binStr.substring(i, i + BYTELENGTH), 2));
            }
            break;
        }
        case 'bin': {
            // Run through 1-bit binary values and convert to characters one by one
            for (i = beginBit; i < endBit; i++) {
                fieldStr += parseInt(binStr.charAt(i), 2).toString(2);
            }
            break;
        }
        case 'lat':
        case 'long': {
            // Convert the first bit of lat long coordinates into sign
            if (parseInt(binStr.charAt(beginBit), 2) === 0) fieldStr = '-';
            if (parseInt(binStr.charAt(beginBit), 2) === 1) fieldStr = '+';
            // Make sure BCD decoding below skips the sign bit; no break needed here!
            beginBit++;
        }
        // fallthrough  //
        case 'dec':
        case 'datetime':
        case 'duration': {
            // Run through 4-bit BCDs in the substring and convert to characters one by one
            for (i = beginBit; i < endBit; i += 4) {
                fieldStr += parseInt(binStr.substring(i, i + 4), 2).toString();
            }
            break;
        }
        case 'hex': {
            // Run through 4-bit HCDs in the substring and convert to characters one by one
            for (i = beginBit; i < endBit; i += 4) {
                fieldStr += parseInt(binStr.substring(i, i + 4), 2).toString(16);
            }
            break;
        }
        default: {
            throw new Error(`Internal Coding Error: wrong decoding type provided to decodeBinStr: ${type}`);
        }
    }
    // Re-insert fixed characters for certain field types i.a.w. specification
    switch (type) {
        case 'datetime':
            fieldStr = [
                fieldStr.slice(0, 4), '-',
                fieldStr.slice(4, 6), '-',
                fieldStr.slice(6, 8), 'T',
                fieldStr.slice(8, 10), ':',
                fieldStr.slice(10, 12), ':',
                fieldStr.slice(12), 'Z'
            ].join('');
            break;
        case 'duration':
            fieldStr = [
                'P',
                fieldStr.slice(0, 2), 'D',
                fieldStr.slice(2, 4), 'H',
                fieldStr.slice(4), 'M'
            ].join('');
            break;
        case 'lat':
            fieldStr = [fieldStr.slice(0, 3), '.', fieldStr.slice(3)].join('');
            break;
        case 'long':
            fieldStr = [fieldStr.slice(0, 4), '.', fieldStr.slice(4)].join('');
            break;
    }
    return fieldStr;
}
