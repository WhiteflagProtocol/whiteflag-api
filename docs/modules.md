# Whiteflag API JavaScript Modules

The Whiteflag API is written in JavaScript to run on [Node.js](https://nodejs.org/en/about/).
The source code of the Whiteflag API is organised in modules. Each module
corresponds with a `.js` source code file. The source code files / modules
are structured in the following directory tree:

| Directory       | Purpose               |
|-----------------|-----------------------|
|`lib`            | Main modules          |
|`lib/endpoints`  | Endpoints modules     |
|`lib/protocol`   | Protocol modules      |
|`lib/blockchains`| Blockchain modules    |
|`lib/datastores` | Datastore modules     |
|`lib/common`     | Common modules        |

See also `README.md` for a general overview of the project, and
`CONTRIBUTING.md` for a description of the repository structure and
development guidelines for the source code.

## Main modules

The main Whiteflag API module is `whiteflag.js`, which initialises all
other main modules in `lib/`:

* `config.js`: the module that reads the api configuration from `config/api.toml`
* `server.js`: the module that opens the network connections and connects the routes and methods to the correct handlers in the endpoints modules
* `blockchains.js`: the module that implements the blockchain abstraction layer, and handles all requests to the configured blockchains
* `datastores.js`: the module that implements the datastores abstraction layer, and handles all requests to the configured databases

## Endpoints modules

The endpoint modules in `lib/endpoints` contain the API endpoint handlers that
call the appropriate functions in the datastores, blockchain and protocol
modules. The `server.js` binds the different endpoint handler functions to
the correct endpoint routes and methods.

## Protocol modules

All Whiteflag protocol features and logic is implemented in the protocol
modules in `lib/protocol`. The protocol implementation is described seperately
in `docs/protocol.md`.

## Blockchain modules

The blockchain modules in `lib/blockchains` implement the connections with
the underlying blockchains. There is one module per supported blockchain.
Functions in a specific blockchain module are called by the main module
`blockchains.js`, which forms the blockchain abstraction layer.

The main module `blockchains.js` should check whether any request to one of
the blockchain modules is correct, and whether the data returning from the
blockchain through the callback function is correct.

A template for creating a new blockchain module to connect to a specific
database is available with `lib/blockchains/static/blockchain.template.js`.
Note that the function names in a blockchain module should reflect the function
names in de main `blockchains.js` module.

The configuration of the blcockchains and the blockchain modules can be found in
`config/blockchains.toml`. This configuration file has a section `[[blockchains]]`
for each blockchain.

## Datastore modules

The datastore modules in lib/datastores implement the connections with the
unbderlying blockchains. There is one module per supported datastore.
Functions in a specific datastore module are called by the main module
`datastores.js`, which forms the datastore abstraction layer.

The main module `datastores.js` should check whether any request to one of
the datastore modules is correct, and whether the data returning from the
datastore through the callback function is correct.

A template for creating a new datastore module to connect to a specific
database is available with `lib/datastores/static/datastore.template.js`.
Note that the function names in a datastore module should reflect the function
names in de main `datastores.js` module.

The configuration of the datastores and the datastore modules can be found in
`config/datastores.toml`. This configuration file has a section `[[databases]]`
for each datastore.

## Common modules

Common modules in `lib/common` are used for function and class definitions
shared by multiple modules across the project. Common modules may not require
other project modules to function.
