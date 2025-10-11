---
title: Whiteflag API v1.1.0-dev
language_tabs:
  - shell: Shell
  - http: HTTP
  - javascript: JavaScript
  - ruby: Ruby
  - python: Python
  - php: PHP
  - java: Java
  - go: Go
toc_footers: []
includes: []
search: true
highlight_theme: darkula
headingLevel: 2

---

<!-- Generator: Widdershins v4.0.1 -->

<h1 id="whiteflag-api">Whiteflag API v1.1.0-dev</h1>

> Scroll down for code samples, example requests and responses. Select a language for code samples from the tabs above or the mobile navigation menu.

This Whiteflag Application Programming Interface (API) is a [Node.js](https://nodejs.org/en/about/) software implementation of the API layer that provides an interface with the Whiteflag messaging network on one or more underlying blockchains. It acts as a message transceiver between one or more blockchains and one or more end-user applications.

This API is a so called Minumum Viable Product (MVP), which means that it only supports the core features of the Whiteflag protocol for development and testing purposes. As such, it serves as the reference implementation of the Whiteflag protocol, but it is not designed and tested for secure usage and performance in a production environment.

This definition documents the API in [OpenAPI format](https://swagger.io/specification/).

Two methods are available for interaction with the API: 1. a [REST API](https://en.wikipedia.org/wiki/Representational_state_transfer) for originators to provide Whiteflag message to be sent on the blockchain, and 2. a [socket.io](https://socket.io/) [web socket](https://en.wikipedia.org/wiki/WebSocket) variant available on `/socket` for clients to listen for incoming Whiteflag messages from a blockchain. A running API has a webpage with embedded socket listener available on [/listen](/listen) and the documented source code at [/docs](/docs).

All response bodies are structured as `{meta, data, errors}`, based on the [JSON API Specification](https://jsonapi.org/format/), which has been used as a guideline (and as a guideline only).

Base URLs:

* <a href="http://{hostname}:{port}/">http://{hostname}:{port}/</a>

    * **hostname** - Configurable hostname Default: localhost

    * **port** - Configurable port number Default: 5746

# Authentication

- HTTP Authentication, scheme: basic The API may be configured to use basic HTTP authentication, as specified in [RFC 7617](https://tools.ietf.org/html/rfc7617). It uses the standard `Authorization` field in the HTTP header as follows: `Authorization: Basic <credentials>`, where the credentials are the base64 encoded username and password joined by a single colon: `<username>:<password>`

<h1 id="whiteflag-api-messages">Messages</h1>

Endpoints for operations on Whiteflag messages, such as retrieval, sending, encoding, decoding and validation.

## getMessages

<a id="opIdgetMessages"></a>

`GET /messages`

Returns an array with all incoming and outgoing messages from the primary datastore. The operation accepts MetaHeader fields as optional query parameters. This operation may be disabled in the configuration.

<h3 id="getmessages-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|blockchain|query|string|false|The name of a blockchain|
|transactionHash|query|string|false|The hash of a blockchain transaction|
|originatorAddress|query|string|false|The blockchain address of an originator|
|originatorPubKey|query|string|false|The public key of an originator|
|recipientAddress|query|string|false|The blockchain address of the recipient (only known for decrypted messages)|
|transceiveDirection|query|string|false|The transceive direction indicating if a message has been sent (TX) or has been received (RX)|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": [
    {
      "MetaHeader": null,
      "MessageHeader": null,
      "MessageBody": null
    }
  ]
}
```

<h3 id="getmessages-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed Whiteflag message query and returning an array of messages|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getmessages-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## sendMessage

<a id="opIdsendMessage"></a>

`POST /messages/send`

Transmits a Whiteflag message on a blockchain and returns the result. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "MetaHeader": null,
  "MessageHeader": null,
  "MessageBody": null
}
```

<h3 id="sendmessage-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[wfMessage](#schemawfmessage)|false|Whiteflag message to be send, encoded/ecrypted, or validated|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": {
    "MetaHeader": null,
    "MessageHeader": null,
    "MessageBody": null
  }
}
```

<h3 id="sendmessage-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed the Whiteflag message and returning the message with updated MetaHeader|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="sendmessage-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## receiveMessage

<a id="opIdreceiveMessage"></a>

`POST /messages/receive`

Accepts a Whiteflag message as if received from a blockchain. This may be done for simulation of incoming messages or if a direct connection with a blockchain node is not possible. Typically only used for testing. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "MetaHeader": null
}
```

<h3 id="receivemessage-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|false|Whiteflag message to be decoded/decrypted|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": {
    "MetaHeader": null,
    "MessageHeader": null,
    "MessageBody": null
  }
}
```

<h3 id="receivemessage-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed the Whiteflag message and returning the message with updated MetaHeader|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="receivemessage-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## encodeMessage

<a id="opIdencodeMessage"></a>

`POST /messages/encode`

Encodes a Whiteflag message and returns the result. Typically used for validation and testing, because this is automatically done for outgoing messages. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "MetaHeader": null,
  "MessageHeader": null,
  "MessageBody": null
}
```

<h3 id="encodemessage-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[wfMessage](#schemawfmessage)|false|Whiteflag message to be send, encoded/ecrypted, or validated|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": {
    "MetaHeader": null,
    "MessageHeader": null,
    "MessageBody": null
  }
}
```

<h3 id="encodemessage-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed the Whiteflag message and returning the message with updated MetaHeader|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="encodemessage-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## decodeMessage

<a id="opIddecodeMessage"></a>

`POST /messages/decode`

Decodes a Whiteflag message and returns the result. Typically used for validation and testing, because this is automatically done for incoming messages. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "MetaHeader": null
}
```

