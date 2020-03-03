# Whiteflag API Configuration

## Environment variables

The following optional environment variables may be used, e.g. when using
different configurations in development environments or when running the API
in a container:

* `WFLOGLEVEL`: the logging level to be used; if set, it overrides the level set in the `api.toml` configuration file
* `WFCONFDIR`: sets the directory containing the configuration files; if set it overrides the default `./config` directory.
* `WFPORT`: sets the server port to be used; if set it overrides the port defined in the `api.toml` configuration file.

## Configuration files

The API is configured with four configuration files in the `config/` directory.
An alternative directory for the configuration files may be set with the
`WFCONFDIR` environment variable.

| Config file       | Purpose                                      |
|-------------------|----------------------------------------------|
|`api.toml`         | General API configuration parameters         |
|`blockchains.toml` | Blockchain specific configuration parameters |
|`datastores.toml`  | Datastore specific configuration parameters  |
|`whiteflag.toml`   | Protocol specific configuration parameters   |

The configuration files are formatted in [TOML](https://github.com/toml-lang/toml).

### General API configuration

This configuration file provides global configuration parameters for the api.

The `[logger]` section parameters are:

* `loglevel`: the log level of the api:
              1=fatal, 2=error, 3=warning, 4=info, 5=debug, 6=trace

The following `[server]` section parameters may be defined:

* `protocol`: either `http` or `https`, default is `http`
* `hostname`: the hostname used by the api, default is no hostname
* `port`: the port on which the api is listening, default is `5746`; may be overriden by the `WFPORT` environment variable

In the `[authorization]` section, basic http authorization can be enabled
by setting a `username` and `password`. Levae empty to disable basic auth.
Please do note that the API is not designed to be directly exposed externally.

The following `[ssl]` parameters are required if the API server protocol
is `https`:

* `keyFile`: file name of the file with private key in PEM format
* `certificateFile`: file name of the file with certificate in PEM format

The following http(s) security options can be set in the `[http]` section:

* `enableCors`: enables Cross-Origin Resource Sharing if the API is (allowed to be) used or embedded by other sites
* `trustProxy`: must be set to true if the API runs behind a reverse proxy; this ensures that http headers are correctly interpreted

The `[socket]` section options control the web socket on which incoming
messages are emitted:

* `enable`: if true, the web socket will be available, otherwise not

The operationId parameters in the `[endpoints]` section are booleans that
allow to enable or disable specific API operations. See the API documentation
for a description of all operations. Note that the `receiveMessage` operationId
only controls the injection of messages through the REST API, and has nothing
to do with receiving messages directly from a blockchain.

### Whiteflag protocol configuration

This configuration file contains Whiteflag protocol related configuration
parameters.

The `[state]` section parameters control the storage of the Whiteflag state:

* `masterKey`: hex representation of the 256 bit key used for encrytpion of keys and state data
* `encryption`: boolean indicating if the state needs to be encrypted
* `saveToFile`: boolean indicating if the state needs to be saced to file
* `file`: filename with path of the state file

The `[tx]` section contains message transmit behaviour parameters:

* `verifyReference`: boolean indicating whether to verify reference before sending message
* `testMessagesOnly`: boolean indicating whether only test messages may be sent (to prevent accidental live message transmission when testing on a main blockchain network)

The `[rx]` message contains message receiving behaviour parameters:

* `verifyOriginator`: boolean indicating whether to verify originator of received message
* `verifyReference`: boolean indicating whether to verify reference of received message

The `[authentication]` section controls the behaviour for all authentication methods

* `strict`: if `true`, then unauthenticated messages are rejected;
            if `false`, then unauthenticated messages are flagged in MetaHeader (default)

The behaviour parameters for authentication method 1 are in
the `[authentication.1]` section:

* `validDomains`: array of domain names that are considered to hold valid authentication signatures; if empty, all domain names are accepted

Encryption paramaters for encryption method X are in
the `[encryption.X]` section:

* `psk`: a pre-shared key, i.e. a secret from which the message encyption key is derived if no other input key material is available; should only be used for testing

### Blockchain configuration

The blockchains configuration file contains both general and specific
blockchain configuration parameters. The `./lib/blockchains/static/blockchains.config.schema.json`
contains a validation schema for the blockchain configuration.

The `[confirmation]` section contains the following parameters that affect
all blockchains:

* `enabled`: boolean whether to track block depth of message for confirmation
* `interval`: interval in ms to check blockdepth of message
* `maxBlockDepth`: maximum block depth after which a message is confirmed
* `updateEachBlock`: if true, block depth is updated in data store for each block, otherwise only when confirmed

Furthermore, the configuration file defines which blockchains are supported,
and the specific parameters for each supported blockchain. Multiple blockchains
with their configurations may be defined with multiple
`[[blockchains]]` sections.

At a minumum, the following parameters must be defined for each blockchain in
the repsective `[[blockchains]]` section:

* `name`: the name by which the blockchain is identified in the software and in loggings; naming convention: `{name}-{network}`, e.g. `bitcoin-testnet` or `ethereum-rinkeby`
* `module`: module that implements the specific logic of the blockchain; modules are located in `./lib/blockchains` and to minimally implement the module methods as described in `./lib/blockchains/static/blockchains-template.js`.
* `active`: whether a blockchain is active or should be ignored
* `createAccount`: true if an account should be created if none exists

Additional blockchain specific parameters may be required by the specific
blockchain module, such as connection details to a full node.

### Datastores configuration

This datastores configuration file allows to define which datastores should be
used to store data. Multiple stores may be defined with multiple
`[[databases]]` sections. At a minumum, the following parameters must be defined
for each datastore as detailed in `./lib/datastores/static/datastores.config.schema.json`.
Additional parameters may be added depending on the database.

* `name`: the name by which the datastore is identified in the software and in loggings
* `module`: module that implements the specific logic of the datastore; modules are located in `./lib/datastores` and to minimally implement the module methods as described in `./lib/datastores/static/datastore-template.js`
* `active`: whether datastore is active or can be ignored
* `primary`: indicates if this is the primary datastore for queries and state information; only one (1) datastore should be used to prevent duplicates
* `rxStoreEvent`: array of rx events on which a message should be stored in datastore, normally `["messageProcessed"]`
* `txStoreEvent`: array of tx events on which a message should be stored in datastore, normally `["messageProcessed"]`
