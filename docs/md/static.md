# Whiteflag API Static Components

The directory `static/` contains static data provided by the API when running.
This data consists of the Whiteflag API definition, a socket listener for
Whiteflag messages and a Whiteflag signs and signals icon set. The server
provides the static content on the `/` root endpoint, e.g. `http://localhost:5746/`.

In addition, protocol specific static content, such as json schemas, are in
`static/protocol/`. The server provides the static protocol data on the
`/protocol` endpoint, e.g. `http://localhost:5746/protocol/`.

Other static data in `static/` subdirectories may also exists, but this data is
not provided by the server to clients. For example, there is also a
`test/static/` directory, which contains static data for testing, such as the
JSON core schema meta-schema to validate the Whiteflag JSON schemas, which is
done by the `test/static.js` test script.

## Whitflag API Definition

The API definition is specified in `static/openapi.json` in accordance with the
[OpenAPI specification](https://swagger.io/specification/). The `index.html`
uses a standalone JavaScript version of [Redoc](https://github.com/Rebilly/ReDoc)
to render the API defintion into a human readible webpage.

Redoc is not maintained as an NPM package and the following files must
therefore be manually be updated from the source repository
(see the [Redoc documentation](https://github.com/Rebilly/ReDoc/blob/master/README.md)):

* `static/js/redoc.standalone.js`
* `static/js/redoc.standalone.js.map`

## Whitflag API Message Listener

A simple web based message listener is available in `static/listen/`. The
server provides the listener on the `/listen` endpoint,
e.g. `http://localhost:5746/listen`. The listener uses the [socket.io](https://socket.io/)
socket that is provided by the API on the `/socket` endpoint.

The `index.html` loads the client side scripts `/socket/socket.io.js` and
`/listen/listener.js` to connect the browser to the API socket on the `/socket`
endpoint, displaying incoming messages directly on the web page.

## Whiteflag Icons

An icon set for Whiteflag signs and signals can be found in `static/icons/`.
The server provides the icons under the `/icons` endpoint,
e.g. `http://localhost:5746/icons`.

The icons names have the following convention:
`<message code><subject code>.png`.

The icons set does not currently cover all signs and signals from the Whiteflag
protocol specification.
