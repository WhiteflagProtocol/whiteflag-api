/**
 * @module lib/_common/http
 * @summary Whiteflag API common http functions module
 * @description Module with common http functions
 * @tutorial modules
 */
module.exports = {
    get,
    post
};

// MAIN MODULE FUNCTIONS //
/**
 * Executes a http GET request and returns the response
 * @pfunction get
 * @alias module:lib/_common/http.get
 * @param {URL} url a URL to get the authentication signature from
 * @param {string} user the user for basic authorization
 * @param {string} pass the password for basic authorization
 * @returns {Promise} resolves 
 */
function get(url, user, pass) {
    const reqOptions = {
        method: 'GET',
        headers: getHeaders(user, pass)
    };
    fetch(url, reqOptions)
    .then(res => {
        return Promise.resolve(null, res.json());
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Executes a http POST request and returns the response
 * @function post
 * @alias module:lib/_common/http.post
 * @param {URL} url a URL to get the authentication signature from
 * @param {Object} data the object to post as JSON
 * @param {string} user the user for basic authorization
 * @param {string} pass the password for basic authorization
 * @returns {Promise}
 */
function post(url, data, user, pass) {
    const reqOptions = {
        method: 'POST',
        headers: getHeaders(user, pass),
        body: JSON.stringify(data)
    };
    fetch(url, reqOptions)
    .then(res => {
        return Promise.resolve(null, res.json());
    })
    .catch(err => {
        return Promise.reject(err);
    });
}

/**
 * Creates the http request headers
 * @private
 * @param {string} user the user for basic authorization
 * @param {string} pass the password for basic authorization
 */
function getHeaders(user, pass) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (user && pass) {
        const userpass = `${user}:${pass}`
        headers.append("Authorization", `Basic ${Buffer.from(userpass, "utf-8").toString("base64")}`)
    }
    return headers;
}
