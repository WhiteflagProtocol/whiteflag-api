# Whiteflag API Logging

The common module `lib/common/logger.js` exposes functions to be used
throughout the source code for logging messages from the running API.

## Loglevel functions

The logging module exposes a logging function for each loglevel.

| Level | Name    | Usage                                                                                     |
|-------|---------|-------------------------------------------------------------------------------------------|
| `1`   | `fatal` | log an error that caused the process to abort                                             |
| `2`   | `error` | log an error that prevented a specific function to complete, but the process can continue |
| `3`   | `warn`  | log an encountered problem, but the specific function could continue                      |
| `4`   | `info`  | log useful information, typically used for startup and configuration information          |
| `5`   | `debug` | log detailed behaviour during development and for validation                              |
| `6`   | `trace` | log very detailed processing steps for fault isolation                                    |

The loglevel is set in the `config/api.toml` configuration file. All logging
functions will only process the provided logging message if the loglevel is
equal to or higher than the loglevel corresponding with the function.
For example, if the loglevel is set to 3, only the `fatal`, `error`, and `warn`
functions will process the provided log message.

## Logging functionality

Currently, the logging functions only pass the logging information to the
global console, which is a special instance of the JavaScript `Console` class,
whose output is sent to `process.stdout` and `process.stderr`.

## Usage of the log functions

To use the logging function in a module, require the common logger module:

```javascript
const log = require('./common/errors.js');
```

Then use the functions to log messages at the different levels:

```javascript
const MODULELOG = 'someModule';
log.info(MODULELOG, 'This message provides some useful information');
log.debug(MODULELOG, 'This message provides debugging information');
// etc.
```
