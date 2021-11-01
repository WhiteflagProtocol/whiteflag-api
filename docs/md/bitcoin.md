# Whiteflag API Connector for Bitcoin

The Whiteflag API natively supports the [Bitcoin](https://bitcoin.org/)
blockchain.

## Accounts

Note that Bitcoin lacks the concept of an account, whereas Whiteflag assumes
an identifiable originator that has an account on a blockchain. Such a
blockchain account is nothing else than a key pair for signing blockchain
transactions, with some related information, e.g. an address, balance etc.
Therefore, what the API calls an account is nothing else than what sometimes
is referred to as a "wallet".

For the purposes of (testing) Whiteflag, the same account, i.e. Bitcoin
address, is reused. This is not a good practice for several reasons, such as
anonimity. However, for Whiteflag it is necessary that different transactions
can be linked to the same originator. Therefore, it is strongly recommended
NOT to use the Whiteflag account for anything else, such as payments or
transfers.

## Bitcoin configuration

The blockchains configuration file `config/blockchains.toml` should contain
the Bitcoin specific parameters in one of its `[[blockchains]]` sections.

* `name`: the name according to the naming convention: `{name}-{network}`, e.g. `bitcoin-main` or `bitcoin-testnet`
* `module`: the Bitcoin module in `lib/blockchains`, which should be "bitcoin"
* `testnet`: whether the Bitcoin testnet is used insted of the main network
* `active`: whether the blockchain is active or should be ignored

These parameters manage Bitcoin blockchain accounts (i.e. wallets):

* `createAccount`: whether to automatically create an account if none exists; default is `false`

For retrieving transactions containing Whiteflag messages from the blockchain,
these parameters may be provided, otherwise default values are used:

* `blockRetrievalInterval`: the time in milliseconds between data retrieval intervals; the default is `60000` ms
* `blockRetrievalStart`: the starting block from where to retrieve transactions; if `0` (default) the API resumes a number of blocks before the highest block as configured below
* `blockRetrievalEnd`: the last block from where to retrieve transactions; if `0` (default) the API catches up with the highest block on the node
* `blockRetrievalRestart`: how many blocks before the current highest block the API should look back when (re)starting the API; this prevents that blocks are missed when the API is stopped for a short period
* `blockMaxRetries`: how many times the API should retry to process a block if it fails, e.g. because of a node timeout; default is `0`, which means unlimited retries
* `transactionBatchSize`: how many transactions from a single block the API may process in parallel; default is `128`
* `transactionFee`: the (minimum) value of a transaction fee when sending a Whiteflag message, used if the fee cannot be estimated or if the estimated fee is lower; default is 1000 satoshis
* `transactionPriority`: the priority used to estimate the transaction fee and defined by the number of blocks by which confirmation is desired: `1` is highest priority, but also a higher transaction fee, if `0` the fixed transaction fee is used
* `traceRawTransaction`: whether to show each individual transaction when the loglevel is set to `6` (trace); default is `false` because this results in massive logging

To send and receive Whiteflag messages, the API must be connected to a Bitcoin
node exposing the standard Bitcoin RPC interface. These parameters are used to
configure the connection:

* `rpcTimeout`: the timeout for an RPC request in milliseconds; the default is `10000`
* `rpcProtocol`: the protocol via which the RPC interface is available, usually `http` or `https`
* `rpcHost`: the hostname of the Bitcoin node
* `rpcPort`: the port on which the RPC interface is exposed
* `rpcPath`: optional path to reach the RPC interface
* `username`: an optional username for basic http authorization
* `password`: an optional password for basic http authorization
