# Whiteflag API Events

The Whiteflag API uses events internally for modules to know when protocol
actions must be triggered. Three main event types are defined in the
`protocol/events.js` module for usage by other modules.

* `rxEvent`
* `txEvent`
* `stateEvent`

## Receive and Transmit Events

The rx and tx events are used by the blockchains, datastores and protocol
modules to bind handlers to incoming and outgoing Whiteflag message processing
steps. This is useful given the complex processing flows, especially for cases
such as encryption, authentication, etc. that require different handling paths
for each message.

Specifically, the `lib/protocol/receive.js` and `lib/protocol/transmit.js`
modules chain the appropriate events to create the processing chains for
incoming and outgoing messages. The `lib/datastores.js` module listens for
these events to store messages as configured in the `config/datastores.toml`
configuration file.

Currently defined rx and tx events are:

| Event               | Direction | Description                                                                                |
|---------------------|-----------|--------------------------------------------------------------------------------------------|
| `error`             | RX, TX    | An error occured when processing the message                                               |
| `messageReceived`   | RX        | A new incoming message has been received from the blockchain or from the REST interface    |
| `messageCommitted`  | TX        | A new outgoing message has been posted on the REST interface or is generated automatically |
| `metadataVerified`  | RX, TX    | The message metadata has been verified and is valid                                        |
| `messageEncrypted`  | RX        | The received message has been encrypted and cannot be decoded immediately                  |
| `messageDecoded`    | RX        | The incoming message has been succesfully decrypted/decoded                                |
| `messageEncoded`    | TX        | The outgoing message has been succesfully encoded/encrypted                                |
| `originatorVerified`| RX        | The originator of the incoming message has been verified                                   |
| `originatorSkipped` | RX        | Verification of the originator of the incoming message has been skipped                    |
| `referenceVerified` | RX, TX    | The message correctly references other messages                                            |
| `referenceSkipped`  | RX, TX    | The way the message references other messages has not been verified                        |
| `messageSent`       | TX        | The outgoing message has been sucessfully transmitted on the blockchain                    |
| `messageProcessed`  | RX, TX    | The processing of the message has been completed                                           |
| `messageUpdated`    | RX, TX    | The message metadata has been updated after initial processing                             |

## State Events

The state event allows to bind handlers to state changes using events; this
is useful when a process does not only want to keep track of some data, but
also wants to trigger required actions when the Whiteflag state changes.

Currently, only the `initialised` and `saved` events are used on startup and
closing respectively.
