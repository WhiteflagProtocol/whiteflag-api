/**
 * @module lib/_common/request
 * @summary Whiteflag API common http reuest functions module
 * @description Module with common http request functions
 * @tutorial modules
 */
module.exports = {
    httpRequest,
    cleanURL
};

/* Node.js core and external modules */
http = require('node:http');
https = require('node:https');

/* Module constants */
const TIMEOUT = 10000;
const HTTP_SUCCESS = 200;
const USERAGENT = 'Whiteflag API';
const CONTENT_JSON = 'application/json';


/* MAIN MODULE FUNCTIONS */
/**
 * Execites a http request and returns the JSON response
 * @function httpRequest
 * @alias module:lib/_common/request.httpRequest
 * @param {URL} url a URL to get the authentication signature from
 * @param {Object} [data] the object to POST as JSON, if omitted a GET request is done
 * @param {string} [user] the user for basic authorization
 * @param {string} [pass] the password for basic authorization
 * @param {number} [timeout] the timeout for the request in ms
 * @returns {Promise} resolves to the JSON result
 */
function httpRequest(url, data = null, user = null, pass = null, timeout = TIMEOUT) {
    let body;
    let parameters = {
        method: 'GET',
        timeout: timeout,
        headers: {
            'User-Agent': USERAGENT
        }
    }
    if (data) {
        body = JSON.stringify(data);
        parameters.method = 'POST';
        parameters.headers['Accept'] = CONTENT_JSON;
        parameters.headers['Content-Type'] = CONTENT_JSON
        parameters.headers['Content-Length'] = Buffer.byteLength(body);
    }
    if (user && pass) parameters.auth = `${user}:${pass}`;
    return sendRequest(url, parameters, body);
}

/**
 * Gives a clean URL stripped from sensitive data
 * @function cleanURL
 * @alias module:lib/_common/request.cleanURL
 * @param {string|URL} url the URL string to be stripped from sensitive data
 * @returns {string} a clean URL
 */
function cleanURL(url) {
    if (url instanceof URL) return url.origin;
    return url.replace(/(?<=\/{2}).+?(?:@)/, '');
}

/* PRIVATE MODULE FUNCTIONS */
/**
 * Sends an http request and provides the returned JSON data
 * @param {URL} url the url
 * @param {Object} req the http parameters
 * @param {string} [body] the json body for POST requests
 * @returns {Promise} a promise that resolves to the JSON result
 */
function sendRequest(url, parameters, body = null) {
    return new Promise((resolve, reject) => {
        let req;
        switch (url.protocol) {
            case 'http:': {
                req = http.request(url, parameters, resHandler)
                .on('error', errHandler);
                break;
            }
            case 'https:': {
                req = https.request(url, parameters, resHandler)
                .on('error', errHandler);
                break;
            }
            default: {
                return reject(new Error(`Unsupported protocol: ${url.protocol}`));
            }
        }
        req.once('error', errHandler);
        if (body) req.write(body);      // Send data for POST request
        req.end();

        /**
         * Handles http request errors
         * @private
         * @param {Error} err any error
         */
        function errHandler(err) {
            return reject(new Error(`Could complete request to ${url.origin}: ${err.message}`));
        }

        /**
         * Handles http responses
         * @private
         * @param {http.IncomingMessage} res the http response
         */
        function resHandler(res) {
            let data = '';
            res.on('data', function reqResonseDataCb(chunck) {
                data += chunck;
            });
            res.once('end', function reqResonseEndCb() {
                // Check for successful request
                if (res.statusCode !== HTTP_SUCCESS) {
                    return errHandler(new Error(`HTTP request returned ${res.statusCode} (${res.statusMessage})`))
                }
                // Return parsed data from request
                try {
                    const json = JSON.parse(data);
                    return resolve(json)
                } catch(err) {
                    return reject(new Error(`Could not parse JSON response: ${err.message}`));
                }
            });
        }
    });
}