<h3 id="decodemessage-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|false|Whiteflag message to be decoded/decrypted|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": {
    "MetaHeader": null,
    "MessageHeader": null,
    "MessageBody": null
  }
}
```

<h3 id="decodemessage-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed the Whiteflag message and returning the message with updated MetaHeader|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="decodemessage-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## validateMessage

<a id="opIdvalidateMessage"></a>

`POST /messages/validate`

Validates the format and reference of a Whiteflag message and returns the result. Typically used for validation and testing, because this is automatically done for incoming and outgoing messages. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "MetaHeader": null,
  "MessageHeader": null,
  "MessageBody": null
}
```

<h3 id="validatemessage-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[wfMessage](#schemawfmessage)|false|Whiteflag message to be send, encoded/ecrypted, or validated|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": [
    {
      "MetaHeader": null,
      "MessageHeader": null,
      "MessageBody": null
    }
  ]
}
```

<h3 id="validatemessage-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed Whiteflag message query and returning an array of messages|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="validatemessage-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getMessageReferences

<a id="opIdgetMessageReferences"></a>

`GET /messages/references`

Returns an array of all Whiteflag messages referencing the message with the given transaction hash. This operation may be disabled in the configuration.

<h3 id="getmessagereferences-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|transactionHash|query|string|true|The hash of a blockchain transaction|
|blockchain|query|string|false|The name of a blockchain|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": [
    {
      "MetaHeader": null,
      "MessageHeader": null,
      "MessageBody": null
    }
  ]
}
```

<h3 id="getmessagereferences-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed Whiteflag message query and returning an array of messages|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getmessagereferences-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getMessageSequence

<a id="opIdgetMessageSequence"></a>

`GET /messages/sequence`

Returns an array with the Whiteflag messages in a sequence starting with the message with the given transaction hash. This operation may be disabled in the configuration.

