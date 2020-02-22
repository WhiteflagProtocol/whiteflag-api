---
title: Whiteflag API
language_tabs:
  - shell: Shell
  - http: HTTP
  - javascript: JavaScript
  - javascript--nodejs: Node.JS
  - ruby: Ruby
  - python: Python
  - java: Java
  - go: Go
toc_footers: []
includes: []
search: true
highlight_theme: darkula
headingLevel: 2

---

<h1 id="whiteflag-api">Whiteflag API v1.0.0-alpha.5</h1>

> Scroll down for code samples, example requests and responses. Select a language for code samples from the tabs above or the mobile navigation menu.

This Whiteflag Application Programming Interface (API) is a [Node.js](https://nodejs.org/en/about/) software implementation of the API layer that provides an interface with the Whiteflag messaging network on one or more underlying blockchains. It acts as a message transceiver between one or more blockchains and one or more end-user applications.

This API is a so called Minumum Viable Product (MVP), which means that it only supports the core features of the Whiteflag protocol for development and testing purposes. As such, it serves as the reference implementation of the Whiteflag protocol, but it is not designed and tested for secure usage and performance in a production environment.

Two methods are available for interaction with the API: 1. a [REST API](https://en.wikipedia.org/wiki/Representational_state_transfer) for originators to provide Whiteflag message to be sent on the blockchain, and 2. a [socket.io](https://socket.io/) [web socket](https://en.wikipedia.org/wiki/WebSocket) variant available on `/socket` for clients to listen for incoming Whiteflag messages from a blockchain. A webpage with embedded socket listener is available on [/listen](/listen).

This definition documents the API in [OpenAPI format](https://swagger.io/specification/). The following JSON schemas and specifications are used by this API definition and available with the links below:
* [Whiteflag Protocol specification](protocol/whiteflag.standard.html)
* [Whiteflag Protocol message schema](protocol/message.schema.json)
* [Whiteflag API message metaheader schema](protocol/metaheader.schema.json)
* [Whiteflag API state schema](protocol/state.schema.json)

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

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/messages \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/messages HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/messages',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/messages',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/messages',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/messages', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/messages");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/messages", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /messages`

Returns an array with all incoming and outgoing messages from the primary datastore. This operation may be disabled in the configuration.

<h3 id="getmessages-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|transactionHash|query|string|false|The hash of a blockchain transaction|
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

<h3 id="getmessages-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully processed Whiteflag message query and returning an array of messages|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getmessages-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|[[wfMessage](#schemawfmessage)]|false|none|Array with resulting messages from a database query|
|»» Whiteflag Message|[wfMessage](#schemawfmessage)|false|none|Whiteflag message with MetaHeader as used by the API|
|»»» MetaHeader|any|true|none|none|
|»»» MessageHeader|any|true|none|none|
|»»» MessageBody|any|true|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## sendMessage

<a id="opIdsendMessage"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/messages/send \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/messages/send HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/messages/send',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "MetaHeader": null,
  "MessageHeader": null,
  "MessageBody": null
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/messages/send',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/messages/send',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/messages/send', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/messages/send");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/messages/send", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Succesfully processed the Whiteflag message and returning the message with updated MetaHeader|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="sendmessage-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|[wfMessage](#schemawfmessage)|false|none|Whiteflag message with MetaHeader as used by the API|
|»» MetaHeader|any|true|none|none|
|»» MessageHeader|any|true|none|none|
|»» MessageBody|any|true|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## receiveMessage

<a id="opIdreceiveMessage"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/messages/receive \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/messages/receive HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/messages/receive',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "MetaHeader": null
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/messages/receive',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/messages/receive',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/messages/receive', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/messages/receive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/messages/receive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|body|body|[wfMessageEncoded](#schemawfmessageencoded)|false|Whiteflag message to be decoded/decrypted|

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
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Succesfully processed the Whiteflag message and returning the message with updated MetaHeader|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="receivemessage-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|[wfMessage](#schemawfmessage)|false|none|Whiteflag message with MetaHeader as used by the API|
|»» MetaHeader|any|true|none|none|
|»» MessageHeader|any|true|none|none|
|»» MessageBody|any|true|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## encodeMessage

<a id="opIdencodeMessage"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/messages/encode \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/messages/encode HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/messages/encode',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "MetaHeader": null,
  "MessageHeader": null,
  "MessageBody": null
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/messages/encode',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/messages/encode',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/messages/encode', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/messages/encode");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/messages/encode", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Succesfully processed the Whiteflag message and returning the message with updated MetaHeader|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="encodemessage-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|[wfMessage](#schemawfmessage)|false|none|Whiteflag message with MetaHeader as used by the API|
|»» MetaHeader|any|true|none|none|
|»» MessageHeader|any|true|none|none|
|»» MessageBody|any|true|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## decodeMessage

<a id="opIddecodeMessage"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/messages/decode \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/messages/decode HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/messages/decode',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "MetaHeader": null
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/messages/decode',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/messages/decode',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/messages/decode', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/messages/decode");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/messages/decode", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|body|body|[wfMessageEncoded](#schemawfmessageencoded)|false|Whiteflag message to be decoded/decrypted|

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
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Succesfully processed the Whiteflag message and returning the message with updated MetaHeader|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="decodemessage-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|[wfMessage](#schemawfmessage)|false|none|Whiteflag message with MetaHeader as used by the API|
|»» MetaHeader|any|true|none|none|
|»» MessageHeader|any|true|none|none|
|»» MessageBody|any|true|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## validateMessage

<a id="opIdvalidateMessage"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/messages/validate \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/messages/validate HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/messages/validate',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "MetaHeader": null,
  "MessageHeader": null,
  "MessageBody": null
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/messages/validate',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/messages/validate',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/messages/validate', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/messages/validate");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/messages/validate", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|[[wfMessage](#schemawfmessage)]|false|none|Array with resulting messages from a database query|
|»» Whiteflag Message|[wfMessage](#schemawfmessage)|false|none|Whiteflag message with MetaHeader as used by the API|
|»»» MetaHeader|any|true|none|none|
|»»» MessageHeader|any|true|none|none|
|»»» MessageBody|any|true|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getMessageReferences

<a id="opIdgetMessageReferences"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/messages/references \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/messages/references HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/messages/references',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/messages/references',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/messages/references',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/messages/references', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/messages/references");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/messages/references", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /messages/references`

Returns an array of all Whiteflag messages referencing the message with the given transaction hash. This operation may be disabled in the configuration.

<h3 id="getmessagereferences-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|transactionHash|query|string|false|The hash of a blockchain transaction|

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|[[wfMessage](#schemawfmessage)]|false|none|Array with resulting messages from a database query|
|»» Whiteflag Message|[wfMessage](#schemawfmessage)|false|none|Whiteflag message with MetaHeader as used by the API|
|»»» MetaHeader|any|true|none|none|
|»»» MessageHeader|any|true|none|none|
|»»» MessageBody|any|true|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getMessageSequence

<a id="opIdgetMessageSequence"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/messages/sequence \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/messages/sequence HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/messages/sequence',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/messages/sequence',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/messages/sequence',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/messages/sequence', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/messages/sequence");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/messages/sequence", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /messages/sequence`

Returns an array with the Whiteflag messages in a sequence starting with the message with the given transaction hash. This operation may be disabled in the configuration.

<h3 id="getmessagesequence-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|transactionHash|query|string|false|The hash of a blockchain transaction|

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|[[wfMessage](#schemawfmessage)]|false|none|Array with resulting messages from a database query|
|»» Whiteflag Message|[wfMessage](#schemawfmessage)|false|none|Whiteflag message with MetaHeader as used by the API|
|»»» MetaHeader|any|true|none|none|
|»»» MessageHeader|any|true|none|none|
|»»» MessageBody|any|true|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-blockchains">Blockchains</h1>

Endpoints for operations related to a specific blockchain and blockchain accounts, such as blockchain information settings, account information and authentication signatures.

## getAllBlockchains

<a id="opIdgetAllBlockchains"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/blockchains \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/blockchains HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/blockchains',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/blockchains',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/blockchains',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/blockchains', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/blockchains");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/blockchains", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /blockchains`

Returns an array with all blockchains, regardless of their current status. This operation may be disabled in the configuration.

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

<h3 id="getallblockchains-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved and returning all blockchain configurations and states|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getallblockchains-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getBlockchainState

<a id="opIdgetBlockchainState"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/blockchains/{blockchain} \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/blockchains/{blockchain} HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/blockchains/{blockchain}',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/blockchains/{blockchain}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/blockchains/{blockchain}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/blockchains/{blockchain}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/blockchains/{blockchain}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/blockchains/{blockchain}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getAccounts

<a id="opIdgetAccounts"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/blockchains/{blockchain}/accounts \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/blockchains/{blockchain}/accounts HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/blockchains/{blockchain}/accounts',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/blockchains/{blockchain}/accounts',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/blockchains/{blockchain}/accounts',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/blockchains/{blockchain}/accounts', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/blockchains/{blockchain}/accounts");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/blockchains/{blockchain}/accounts", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /blockchains/{blockchain}/accounts`

Returns the accounts of the specified blockchain. This operation may be disabled in the configuration.

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
  "data": []
}
```

<h3 id="getaccounts-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved and returning all blockchain accounts|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getaccounts-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|array|false|none|Blockchain accounts|
|»» *anonymous*|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## createAccount

<a id="opIdcreateAccount"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/blockchains/{blockchain}/accounts \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/blockchains/{blockchain}/accounts HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/blockchains/{blockchain}/accounts',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "privateKey": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/blockchains/{blockchain}/accounts',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/blockchains/{blockchain}/accounts',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/blockchains/{blockchain}/accounts', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/blockchains/{blockchain}/accounts");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/blockchains/{blockchain}/accounts", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|body|body|[createAccount](#schemacreateaccount)|false|Request to create blockchain account|
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

Status Code **201**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getAccount

<a id="opIdgetAccount"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account} \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account} HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## updateAccount

<a id="opIdupdateAccount"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account} \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
PATCH http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account} HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}',
  method: 'patch',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = 'false';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.patch 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.patch('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## deleteAccount

<a id="opIddeleteAccount"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account} \
  -H 'Accept: application/json'

```

```http
DELETE http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account} HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}',
  method: 'delete',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}',
{
  method: 'DELETE',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.delete 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.delete('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## createSignature

<a id="opIdcreateSignature"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/sign \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/sign HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/sign',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = 'false';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/sign',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/sign',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/sign', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/sign");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/sign", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Succesfully processed the Whiteflag authentication signature and returning the result|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="createsignature-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## transferValue

<a id="opIdtransferValue"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/transfer \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/transfer HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/transfer',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "fromAddress": "string",
  "toAddress": "string",
  "value": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/transfer',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/transfer',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/transfer', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/transfer");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/blockchains/{blockchain}/accounts/{account}/transfer", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

<h3 id="transfervalue-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[transferValue](#schematransfervalue)|false|Request to transfer value to another blockchain account|
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

<h3 id="transfervalue-responses">Responses</h3>

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

<h3 id="transfervalue-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|object|false|none|Value transfer result|
|»» transactionHash|string|false|none|The transaction hash of the value transfer|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-authentication">Authentication</h1>

Endpoints for operations on Whiteflag authentication, such as signature and token creation and validation.

## decodeSignature

<a id="opIddecodeSignature"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/signature/decode \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/signature/decode HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/signature/decode',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = 'false';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/signature/decode',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/signature/decode',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/signature/decode', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/signature/decode");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/signature/decode", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Succesfully processed the Whiteflag authentication signature and returning the result|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="decodesignature-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## verifySignature

<a id="opIdverifySignature"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/signature/verify \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/signature/verify HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/signature/verify',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = 'false';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/signature/verify',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/signature/verify',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/signature/verify', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/signature/verify");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/signature/verify", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Succesfully processed the Whiteflag authentication signature and returning the result|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="verifysignature-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## storeAuthToken

<a id="opIdstoreAuthToken"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/originators/tokens \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/originators/tokens HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/originators/tokens',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "name": "string",
  "blockchain": "string",
  "address": "string",
  "authToken": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/originators/tokens',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/originators/tokens',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/originators/tokens', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/originators/tokens");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/originators/tokens", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /originators/tokens`

Stores a unique pre-shared secret authentication token together with the provided Whiteflag originator data, both used for authentication method 2. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "name": "string",
  "blockchain": "string",
  "address": "string",
  "authToken": "string"
}
```

<h3 id="storeauthtoken-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[storeAuthToken](#schemastoreauthtoken)|false|Request to store a pre-shared secret authentication token for an originator|
|» name|body|string|true|The name of the orginator|
|» blockchain|body|string|true|The name of the blockchain used by the originator|
|» address|body|string|false|The blockchain address of the originator, if already known|
|» authToken|body|string|true|A pre-shared secret authentication token in raw hexadecimal format|

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

Status Code **202**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getAuthToken

<a id="opIdgetAuthToken"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/originators/tokens/{authTokenId} \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/originators/tokens/{authTokenId} HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/originators/tokens/{authTokenId}',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/originators/tokens/{authTokenId}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/originators/tokens/{authTokenId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/originators/tokens/{authTokenId}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/originators/tokens/{authTokenId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/originators/tokens/{authTokenId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## deleteAuthToken

<a id="opIddeleteAuthToken"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE http://{hostname}:{port}/originators/tokens/{authTokenId} \
  -H 'Accept: application/json'

```

```http
DELETE http://{hostname}:{port}/originators/tokens/{authTokenId} HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/originators/tokens/{authTokenId}',
  method: 'delete',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/originators/tokens/{authTokenId}',
{
  method: 'DELETE',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.delete 'http://{hostname}:{port}/originators/tokens/{authTokenId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.delete('http://{hostname}:{port}/originators/tokens/{authTokenId}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/originators/tokens/{authTokenId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "http://{hostname}:{port}/originators/tokens/{authTokenId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

Status Code **202**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## createToken

<a id="opIdcreateToken"></a>

> Code samples

```shell
# You can also use wget
curl -X POST http://{hostname}:{port}/token/create \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST http://{hostname}:{port}/token/create HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/token/create',
  method: 'post',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "blockchain": "string",
  "address": "string",
  "authToken": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/token/create',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post 'http://{hostname}:{port}/token/create',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('http://{hostname}:{port}/token/create', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/token/create");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "http://{hostname}:{port}/token/create", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /token/create`

Creates the non-secret Whiteflag authentication token for authentication method 2. This token is to be used as verification data in an `A2` authentication message by the specified blockchain account. This operation may be disabled in the configuration.

> Body parameter

```json
{
  "blockchain": "string",
  "address": "string",
  "authToken": "string"
}
```

<h3 id="createtoken-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[wfAuthToken](#schemawfauthtoken)|false|Whiteflag Authentication Token|
|» blockchain|body|string|true|The name of the blockchain used by the originator|
|» address|body|string|true|The address of the originator blockchain account with which the token is used|
|» authToken|body|string|true|A pre-shared secret authentication token in raw hexadecimal format|

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
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Succesfully created the Whiteflag authentication token verification data and returning the result|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid request, typically because of a malformed syntax or protocol error|[responseBodyErrors](#schemaresponsebodyerrors)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|
|501|[Not Implemented](https://tools.ietf.org/html/rfc7231#section-6.6.2)|Function not implemented, such as a missing protocol feature or not implemented blockchain|[responseBodyErrors](#schemaresponsebodyerrors)|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Function currently not available, such as unavailable blockchain connection|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="createtoken-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|object|false|none|none|
|»» VerificationData|string|false|none|The authentication token of an originator used as Verification Data in a Whiteflag `A2` authentication message|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-encryption">Encryption</h1>

Endpoints for operations on Whiteflag encryption, such as managing cryptographic keys.

## getPreSharedKey

<a id="opIdgetPreSharedKey"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/originators/{address}/psk/{account} \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/originators/{address}/psk/{account} HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/originators/{address}/psk/{account}',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/originators/{address}/psk/{account}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/originators/{address}/psk/{account}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/originators/{address}/psk/{account}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/originators/{address}/psk/{account}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/originators/{address}/psk/{account}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## storePreSharedKey

<a id="opIdstorePreSharedKey"></a>

> Code samples

```shell
# You can also use wget
curl -X PUT http://{hostname}:{port}/originators/{address}/psk/{account} \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
PUT http://{hostname}:{port}/originators/{address}/psk/{account} HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
var headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/originators/{address}/psk/{account}',
  method: 'put',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "preSharedKey": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/originators/{address}/psk/{account}',
{
  method: 'PUT',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.put 'http://{hostname}:{port}/originators/{address}/psk/{account}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.put('http://{hostname}:{port}/originators/{address}/psk/{account}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/originators/{address}/psk/{account}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PUT");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PUT", "http://{hostname}:{port}/originators/{address}/psk/{account}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|body|body|[storePreSharedKey](#schemastorepresharedkey)|false|Request to store a pre-shared encryption key for an originator|
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

Status Code **202**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## deletePreSharedKey

<a id="opIddeletePreSharedKey"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE http://{hostname}:{port}/originators/{address}/psk/{account} \
  -H 'Accept: application/json'

```

```http
DELETE http://{hostname}:{port}/originators/{address}/psk/{account} HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/originators/{address}/psk/{account}',
  method: 'delete',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/originators/{address}/psk/{account}',
{
  method: 'DELETE',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.delete 'http://{hostname}:{port}/originators/{address}/psk/{account}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.delete('http://{hostname}:{port}/originators/{address}/psk/{account}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/originators/{address}/psk/{account}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "http://{hostname}:{port}/originators/{address}/psk/{account}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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

Status Code **202**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-originators">Originators</h1>

Endpoints for operations on Whiteflag originators, such as authentication and management of shared secrets.

## getAllOriginators

<a id="opIdgetAllOriginators"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/originators \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/originators HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/originators',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/originators',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/originators',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/originators', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/originators");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/originators", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /originators`

Returns the details of all kwown Whiteflag originators.

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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

## getOriginator

<a id="opIdgetOriginator"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/originators/{address} \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/originators/{address} HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/originators/{address}',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/originators/{address}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/originators/{address}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/originators/{address}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/originators/{address}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/originators/{address}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successfully retrieved and returning known Whiteflag originators|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|Authentication is required and was either not provided or has failed|[responseBodyErrors](#schemaresponsebodyerrors)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|Request is not allowed, typically because the operation is disabled in the configuration|[responseBodyErrors](#schemaresponsebodyerrors)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Requested resource not found or no data available|[responseBodyErrors](#schemaresponsebodyerrors)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal error preventing the running API instance to process the request|[responseBodyErrors](#schemaresponsebodyerrors)|

<h3 id="getoriginator-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

<h1 id="whiteflag-api-state">State</h1>

Endpoints for operations on the Whiteflag state of a running API instance.

## getQueue

<a id="opIdgetQueue"></a>

> Code samples

```shell
# You can also use wget
curl -X GET http://{hostname}:{port}/queues/{queue} \
  -H 'Accept: application/json'

```

```http
GET http://{hostname}:{port}/queues/{queue} HTTP/1.1

Accept: application/json

```

```javascript
var headers = {
  'Accept':'application/json'

};

$.ajax({
  url: 'http://{hostname}:{port}/queues/{queue}',
  method: 'get',

  headers: headers,
  success: function(data) {
    console.log(JSON.stringify(data));
  }
})

```

```javascript--nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('http://{hostname}:{port}/queues/{queue}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get 'http://{hostname}:{port}/queues/{queue}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('http://{hostname}:{port}/queues/{queue}', params={

}, headers = headers)

print r.json()

```

```java
URL obj = new URL("http://{hostname}:{port}/queues/{queue}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
        
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "http://{hostname}:{port}/queues/{queue}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

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
  "data": null
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

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|»» additionalProperties|any|false|none|none|
|»» operationId|string|false|none|Unique string defined by the OpenAPI defintion used to identify the operation|
|»» request|object|false|none|Details of the request on the endpoint|
|»»» client|string|false|none|The ip address of the client that made the request|
|»»» method|string|false|none|The HTTP method used to make the request|
|»»» endpoint|string|false|none|The endpoint on which the request has been made|
|»» info|[string]|false|none|Information about how the data was processed|
|»» warnings|[string]|false|none|Warnings generated when processing the request|
|»» errors|[string]|false|none|Errors generated when processing the request|
|» data|any|false|none|none|

*oneOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|any|false|none|none|

*xor*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|any|false|none|none|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
HTTP Authentication
</aside>

# Schemas

<h2 id="tocSwfmessage">wfMessage</h2>

<a id="schemawfmessage"></a>

```json
{
  "MetaHeader": null,
  "MessageHeader": null,
  "MessageBody": null
}

```

*Whiteflag Message*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|MetaHeader|[protocol/metaheader.schema.json](#schemaprotocol/metaheader.schema.json)|true|none|none|
|MessageHeader|[protocol/message.schema.json#/properties/MessageHeader](#schemaprotocol/message.schema.json#/properties/messageheader)|true|none|none|
|MessageBody|[protocol/message.schema.json#/properties/MessageBody](#schemaprotocol/message.schema.json#/properties/messagebody)|true|none|none|

<h2 id="tocSresponsebodymetaobject">responseBodyMetaObject</h2>

<a id="schemaresponsebodymetaobject"></a>

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

*API response metadata*

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

<h2 id="tocSresponsebodyerrorobject">responseBodyErrorObject</h2>

<a id="schemaresponsebodyerrorobject"></a>

```json
[
  "string"
]

```

*API response errors*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|API response errors|[string]|false|none|Errors describing why the request could not succesfully be fulfilled|

<h2 id="tocSresponsebodyerrors">responseBodyErrors</h2>

<a id="schemaresponsebodyerrors"></a>

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

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|meta|[responseBodyMetaObject](#schemaresponsebodymetaobject)|false|none|Meta data about the processing of the request|
|errors|[responseBodyErrorObject](#schemaresponsebodyerrorobject)|false|none|Errors describing why the request could not succesfully be fulfilled|

