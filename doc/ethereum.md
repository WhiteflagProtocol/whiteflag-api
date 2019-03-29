# Whiteflag API Connector for Ethereum

The Whiteflag API natively supports the [Ethereum](https://www.ethereum.org/)
blockchain.

## Ethereum configuration

The blockchains configuration file `config/blockchains.toml` should contain
the Ethereum specific parameters in one of its `[[blockchains]]` sections.

* `name`: the name according to the naming convention: `{name}-{network}`, e.g. `ethereum-main` or `ethereum-rinkeby`
* `module`: the Ethereum module in `lib/blockchains`, which should be "ethereum"
* `active`: whether the blockchain is active or should be ignored

These parameters manage Ethereum blockchain accounts:

* `createAccount`: whether to automatically create an account if none exists; default is `false`

For retrieving transactions containing Whiteflag messages, these parameters
may be provided, otherwise default are used:

* `blockRetrievalInterval`: the time in milliseconds between data retrioeval intervals
* `blockRetrievalStart`: the starting block from where to retrieve transactions; if `0` (default) the API starts with the current highest block
* `blockRetrievalEnd`: the last block from where to retrieve transactions; if `0` (default) the API catches up with the current highest block
* `blockRetrievalRestart`: how many blocks before the current highest block the API should look back when (re)starting the API; this prevents that blocks are missed when the API is stopped for a short period
* `blockMaxRetries`: how many times the API should retry to process a block if it fails, e.g. because of a node timeout; default is `0`, which means unlimited retries
* `transactionBatchSize`: how many transactions from a single block the API may process in parallel; default is `64`
* `transactionValue`: the value of a transaction when sending a Whiteflag message; default is `0` ether
* `traceRawTransaction`: whether to show each individual transaction when the loglevel is set to `6` (trace); default is `false` because this results in massive logging

To connect to a node exposing the standard Ethereum RPC interface, these
parameters must be set:

* `rpcProtocol`: the protocol via which the RPC interface is available, usually `http` or `https`
* `rpcHost`: the hostname of the Ethereum node
* `rpcPort`: the port on which the RPC interface is exposed
* `rpcPath`: optional path to reach the RPC interface
* `username`: an optional username for basic http authorization
* `password`: an optional password for basic http authorization
