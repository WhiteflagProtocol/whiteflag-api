'use strict';
/**
 * @module lib/common/errors
 * @summary Whiteflag API error module
 * @description Module for Whiteflag specific error classes
 */

// Module classes //
/**
 * @class DomainError
 * @extends {Error}
 * @classdesc Generic domain error class
 */
class DomainError extends Error {
    /**
     * Constructor for domain errors
     * @param {string} message a human readable error message
     * @param {array} causes underlying errors causing this error
     */
    constructor(message, causes = null) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);

        // Preserve any provided causes
        if (Array.isArray(causes)) this.causes = causes;
            else if (causes) this.causes = [ causes ];
    }
}

// Module exports //
module.exports = {
    /**
     * Creates error object for processing errors, e.g. as a result of a bad request
     * @class ProcessingError
     * @extends {DomainError}
     * @classdesc Error codes of the ProcessingError class:
     *      `WF_API_PROCESSING_ERROR`: generic processing error (default)
     *      `WF_API_BAD_REQUEST`: the request was incomplete or incorrect syntax
     *      `WF_API_NO_DATA`: the request did not return any (valid) data
     *      `WF_API_NO_RESOURCE`: could not processess because resource does not exist
     *      `WF_API_NOT_IMPLEMENTED`: the function is not supported
     *      `WF_API_NOT_AVAILABLE`: the function is currently not available
     */
    ProcessingError: class extends DomainError {
        /**
         * Constructor for processing errors
         * @param {string} message a human readable error message
         * @param {array} causes underlying errors causing this error
         * @param {string} code constant identifying the error
         */
        constructor(message, causes = null, code = 'WF_API_PROCESSING_ERROR') {
            super(message, causes);
            this.code = code;
        }
    },
    /**
     * Creates error object for Whiteflag protocol and message errors
     * @class ProcesProtocolErrorsingError
     * @extends {DomainError}
     * @classdesc Error codes of the ProtocolError class:
     *      `WF_PROTOCOL_ERROR`: generic Whiteflag protocol error (default)
     *      `WF_METAHEADER_ERROR`: incorrect Whiteflag message metaheader
     *      `WF_FORMAT_ERROR`: Whiteflag message format error
     *      `WF_REFERENCE_ERROR`: Whiteflag message reference error
     *      `WF_AUTH_ERROR`: Whiteflag message authentication error
     *      `WF_SIGN_ERROR`: Whiteflag signature error
     *      `WF_ENCRYPTION_ERROR`: Whiteflag encryption error
     */
    ProtocolError: class extends DomainError {
        /**
         * Constructor for protocol errors
         * @param {string} message a human readable error message
         * @param {array} causes underlying errors causing this error
         * @param {string} code constant identifying the error
         */
        constructor(message, causes = null, code = 'WF_PROTOCOL_ERROR') {
            super(message, causes);
            this.code = code;
        }
    }
};