<h3 id="getmessagesequence-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|transactionHash|query|string|true|The hash of a blockchain transaction|
|blockchain|query|string|false|The name of a blockchain|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": [
    {
      "MetaHeader": null,
      "MessageHeader": null,
      "MessageBody": null
    }
  ]
}
```

<h3 id="getmessagesequence-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed Whiteflag message query and returning an array of messages|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getmessagesequence-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-blockchains">Blockchains</h1>

Endpoints for operations related to a specific blockchain and blockchain accounts, such as blockchain information settings, account information and authentication signatures.

## getAllBlockchains

<a id="opIdgetAllBlockchains"></a>

`GET /blockchains`

Returns an array with the names of all blockchains, regardless of their current status. This operation may be disabled in the configuration.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": [
    "string"
  ]
}
```

<h3 id="getallblockchains-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved and returning the names of all configured blockchains|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getallblockchains-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getBlockchainState

<a id="opIdgetBlockchainState"></a>

`GET /blockchains/{blockchain}`

Returns the configuration and status of the specified blockchain. This operation may be disabled in the configuration.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="getblockchainstate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved and returning the blockchain configuration and status|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getblockchainstate-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getAccounts

<a id="opIdgetAccounts"></a>

`GET /blockchains/{blockchain}/accounts`

Returns an array with all account addresses of the specified blockchain. This operation may be disabled in the configuration.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": [
    "string"
  ]
}
```

<h3 id="getaccounts-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved and returning the addresses of the blockchain accounts|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getaccounts-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## createAccount

<a id="opIdcreateAccount"></a>

`POST /blockchains/{blockchain}/accounts`

Creates a new account for the specified blockchain. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "privateKey": "string"
}
```

<h3 id="createaccount-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|false|Blockchain account data|
|» privateKey|body|string|false|Optional private key in raw hexadecimal format to create account with|

> Example responses

> 201 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="createaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|Successfully created the blockchain account, and returning account data|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|409|[Conflict](https://tools.ietf.org/html/rfc7231#section-6.5.8)|The request conflicts with an already existing resource|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="createaccount-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getAccount

<a id="opIdgetAccount"></a>

`GET /blockchains/{blockchain}/accounts/{account}`

Returns the details of the specified blockchain account. This operation may be disabled in the configuration.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="getaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved, updated or deleted the blockchain account, and returning account data|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getaccount-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## updateAccount

<a id="opIdupdateAccount"></a>

`PATCH /blockchains/{blockchain}/accounts/{account}`

Updates or adds custom properties of the specified blockchain account. Please BE CAREFUL as all attributes can be changed, which may result in an unusable account. This operation may be disabled in the configuration.

> Body parameter

```json
false
```

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="updateaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved, updated or deleted the blockchain account, and returning account data|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="updateaccount-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## deleteAccount

<a id="opIddeleteAccount"></a>

`DELETE /blockchains/{blockchain}/accounts/{account}`

Deletes the specified blockchain account. Please BE CAREFUL as all blockchain data will be unrecoverably deleted. This operation may be disabled in the configuration.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="deleteaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved, updated or deleted the blockchain account, and returning account data|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="deleteaccount-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## createSignature

<a id="opIdcreateSignature"></a>

`POST /blockchains/{blockchain}/accounts/{account}/sign`

Signs a Whiteflag authentication payload for the blockchain address specified in the payload and returns the resulting signature to be used with authentication method 1. This signature should be made available on an internet resource to which an `A1` authentication message refers. This operation may be disabled in the configuration.

> Body parameter

```json
false
```

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="createsignature-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed the Whiteflag authentication signature and returning the result|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="createsignature-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## transferFunds

<a id="opIdtransferFunds"></a>

`POST /blockchains/{blockchain}/accounts/{account}/transfer`

Transfers value to another blockchain account. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "fromAddress": "string",
  "toAddress": "string",
  "value": "string"
}
```

<h3 id="transferfunds-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|false|Data required to transfer value to another blockchain account|
|» fromAddress|body|string|false|The address of the blockchain account to transfer value from|
|» toAddress|body|string|true|The address of the blockchain account to transfer value to|
|» value|body|string|true|Value to be transferred in the main currency of the blockchain|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": {
    "transactionHash": "string"
  }
}
```

<h3 id="transferfunds-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully transferred value to another blockchain account and returning the transaction hash|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="transferfunds-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-authentication">Authentication</h1>

