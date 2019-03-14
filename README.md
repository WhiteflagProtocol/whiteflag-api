# Whiteflag API

## Introduction

This Whiteflag Application Programming Interface (API) is a [Node.js](https://nodejs.org/en/about/) software implementation of the API layer that provides an interface with the Whiteflag messaging network on one or more underlying blockchains. As such,
it acts as a message transceiver between one or more blockchains and one or more end-user applications.

For interaction with an end-user application, two methods are used. A [REST API](https://en.wikipedia.org/wiki/Representational_state_transfer) is available for originators to provide Whiteflag message to be sent on the blockchain, and a [web socket](https://en.wikipedia.org/wiki/WebSocket) is available for clients to listen for incoming Whiteflag messages from a
blockchain.

This Whiteflag API is a so called Minimum Viable Product (MVP). This means that it only supports the core features of the Whiteflag protocol and nothing more. As such, it serves as the reference implementation of the Whiteflag protocol, but it is not specifically designed and tested for secure usage and performance in a production environment.

## Versions

Version `v1.0.0-alpha` of the Whiteflag API will be made available as open source software as soon a possible.
