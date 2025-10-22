# General Description and Overview

This [Whiteflag](https://www.whiteflagprotocol.org/)
Application Programming Interface (API) is a [Node.js](https://nodejs.org/en/about/)
software implementation of the [Whiteflag Protocol](https://standard.whiteflagprotocol.org/).

It provides an interface with the Whiteflag messaging network on one or more
underlying blockchains. As such, it acts as a message transceiver between one
or more blockchains and one or more end-user applications.

For interaction with end-user applications, two methods are used:
a [REST API](https://en.wikipedia.org/wiki/Representational_state_transfer)
is available for originators to provide Whiteflag messages to be sent on the
blockchain, and a [web socket](https://en.wikipedia.org/wiki/WebSocket) is
available for clients to listen for incoming Whiteflag messages from a
blockchain.

The Whiteflag Protocol and API specifications are also available at
`http://localhost:5746/` (default URL) when the API is running.

## Detailed API and Source Code References

* External REST interface: [OpenAPI Definition](md/openapi.md)
* Internal software interfaces: [JSDoc Documentation](jsdoc/index.html)

## Installation and Configuration

* [Installation](md/installation.md)
* [Configuration](md/configuration.md)

## Whiteflag Protocol

* [Protocol Implementation](md/protocol.md)
* [Protocol State](md/state.md)

## Blockchain Implementations

* [Fennel](md/fennel.md)
* [Bitcoin](md/bitcoin.md)
* [Ethereum](md/ethereum.md)

## Source Code Description

* [JavaScript Modules](md/modules.md)
* [Logging](md/logging.md)
* [Events](md/events.md)
* [Error Handling](md/errors.md)
* [Static Components](md/static.md)
