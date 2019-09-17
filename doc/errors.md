# Whiteflag API Error Handling

In addition to the standard Node.js JavaScript `Error` class, two additional
classes are exposed by `lib/common/errors.js` to handle processing and protocol
errors.  The `ProcessingError` class is to be used for processing errors,
i.e. operational errors that can and must be expected, such as dealing with
malformed data or bad client requests. The `ProtocolError` class is for the
handling of Whiteflag message format and protocol errors.

## Usage of error classes

The best way to define one or both Whiteflag API error classes within a specific
module, is to require the errors module and use an object destructor as follows:

```javascript
const { ProcessingError, ProtocolError } = require('./common/errors.js');
```

Both classes use a similar constructor:

```javascript
err = new ProcessingError(message, causes, code);
err = new ProtocolError(message, causes, code);
```

with the folloing arguments:

* `message` is similar to the property of the generic Error class, i.e. a string with a human readable description of the error
* `causes` is an additional property in the form of an array that may contain a human readable stack of underlying causes
* `code` is a property of type string, identifying the type of error as described below for both classes

### `ProcessingError` class error codes

* `WF_API_PROCESSING_ERROR`: generic processing error (default)
* `WF_API_BAD_REQUEST`: the request was incomplete or incorrect syntax
* `WF_API_NO_DATA`: the request did not return any (valid) data
* `WF_API_NO_RESOURCE`: could not processess because resource does not exist
* `WF_API_NOT_IMPLEMENTED`: the function is not supported
* `WF_API_NOT_AVAILABLE`: the function is currently not available

### `ProtocolError` class error codes

* `WF_PROTOCOL_ERROR`: generic Whiteflag protocol error (default)
* `WF_METAHEADER_ERROR`: incorrect Whiteflag message metaheader
* `WF_FORMAT_ERROR`: Whiteflag message format error
* `WF_REFERENCE_ERROR`: Whiteflag message reference error
* `WF_AUTH_ERROR`: Whiteflag message authentication error
* `WF_SIGN_ERROR`: Whiteflag signature error
* `WF_ENCRYPTION_ERROR`: Whiteflag encryption error

## Guideline for errors, logging and responses

The following table is a guideline on how error codes, log levels and
http response codes *generally* correspond *if* used in combination.

| Error Class       | Error Code               | Loglevel          | HTTP Status Code |
|-------------------|--------------------------|-------------------|------------------|
| `Error`           |(any)                     | level 2: `error`  | 500              |
| `ProcessingError` |`WF_API_PROCESSING_ERROR` | level 2: `error`  | 400              |
|                   |`WF_API_BAD_REQUEST`      | level 5: `debug`  | 400              |
|                   |`WF_API_NO_DATA`          | level 5: `debug`  | 404              |
|                   |`WF_API_NO_RESOURCE`      | level 5: `debug`  | 404              |
|                   |`WF_API_RESOURCE_CONFLICT`| level 5: `debug`  | 409              |
|                   |`WF_API_NOT_IMPLEMENTED`  | level 5: `debug`  | 501              |
|                   |`WF_API_NOT_AVAILABLE`    | level 3: `warn`   | 503              |
| `ProtocolError`   |`WF_PROTOCOL_ERROR`       | level 5: `debug`  | 400              |
|                   |`WF_METAHEADER_ERROR`     | level 5: `debug`  | 400              |
|                   |`WF_FORMAT_ERROR`         | level 5: `debug`  | 400              |
|                   |`WF_REFERENCE_ERROR`      | level 5: `debug`  | 400              |
|                   |`WF_AUTH_ERROR`           | level 5: `debug`  | 400              |
|                   |`WF_SIGN_ERROR`           | level 5: `debug`  | 400              |
|                   |`WF_ENCRYPTION_ERROR`     | level 5: `debug`  | 400              |
