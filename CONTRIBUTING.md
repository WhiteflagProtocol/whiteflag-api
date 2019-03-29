# Contributing to the Whiteflag API

This Whiteflag Application Programming Interface (API) is a [Node.js](https://nodejs.org/en/about/)
JavaScript software implementation of the API layer that provides an interface
with the Whiteflag messaging network on one or more underlying blockchains.

## Issues and Requests

Please report bugs and file requests by creating an issue in the [GitHub repository](https://github.com/WhiteflagProtocol/whiteflag-api/issues).

## Repository and Code Structure

[NPM](https://www.npmjs.com/) is used to manage the code and all external
library packages. This is done with the [`package.json`](https://docs.npmjs.com/getting-started/using-a-package.json)
file in the project root. The main program file is `whiteflag.js` in the
project root. All other files are organised in the directory structure shown
in the following table.

| Directory       | Purpose                                      |
|-----------------|----------------------------------------------|
|`config/`        | Configuration files; must be [TOML](https://github.com/toml-lang/toml) formatted |
|`etc/`           | OS-specific configuration files              |
|`doc/`           | Documentation; must be [markdown](https://en.wikipedia.org/wiki/Markdown) formatted |
|`lib/`           | Source code modules                          |
|`static/`        | Static content, such as json schemas         |
|`test/`          | Scripts for automated testing                |

The project is not yet organised as an npm module to be used as a library
for integration with other projects.

## Versioning

[Semantic versioning](https://semver.org/) is used for this project.
For available versions, see the [version tags](https://github.com/WhiteflagProtocol/whiteflag-api/tags)
on this repository.

## Testing

Automated testing is implemented with the [Mocha](https://mochajs.org/)
test framework. The directory structure and files names of the test scripts
in `test/` should correrspond with the module names and structure under `lib/`.

To do a full test and run all the test scripts in `test/`, use the following
NPM command in the project root:

```shell
npm test
```

## Code statistics

To get some simple statistics on the lines of code, [cloc](https://github.com/AlDanial/cloc)
is installed automatically by NPM as a development dependency. Run one of the
following commands to respectively get 1. the lines of code from the core in
`lib/` or 2. the total lines of codes (excluding dependencies):

```shell
npm run count
npm run count-all
```

## Coding Style

### Main Style Guide

The Whiteflag API project is written for NodeJS using
[JavaScript Standard Style](https://standardjs.com/),
with the exceptions and additional coding guidance below.

The `.eslintrc.json` file contains the style rules for usage with
[ESLInt](https://eslint.org/).

Modules, classes and functions must be documented in code using [JSDoc](http://usejsdoc.org/).
A comment starting with a `/**` sequence is a JSDoc comment. Non-JSDoc comments
must start with `//` if it is a single line comment, or with `/*` for a
comment block.

### Style Guide Exceptions

The project style has the following deviations from StandardJS:

* indentation of 4 spaces (no tabs!)
* semicolons are used at the end of every statement

### Additional Coding Guidance

1. Look at the existing code as a guidance and example!
2. Declarations: use `const` and `let` for constants and variables;
   do not use `var`
3. Variable naming:
    * capitalise primitive constants: `const BINENCODING = 'hex';`
    * use camelCase, e.g. `wfMessage`, except for classes
    * use an underscore prefix to indicate module scoped variables,
      e.g. `let _config = {}`
4. Variable checks in order of preference:
    * use default parameter syntax in function definitions where possible
    * use a conditional expression, e.g `query = wfMessage.MetaHeader || {}`
    * use an `if` statement with coercion:
      `if (!query) return callback(err);`
5. Use literal syntax for array and object creation: `let log = {};`
6. Use object and array destructuring when creating new references to object items:
   `const { MessageHeader: header, MessageBody: body} = wfMessage;`
7. Use dot notation when accessing properties: `object.propertyName`,
   except when using a variable name: `object[varWithPropertyName]`
8. Use push method and spread operator for array operations
9. Use template strings instead of concatenation
10. Use asynchronous code with callback functions to process results:
    * Functions exposed by a module MUST be asynchronous, except:
    * Functions in `./lib/common` MAY be synchronous and MAY NOT require other project modules
    * Private functions inside a module may be synchronous
11. Always place a `return` statement before invoking a callback:
   `return callback(err, wfMessage);`
12. Do not use `console.log`, but use the functions from the `logger.js` module
13. It is better to use multiple lines if a line is longer than 100 characters:
    * except for strings: do not break strings
    * put logical and concatination operators at the beginning of a new line
14. Comment your code, but avoid commenting the obvious:
    * modules, classes, and functions must be described using JSDoc
    * use an empty line before a comment,
      except in the beginning of or directly after a block
