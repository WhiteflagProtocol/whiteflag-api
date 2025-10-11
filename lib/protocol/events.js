'use strict';
/**
 * @module lib/protocol/events
 * @summary Whiteflag events module
 * @description Module for Whiteflag protocol events
 * @tutorial modules
 * @tutorial protocol
 * @tutorial events
 */

// Module events //
/*
 * The rx and tx events are to bind handlers to incoming and outgoing message
 * processing steps using events; this is useful when more complex processing
 * cases such as encryption, authentication, etc. require different handling
 * paths of messages.
 */
const _rxEvent = new (require('events')).EventEmitter();
const _txEvent = new (require('events')).EventEmitter();

/*
 * The state event allows to bind handlers to state changes using events; this
 * is useful when a process does not only want to keep track of some data, but
 * also wants to trigger required actions
 */
const _stateEvent = new (require('events')).EventEmitter();

// Module exports //
module.exports = {
    rxEvent: _rxEvent,
    txEvent: _txEvent,
    stateEvent: _stateEvent
};
