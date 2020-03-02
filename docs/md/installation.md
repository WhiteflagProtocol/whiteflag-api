# Whiteflag API Installation and Running

## Prerequisites

To deploy the Whiteflag API, make sure the following prerequisite software
is installed:

* [Node.js](https://nodejs.org/en/about/) including [NPM](https://www.npmjs.com/get-npm)
* [MongoDB](https://www.mongodb.com/what-is-mongodb)

## Deployment and Testing

First, copy the repository to the deployment directory, such as
`/opt/whiteflag-api`. Please use a version tagged commit for a stable version.

After copying the repository, install the required Node.js modules of external
software libraries and then create a global link to the package by running the
following commands in the deployment directory:

```shell
npm install
npm link
```

To run an automated test of the software, use the following command in the
deployment directory:

```shell
npm test
```

## Configuration

Please see [`configuration.md`](configuration.md) for details about configuring
the software before running.

## Running the API

To start the Whitefag API server from the command line, use the `wfapi`
command in the deployment directory:

```shell
wfapi
```

Using the `npm start` command in the deployment directory should also work.

Alternatively, a service may be created. An example `whiteflag-api.service`
for linux systems using `systemctl` cound be found in `etc/`. Enable the
and start the service with:

```shell
sudo systemctl enable ./etc/whiteflag-api.service
sudo service whiteflag-api start
```
