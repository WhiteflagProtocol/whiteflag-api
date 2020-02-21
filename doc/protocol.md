# Whiteflag API Protocol Implementation

The Whiteflag protocol is implemented with a series of interdependent modules
that can be found under `lib/protocol`. These modules are:

| File                | Purpose                                                         |
|---------------------|-----------------------------------------------------------------|
|`config.js`          | Whiteflag protocol configuration parameters                     |
|`state.js`           | Whiteflag protocol state management                             |
|`transmit.js`        | Message transmit events chain functions                         |
|`receive.js`         | Message receive events chain functions                          |
|`retrieve.js`        | Message retrieval from datastores and blockchains               |
|`codec.js`           | Message encoding and decoding functions                         |
|`crypto.js`          | Whiteflag cryptographic functions                               |
|`validation.js`      | Message format, reference and originator verification functions |
|`authentication.js`  | Whiteflag originator authentication functions                   |
|`management.js`      | Whiteflag protocol management message handler functions         |

Protocol specific configuration parameters are in `whiteflag.toml` which can be
found in the `config/` directory. Static protocol data, such as json schemas
can be found under `lib/protocol/static`.

## Message Format

The format of Whiteflag messages is verified against the protocol specification
by the `validation.js` module. To do this, the module uses the external
`jsonschema` library and the Whiteflag message schema provided with the
protocol. If the message format is valid, the parameter `formatValid` in the
metaheader is set to true, and otherwise to `false`.

## Test Messages

Test message are supported. When testing on a main blockchain network, the
`testMessagesOnly` in the `[tx]` section of the `whiteflag.toml` configuration
file should be set to `true` to prevent the accidental transmission of real
messages.

## Message References

The references of Whiteflag messages are verified against the protocol
specification by the `validation.js` module. To do this, the module first tries
to retrieve the referenced message using the `retrieval.js` module, and then
checks the refrenence against the Whiteflag message schema provided with the
protocol. If the message reference is valid, the parameter `referenceValid` in
the metaheader is set to true, and otherwise to `false`.

The verification of references may be skipped for all incoming and/or outgoing
messages by setting the `rx.verifyReference` and/or `tx.verifyReference`
configuration parameters to `false`, respectively. This should not be done for
operational use.

The reference of certain message types cannot be verified, and reference
verification of those message is therefore always skipped:

* `K11` and `K12` messages referencing encrypted messages
* automatically generated outgoing messages

## Message Originators

The originator of a Whiteflag message is verified against the list of known
originators in the state by the `validation.js` module. It checks if the
blockchain address of incoming messages is known and related to an
authenticated originator. If the message originator is valid, the parameter
`originatorValid` in the metaheader is set to true, and otherwise to `false`.

If the originator cannot be verified and the `authentication.strict`
configuration parameter is set to `true`, the message is dropped.

The verification of the originator may be skipped for all incoming messages by
setting the `rx.verifyOriginator` configuration parameter to `false`. This
should not be done for operational use.

The originator of certain message types cannot be verified, and originator
verification of those message is therefore always skipped:

* `A1` and `A2` messages, which are self-authenticing

## Handling of Management Messages

The handling of management messages is done by `management.js`. This includes:

* further handling of authentication and cryptographic messages as required by
  the protocol specification after they have been processed in the rx event
  chain;
* automatic generation and transmission of messages as required by the
  protocol specification.

Specifically, this inludes:

* authentication of originators upon reception of authentication messages
* automatically sending ECDH public keys after an own authentication message
* processing received ECDH public keys to compute shared secret
* automatically sending initialisation vectors with encrypted messages
* processing received initialisation vectors

## Authentication

The authenticity of an originator is validated with the information from
authentication messages. Incoming authentication messages are automatically
processed by the `management.js` module, which passes the authentication
information to the `authentication.js` module for validation.

The API has an endpoint to provide pre-shared secret authentication tokens
for authentication method 2.

Validated originators are stored in the Whiteflag protocol state, through
the `state.js` module.

## Encryption

The `codec.js` module always passes outgoing and incoming message to the
`crypto.js` module for encryption and decryption. If no encryption or
decrytpion is required, i.e. when the `EncryptionIndicator` in the message
header is set to `0`, the `crypto.js` just passes the message to the
callback.

If the encyrption indicator is set to a valid value, the crypto module encrypts
or decrypts the message. The `recipientAddress` in the `MetaHeader` is used to
determine which encryption secret is to be used as input key material:

* for encryption method `1` (negotiated key), the ECDH shared secret is used
* for encryption method `2` (pre-shared key), a pre-shared secret is used

The `management.js` module automatically sends ECDH public keys to negotiate
a shared secret when an authentication message is sent. The module also handles
incoming ECDH public keys.

The API has an endpoint to provide a pre-shared secret key for each originator.
Instead of specifing the recipient in the metaheader, the pre-shared key for
method 2 may also be provided with the `encryptionKeyInput` in the metaheader,
or otherwise the default key in `config/whiteflag.toml` is used.

The `management.js` module automatically sends initialisation vectors with
encrypted messages and also manages incoming initialisation vectors.
