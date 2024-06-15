# Whiteflag API Installation and Running

## Prerequisites

To deploy the Whiteflag API, make sure the following prerequisite software
is installed:

* [Node.js](https://nodejs.org/en/about/) including [NPM](https://www.npmjs.com/get-npm)

Since version 1.0.1, the Whiteflag API has a lightweight embedded datastore,
making [MongoDB](https://www.mongodb.com/what-is-mongodb) an optional
dependency.

## Deployment and Testing

First, copy the repository to the deployment directory, such as
`/opt/whiteflag-api`. Please use a version tagged commit for a stable version.

After copying the repository, install the required Node.js modules of external
software libraries by running the following commands in the deployment
directory:

```shell
npm install
```

To run an automated test of the software, use the following command in the
deployment directory:

```shell
npm test
```

## Configuration

Please see the configuration page for details about configuring
the software before running.

## Running the API

Using the `npm start` command in the deployment directory will start the
Whiteflag API service.

Creating a global link to the package will allow to start the Whiteflag API
from the command line with a single command `wfapi`. Create the link with:

```shell
npm link
```

Alternatively, a service may be created that starts the service at boot.
An example `whiteflag-api.service` for linux systems using `systemctl` can be
found in `etc/`. Enable and start the service with:

```shell
sudo systemctl enable ./etc/whiteflag-api.service
sudo service whiteflag-api start
```