Endpoints for operations on Whiteflag authentication, such as signature and token creation and validation.

## decodeSignature

<a id="opIddecodeSignature"></a>

`POST /signature/decode`

Decodes a Whiteflag authentication signature used for authentication method 1. Typically used for validation and testing, because this is automatically done for incoming messages. This operation may be disabled in the configuration.

> Body parameter

```json
false
```

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="decodesignature-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed the Whiteflag authentication signature and returning the result|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="decodesignature-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## verifySignature

<a id="opIdverifySignature"></a>

`POST /signature/verify`

Verifies a Whiteflag authentication signature used for authentication method 1. Typically used for validation and testing, because this is automatically done for incoming messages. This operation may be disabled in the configuration.

> Body parameter

```json
false
```

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="verifysignature-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed the Whiteflag authentication signature and returning the result|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="verifysignature-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## storeAuthToken

<a id="opIdstoreAuthToken"></a>

`POST /originators/tokens`

Stores a unique pre-shared secret authentication token together with the provided Whiteflag originator data, used for authentication method 2. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "name": "string",
  "blockchain": "string",
  "address": "string",
  "secret": "string"
}
```

<h3 id="storeauthtoken-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|false|Pre-shared secret authentication token data|
|» name|body|string|true|The name of the orginator|
|» blockchain|body|string|true|The name of the blockchain used by the originator|
|» address|body|string|false|The blockchain address of the originator, if already known|
|» secret|body|string|true|A pre-shared secret authentication token in raw hexadecimal format|

> Example responses

> 202 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="storeauthtoken-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|202|[Accepted](https://tools.ietf.org/html/rfc7231#section-6.3.3)|Successfully accepted the new authentication token for the Whiteflag originator|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|409|[Conflict](https://tools.ietf.org/html/rfc7231#section-6.5.8)|The request conflicts with an already existing resource|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="storeauthtoken-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getAuthToken

<a id="opIdgetAuthToken"></a>

`GET /originators/tokens/{authTokenId}`

Checks for the existence of a pre-shared secret authentication token and originator data with the specified token id. This data is used for authentication method 2. This operation may be disabled in the configuration.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="getauthtoken-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|An authentication token for the Whiteflag originator is available|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getauthtoken-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## deleteAuthToken

<a id="opIddeleteAuthToken"></a>

`DELETE /originators/tokens/{authTokenId}`

Deletes the pre-shared secret authentication token and originator data with the specified token id. This data is used for authentication method 2. Please BE CAREFUL as the authentication token will be unrecoverably deleted. This operation may be disabled in the configuration.

> Example responses

> 202 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="deleteauthtoken-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|202|[Accepted](https://tools.ietf.org/html/rfc7231#section-6.3.3)|Successfully accepted the delete request for the authentication token of the Whiteflag originator|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="deleteauthtoken-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## createToken

<a id="opIdcreateToken"></a>

`POST /token/create`

Creates the non-secret Whiteflag verification token for the provided pre-shared secret authentication token used for authentication method 2. The verification token is to be used in, or to validate, the `VerificationData` field of an `A2` authentication message. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "blockchain": "string",
  "address": "string",
  "secret": "string"
}
```

<h3 id="createtoken-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|false|Whiteflag Authentication Token|
|» blockchain|body|string|true|The name of the blockchain used by the originator|
|» address|body|string|true|The address of the originator blockchain account with which the token is used|
|» secret|body|string|true|A pre-shared secret authentication token in raw hexadecimal format|

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": {
    "VerificationData": "string"
  }
}
```

<h3 id="createtoken-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully created the Whiteflag authentication token verification data and returning the result|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="createtoken-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-encryption">Encryption</h1>

Endpoints for operations on Whiteflag encryption, such as managing cryptographic keys.

## getPreSharedKey

<a id="opIdgetPreSharedKey"></a>

`GET /originators/{address}/psk/{account}`

Checks for existence of a pre-shared secret encryption key for the specified Whiteflag originator to be used with the specified blockchain account. This operation may be disabled in the configuration.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="getpresharedkey-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|A pre-shared encryption key for the Whiteflag originator is available|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getpresharedkey-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## storePreSharedKey

<a id="opIdstorePreSharedKey"></a>

`PUT /originators/{address}/psk/{account}`

Stores or updates a pre-shared secret encryption key for the specified Whiteflag originator to be used with the specified blockchain account. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "preSharedKey": "string"
}
```

