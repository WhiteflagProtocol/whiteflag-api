# Whiteflag API Connector for the Fennel parachain

The Whiteflag API natively supports the Fennel blockchain, which is based on
the [Substrate/Polkadot SDK](https://polkadot.com/platform/sdk/).

## Blockchain specifications

Whiteflag message embedding:    (t.b.d.)		 	
Maximum message length:         (t.b.d.) 
Signature algorithm:            sr25519
Transaction hash:               256 bits (64 hexadecimals)
Address encoding:               SS58 address format
Address prefix:                 42 (substrate)
Secret for account creation:    32 byte seed

The signature algorithm `sr25519` is not specified to be used with JWS for
Whiteflag authentication method 1.

## Fennel configuration

The blockchains configuration file `config/blockchains.toml` should contain
the Fennel parachain specific parameters in one of its `[[blockchains]]` sections.

* `name`: the name according to the naming convention: `{name}-{network}`, e.g. `fennel-solonet`
* `module`: the Fennel module in `lib/blockchains`, which should be "fennel"
* `active`: whether the blockchain is active or should be ignored

These parameters manage Fennel parachain accounts:

* `createAccount`: whether to automatically create an account if none exists; default is `false`

For retrieving transactions containing Whiteflag messages from the blockchain,
these parameters may be provided, otherwise default values are used:

* `blockRetrievalInterval`: the time in milliseconds before the Fennel listener tries to retireve the next block; the default is `6000` ms
* `blockRetrievalStart`: the starting block from where to retrieve transactions; if `0` (default) the API resumes a number of blocks before the highest block as configured below
* `blockRetrievalEnd`: the last block from where to retrieve transactions; if `0` (default) the API catches up with the highest block on the node
* `blockRetrievalRestart`: how many blocks before the current highest block the API should look back when (re)starting the API; this prevents that blocks are missed when the API is stopped for a short period
* `blockMaxRetries`: how many times the API should retry to process a block if it fails, e.g. because of a node timeout; default is `0`, which means unlimited retries
* `transactionBatchSize`: how many transactions from a single block the API may process in parallel; default is `64`
* `transactionValue`: the value of a transaction when sending a Whiteflag message; default is `0` ether
* `traceRawTransaction`: whether to show each individual transaction when the loglevel is set to `6` (trace); default is `false` because this results in massive logging

To send and receive Whiteflag messages, the API must be connected to a Fennel
parachain node exposing the [Substrate RPC](https://docs.substrate.io/build/remote-procedure-calls/)
interface. These parameters are used to configure the connection:

* `rpcTimeout`: the timeout for an RPC request in milliseconds; the default is `10000`
* `rpcProtocol`: the protocol via which the RPC interface is available, usually `http` or `https`
* `rpcHost`: the hostname of the Fennel parachain node
* `rpcPort`: the port on which the RPC interface is exposed
* `rpcPath`: optional path to reach the RPC interface
* `rpcUsername`: an optional username for basic http authorization
* `rpcPassword`: an optional password for basic http authorization
