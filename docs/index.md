# Whiteflag API

This Whiteflag Application Programming Interface (API) is a [Node.js](https://nodejs.org/en/about/)
software implementation of the API layer that provides an interface with the
Whiteflag messaging network on one or more underlying blockchains. As such,
it acts as a message transceiver between one or more blockchains and one or
more end-user applications.

For interaction with an end-user application, two methods are used.
A [REST API](https://en.wikipedia.org/wiki/Representational_state_transfer)
is available for originators to provide Whiteflag messages to be sent on the
blockchain, and a [web socket](https://en.wikipedia.org/wiki/WebSocket) is
available for clients to listen for incoming Whiteflag messages from a
blockchain.

The following documetation is available. The Whiteflag Protocol and API
specifications are also available at `http://localhost:5746/` (default URL)
when the API is running.

## Configuration

* [Configuration](configuration.md)

## REST API

* [OpenAPI Definition](openapi.md)

## Whiteflag Protocol

* [Protocol Implementation](protocol.md)
* [Protocol State](state.md)

## Blockchains

* [Ethereum](ethereum.md)

## Source code

* [JavaScript Modules](modules.md)
* [Logging](logging.md)
* [Events](events.md)
* [Error Handling](errors.md)
* [Static Components](static.md)
* [Detailed source code documentation](src/index.html)