<h3 id="storepresharedkey-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|false|Pre-shared encryption key data|
|» preSharedKey|body|string|true|A pre-shared secret encryption key in raw hexadecimal format|

> Example responses

> 202 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="storepresharedkey-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|202|[Accepted](https://tools.ietf.org/html/rfc7231#section-6.3.3)|Successfully accepted new or updated pre-shared encryption key for the Whiteflag originator|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="storepresharedkey-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## deletePreSharedKey

<a id="opIddeletePreSharedKey"></a>

`DELETE /originators/{address}/psk/{account}`

Deletes a pre-shared secret encryption key for the specified Whiteflag originator to be used with the specified blockchain account. Please BE CAREFUL as the encryption key will be unrecoverably deleted. This operation may be disabled in the configuration.

> Example responses

> 202 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="deletepresharedkey-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|202|[Accepted](https://tools.ietf.org/html/rfc7231#section-6.3.3)|Successfully accepted the delete request for the pre-shared encryption key for the Whiteflag originators|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="deletepresharedkey-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-originators">Originators</h1>

Endpoints for operations on Whiteflag originators, such as authentication and management of shared secrets.

## getAllOriginators

<a id="opIdgetAllOriginators"></a>

`GET /originators`

Returns the details of all known Whiteflag originators.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="getalloriginators-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved and returning known Whiteflag originators|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getalloriginators-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getOriginator

<a id="opIdgetOriginator"></a>

`GET /originators/{address}`

Returns the details of the specified Whiteflag originator.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="getoriginator-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved and returning known Whiteflag originator|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getoriginator-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## updateOriginator

<a id="opIdupdateOriginator"></a>

`PATCH /originators/{address}`

Updates the details of the specified Whiteflag originator. Only the provided properties will be updated. Please BE CAREFUL as this may result in loss of critical data such as cryptographic keys. This operation may be disabled in the configuration.

> Body parameter

```json
false
```

> Example responses

> 202 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="updateoriginator-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|202|[Accepted](https://tools.ietf.org/html/rfc7231#section-6.3.3)|Successfully accepted the update request for the Whiteflag originator|Inline|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="updateoriginator-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## deleteOriginator

<a id="opIddeleteOriginator"></a>

`DELETE /originators/{address}`

Deletes the specified Whiteflag originator. Please BE CAREFUL as this may result in loss of critical data such as cryptographic keys. This operation may be disabled in the configuration.

> Example responses

> 202 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": null
}
```

<h3 id="deleteoriginator-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|202|[Accepted](https://tools.ietf.org/html/rfc7231#section-6.3.3)|Successfully accepted the delete request for the Whiteflag originator|Inline|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="deleteoriginator-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-state">State</h1>

Endpoints for operations on the Whiteflag state of a running API instance.

## getQueue

<a id="opIdgetQueue"></a>

`GET /queues/{queue}`

Returns the requested queue in the Whiteflag state. The queues used by the API are:
 * `initVectors`: stores the initialiation vectors received with `K` messages until the corresponding encrypted message is received
 * `blockDepths`: tracks the block depth of incoming and outgoing messages until their configured confirmation depth is reached. This operation may be disabled in the configuration.

> Example responses

> 200 Response

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "data": {}
}
```

<h3 id="getqueue-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved and returning the queue of the running API instance|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getqueue-responseschema">Response Schema</h3>

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-protocol">Protocol</h1>

## getWFStandard

<a id="opIdgetWFStandard"></a>

