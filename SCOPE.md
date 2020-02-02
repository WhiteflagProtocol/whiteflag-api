# Scope for the Whiteflag API

This Whiteflag Application Programming Interface (API) is a [Node.js](https://nodejs.org/en/about/)
software implementation of the API layer that provides an interface with the
Whiteflag messaging network on one or more underlying blockchains.

This Whiteflag API is a so called Minumum Viable Product (MVP). This means
that it only supports the core features of the Whiteflag protocol and
nothing more. The features that are considered in scope for this MVP API
are described below.

## In scope

### Message handling

The API should provide all message handling i.a.w. the standard:

* encoding/sending of all message types (v0.1)
* receiving/decoding of all message types (v0.1)
* syntax (v0.1) and reference (v0.3) checks of all message types
* encryption/decryption (v0.8)

### Blockchain

The API should demonstrate blockchain agnosticy of the protocol by
interfacing with at least two blockchains, namely:

* ethereum (v0.8)
* bitcoin (*planned after v1.0*)

The API is able to read Whiteflag history from the blockchain into database.

### Message Indexing & Storage

To keep track of Whiteflag message on the blockchain, the API should:

* perform storage of Whiteflag messages outside blockchain (v0.6)
* keep track of all references between messages (v0.3) and sequences (v0.5)
* keep track of block depth of Whiteflag messages (v0.9)

### Advanced Protocol Functionality

* Whiteflag authentication method 1 (signature-based):
  * create a Whiteflag digital signature (v0.7)
  * check against internet resource for `A1` messages (v0.8)
* Whiteflag authentication method 2 (token-based) (v1.0)
* manage encryption keys for different originators:
  * pre-shared encryption keys (v0.9)
  * ECDH negotated encryption keys (v0.9)

### API functions

* basic http authorization (v0.8)
* native support for SSL (v0.9)

## Postponed functionality

Protocol features for future development:

* message and area concatination using reference code 3 (*planned after v1.0*)
* processing of `T` messages (*planned after v1.0*)
* checking for correct subject codes (*planned after v1.0*)
* checking for correct object codes (*planned after v1.0*)

## Outside scope

The following functionality is outside the scope of the MVP API.

### Protocol functionality

The following Whiteflag protocol features are not implemented:

* hierarchical deterministic keys and addresses (*not planned*)

### API functionality

The API is not capable of:

* usage of the api by multiple users/originators (*not planned*)
* advanced queries & filtering (*not planned*)
