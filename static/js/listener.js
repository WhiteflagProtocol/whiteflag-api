/* eslint-disable no-undef */
/**
 * @script static/listen/listener
 * @summary Whiteflag client side message listener script
 * @description Script to listen for incoming Whiteflag messages on the API socket
 */

// Get current environment
const baseURL = window.location.origin;
const socket = io.connect(baseURL, { path: '/socket' });

// Print initial message
printLog('Connecting to Whiteflag API running on ' + baseURL);

// Set event listener for incomming messages
socket.on('message', data => {
    printMessage((data));
});

// MAIN SCRIPT FUNCTIONS //
/**
 * Prints logging data to html element with id 'wfdata'
 * @private
 * @param {string} data
 */
function printLog(data) {
    // Get html element with id 'wfdata'
    let wfDataDiv = document.getElementById('wfdata');

    // Format logging data and add to html element
    let log = '<pre class="log">' + data + '</pre>';
    wfDataDiv.innerHTML += log;
}

/**
 * Prints message data to html element with id 'wfdata'
 * @private
 * @param {string} data
 */
function printMessage(data) {
    // Get html element with id 'wfdata'
    let wfDataDiv = document.getElementById('wfdata');

    // Format message data and add to html element
    let message = '<pre id="json" class="message">' + JSON.stringify(data) + '</pre>';
    wfDataDiv.innerHTML += message;

    // Scroll along with new messages
    setTimeout(scroll, 5);
    function scroll() {
        wfDataDiv.scrollTop = wfDataDiv.scrollHeight;
    }
}