`GET /protocol/whiteflag.standard.html`

Returns the human readible Whiteflag protocol specification in HTML format.

<h3 id="getwfstandard-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getWFMessageSchema

<a id="opIdgetWFMessageSchema"></a>

`GET /protocol/message.schema.json`

Returns the Whiteflag message JSON schema.

<h3 id="getwfmessageschema-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getWFMetaheaderSchema

<a id="opIdgetWFMetaheaderSchema"></a>

`GET /protocol/metaheader.schema.json`

Returns the Whiteflag message metaheader JSON schema.

<h3 id="getwfmetaheaderschema-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getWFSignatureSchema

<a id="opIdgetWFSignatureSchema"></a>

`GET /protocol/signature.schema.json`

Returns Whiteflag authentication signature JSON schema.

<h3 id="getwfsignatureschema-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getWFStateSchema

<a id="opIdgetWFStateSchema"></a>

`GET /protocol/state.schema.json`

Returns the Whiteflag API state JSON schema.

<h3 id="getwfstateschema-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-icons">Icons</h1>

## getIcon

<a id="opIdgetIcon"></a>

`GET /icons/{icon}`

Returns the requested icon corresponding with a message type.

<h3 id="geticon-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

# Schemas

<h2 id="tocS_wfMessage">wfMessage</h2>
<!-- backwards compatibility -->
<a id="schemawfmessage"></a>
<a id="schema_wfMessage"></a>
<a id="tocSwfmessage"></a>
<a id="tocswfmessage"></a>

```json
{
  "MetaHeader": null,
  "MessageHeader": null,
  "MessageBody": null
}

```

Whiteflag Message

### Properties

*None*

<h2 id="tocS_responseBodyMetaObject">responseBodyMetaObject</h2>
<!-- backwards compatibility -->
<a id="schemaresponsebodymetaobject"></a>
<a id="schema_responseBodyMetaObject"></a>
<a id="tocSresponsebodymetaobject"></a>
<a id="tocsresponsebodymetaobject"></a>

```json
{
  "additionalProperties": null,
  "operationId": "string",
  "request": {
    "client": "string",
    "method": "string",
    "endpoint": "string"
  },
  "info": [
    "string"
  ],
  "warnings": [
    "string"
  ],
  "errors": [
    "string"
  ]
}

```

API response metadata

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|additionalProperties|any|false|none|none|
|operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|request|object|false|none|Details of the request on the endpoint|
|» client|string|false|none|The ip address of the client that made the request|
|» method|string|false|none|The HTTP method used to make the request|
|» endpoint|string|false|none|The endpoint on which the request has been made|
|info|[string]|false|none|Information about how the data was processed|
|warnings|[string]|false|none|Warnings generated when processing the request|
|errors|[string]|false|none|Errors generated when processing the request|

<h2 id="tocS_responseBodyErrorObject">responseBodyErrorObject</h2>
<!-- backwards compatibility -->
<a id="schemaresponsebodyerrorobject"></a>
<a id="schema_responseBodyErrorObject"></a>
<a id="tocSresponsebodyerrorobject"></a>
<a id="tocsresponsebodyerrorobject"></a>

```json
[
  "string"
]

```

API response errors

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|API response errors|[string]|false|none|Errors describing why the request could not succesfully be fulfilled|

<h2 id="tocS_responseBodyErrors">responseBodyErrors</h2>
<!-- backwards compatibility -->
<a id="schemaresponsebodyerrors"></a>
<a id="schema_responseBodyErrors"></a>
<a id="tocSresponsebodyerrors"></a>
<a id="tocsresponsebodyerrors"></a>

```json
{
  "meta": {
    "additionalProperties": null,
    "operationId": "string",
    "request": {
      "client": "string",
      "method": "string",
      "endpoint": "string"
    },
    "info": [
      "string"
    ],
    "warnings": [
      "string"
    ],
    "errors": [
      "string"
    ]
  },
  "errors": [
    "string"
  ]
}

```

### Properties

*None*

