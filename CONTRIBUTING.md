# Contributing to the Whiteflag API

This Whiteflag Application Programming Interface (API) is a [Node.js](https://nodejs.org/en/about/)
JavaScript software implementation of the API layer that provides an interface
with the Whiteflag messaging network on one or more underlying blockchains.

## Issues and Requests

Please report bugs and file requests by creating an issue in the [GitHub repository](https://github.com/WhiteflagProtocol/whiteflag-api/issues).

## Repository and Code Structure

[NPM](https://www.npmjs.com/) is used to manage the code and all external
library packages. This is done with the [`package.json`](https://docs.npmjs.com/getting-started/using-a-package.json)
file in the project root. The main program file is `main.js` in the
project root. The file `index.js` is reserved for later addition when creating
an NPM package exposing Whiteflag functions to be integrated in larger
Node.js projects.

All other files are organised in the directory structure shown
in the following table.

| Directory       | Purpose                                      |
|-----------------|----------------------------------------------|
|`config/`        | Configuration files; must be [TOML](https://github.com/toml-lang/toml) formatted |
|`etc/`           | OS-specific configuration files              |
|`docs/`          | Documentation; must be [markdown](https://en.wikipedia.org/wiki/Markdown) formatted |
|`lib/`           | Source code modules                          |
|`static/`        | Static content, such as json schemas         |
|`test/`          | Scripts for automated testing                |

The project is not yet organised as an npm module to be used as a library
for integration with other projects.

## Versioning

[Semantic versioning](https://semver.org/) is used for this project.
For available versions, see the [version tags](https://github.com/WhiteflagProtocol/whiteflag-api/tags)
on this repository.

Versions in development  use `-dev` as pre-release identifier,
e.g. `1.2.4-dev` indicates that this is a "work in progress" snapshot from
a development branch in between versions 1.2.3 and 1.2.4. Multiple pre-release
identifiers may be used way, e.g. `1.0.0-alpha.3-dev`.

## Git Branches

There are two main branches with infinite lifetime:

* `master` contains the released versions which are pulled from `develop`;
  all releases are tags on the master branch.
* `develop` is the branch in which all development work is brought together
  and merged for integration and testing of new versions, which are pulled
  into master for a new major or minor release (`x.y.0`)
  or new pre-release (`1.0.0-alpha.n`) upon completion.

In addition, a number of support branches with the following
naming conventions may be used:

* `hotfix-<version>` is a branch from `master` in which urgent bugs are fixed
  and then pulled into `master` for a bugfix release (with the `<version>`
  being `1.0.z` for example); a hotfix should also be merged into `develop`.
* `release-<version>` is a branch from `develop` used, as required, for
  integration and testing of a specific major or minor release (with the
  `<version>` being `x.y.0`); upon completion the release is pulled into
  `master` and should also be merged into `develop`.
* `dev/<feature>` is a branch from `develop` in which a specific feature is
  developed; such a branch may exist for a limited period of time for a very
  specific feature, or longer for larger work over multiple major and minor
  versions (e.g. `dev/protocol`, `dev/ethereum`, `dev/bitcoin`); a development
  branch may only be merged into `develop`.

## Testing

Automated testing is implemented with the [Mocha](https://mochajs.org/)
test framework. The directory structure and files names of the test scripts
in `test/` should correspond with the module names and structure under `lib/`.

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

Originally, the project used only [callbacks](https://nodejs.dev/learn/javascript-asynchronous-programming-and-callbacks).
For new modules it is encouraged to use [promises](https://nodejs.dev/learn/understanding-javascript-promises)
instead. Do not mix them: exported functions in a module should either
all use callbacks or all return promises.

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
10. Use asynchronous code (callbacks or promises) to process results:
    * Functions exposed by a module MUST be asynchronous, except:
    * Functions in so called common project modules
      (i.e. either in a directory `common/` or a single module `common.js`)
      MAY be synchronous and MAY ONLY require other common project modules
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
