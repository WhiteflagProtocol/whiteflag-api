# Whiteflag API

![GitHub latest release](https://img.shields.io/github/v/release/whiteflagprotocol/whiteflag-api?label=latest&logo=github&sort=semver)
![GitHub dev version](https://img.shields.io/github/package-json/v/whiteflagprotocol/whiteflag-api/develop?label=development&logo=github)
![Ubuntu Test](https://github.com/WhiteflagProtocol/whiteflag-api/workflows/Ubuntu%20Test/badge.svg)
![Windows Test](https://github.com/WhiteflagProtocol/whiteflag-api/workflows/Windows%20Test/badge.svg)

## Introduction

Whiteflag is a fully neutral and secure communications means based on
blockchain technology. It enables near real-time communication in armed
conflicts and disasters to exchange early warning and status information
to create shared situational awareness.

This Whiteflag Application Programming Interface (API) is a [Node.js](https://nodejs.org/en/about/)
software implementation of the API layer that provides an interface with the
Whiteflag messaging network on one or more underlying blockchains. In other
words, it acts as a message transceiver between one or more blockchains and
one or more end-user applications. For interaction with an end-user application,
two methods are used:

* the [REST API](https://en.wikipedia.org/wiki/Representational_state_transfer)
  is the main interface to send Whiteflag messages on the blockchain and manage
  blockchain accounts, authentication, encryption keys, etc.;
* a [web socket](https://en.wikipedia.org/wiki/WebSocket) is
  available for clients to listen for incoming Whiteflag messages from a
  blockchain.

The current version is based on **v1-draft.6** of the Whiteflag protocol. The
supported Whiteflag protocol features are described in `SCOPE.md`.

Note that the Whiteflag API is a so called Minimum Viable Product (MVP).
This means that it only supports the core features of the Whiteflag protocol
and nothing more. As such, it serves as the reference implementation of the
Whiteflag protocol, but it is not designed and tested for secure usage
and performance in a production environment.

## Documentation

More detailed documentation of the API is available at [Github Pages](https://whiteflagprotocol.github.io/whiteflag-api/)

This documentation is also found in the markdown files in the `docs/`
directory. When the API is running, the server will also provide the OpenAPI
definition at the URL root (e.g. `http://localhost:5746/`).

The repository structure and development guidelines for the source code are
described in `CONTRIBUTING.md`.

## License

The Whiteflag API software is dedicated to the public domain
under the [Creative Commons CC0-1.0 Universal Public Domain Dedication](http://creativecommons.org/publicdomain/zero/1.0/)
statement. See `LICENSE.md` for details.

The Whiteflag API software requires third party software packages, which are
not part of this distribution and may be licenced differently.

## Installation

### Prerequisites

To deploy the Whiteflag API, make sure the following prerequisite software
is installed:

* [Node.js](https://nodejs.org/en/about/) [version 16 or higher](https://nodejs.org/en/about/releases/), including [NPM](https://www.npmjs.com/get-npm)
* [MongoDB](https://www.mongodb.com/what-is-mongodb), currently only tested with legacy [verson 3.6](https://www.mongodb.com/evolved#mdbthreesix), but higher versions seem to work as well

### Deployment and Testing

First, copy the repository to the deployment directory, such as
`/opt/whiteflag-api`. Please use a version tagged commit for a stable version.

After copying the repository, install the required Node.js modules of external
software libraries and then create a global link to the package by running the
following commands in the deployment directory:

```shell
npm install
npm link
```

To run an automated test of the software, use the following command in the
deployment directory:

```shell
npm test
```

### Configuration

The API uses three optional environment variables:

* `WFLOGLEVEL`: the logging level to be used; if set, it overrides the level set in the `api.toml` configuration file
* `WFCONFDIR`: the directory containing the configuration files; if set, it overrides the default `./config` directory
* `WFPORT`: the server port to be used; if set, it overrides the port set in the `api.toml` configuration file

Configurable parameters of the API can be found in the [TOML](https://github.com/toml-lang/toml)
files in the `config/` directory:

* `api.toml`: for various general API settings, such as hostname, port, etc.
* `blockchains.toml`: for blockchain specific configuration
* `datastores.toml`: for datastore specific configuration
* `whiteflag.toml`: for Whiteflag protocol related parameters

Please see `docs/configuration.md` for more details.

## Running the API

To start the Whitefag API server from the command line, use the `wfapi`
command in the deployment directory:

```shell
wfapi
```

Using the `npm start` command in the deployment directory should also work.

Alternatively, a service may be created. An example `whiteflag-api.service`
for linux systems using `systemctl` cound be found in `etc/`. Enable the
and start the service with:

```shell
sudo systemctl enable ./etc/whiteflag-api.service
sudo service whiteflag-api start
```

## API Functionality

The detailed [OpenAPI](https://swagger.io/specification/) definition can be
found in `static/openapi.json`. The API definition is provided in human
readible format at the root endpoint by the running API; just go to
`http://localhost:5746/` with a browser.

Some of the endpoint functionalities
(see the API defintion for all details):

### Messages

* `/messages`: endpoint to GET an array of all messages contained in the API database
* `/messages/send`: endpoint to POST a new Whiteflag message to be transmitted on the blockchain
* `/messages/send`: endpoint to POST a new Whiteflag as if received the blockchain
* `/messages/encode`: endpoint to POST a Whiteflag message to be encoded
* `/messages/decode`: endpoint to POST a Whiteflag message to be decoded
* `/messages/validate`: endpoint to POST a Whiteflag message to be checked for valid format and reference
* `/messages?transactionHash=<transaction hash>`: endpoint to GET a specific message by its transaction hash

### Blockchains

* `/blockchains`: endpoint to GET the current configuration and state of all blockchains
* `/blockchains/{blockchain}`: endpoint to GET the configuration and state of the specified blockchain
* `/blockchains/{blockchain}/accounts`: endpoint to GET account details or POST a new blockchain account
* `/blockchains/{blockchain}/accounts/{address}` endpoint to PATCH or DELETE to update or remove the specified blockchain account
* `/blockchains/{blockchain}/accounts/{address}/sign`: endpoint to POST a payload to be signed as a Whiteflag authentication signature
* `/blockchains/{blockchain}/accounts/{address}/transfer`: endpoint to POST a transaction to transfer value to another account

### Originators

* `/originators`: endpoint to GET the currently known originators
* `/originators/{address}`: endpoint to GET details of the specified originator

### Signature operations

* `/signature/decode`: endpoint to POST a Whiteflag authentication signature to be decoded
* `/signature/validate`: endpoint to POST a Whiteflag authentication signature to be validated

## Testing and Using the API

A minimal set of automated tests is implemented with the [Mocha](https://mochajs.org/)
test framework. To do a full test and run all the test scripts, use the
following NPM command in the project root:

```shell
npm test
```

In addition, the following tools are useful for manual testing:

* [Postman](https://www.getpostman.com/) for testing of POST and GET method on the endpoints
* an example for testing from the command line:

```shell
curl http://localhost:3000/messages/send -X POST -H "Content-Type:application/json" -d @A1.message.json
```

The API also exposes a webpage with an embedded client side socket listener
that is available on `http://localhost:5746/listen` (default URL) when the
API is running.

When testing on a main blockchain network, the `testMessagesOnly` in
the `[tx]` section of the `whiteflag.toml` configuration file should be set
to `true` to prevent the accidental transmission of real messages.
