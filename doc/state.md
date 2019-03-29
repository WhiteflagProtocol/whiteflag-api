# Whiteflag API State

The API has to keep its state of the Whiteflag protocol. This inludes keeping
track of its blockchain status and accounts, known originators, encryption keys
etc. The state is implemented as an in-memory object which is managed by
`lib/protocol/state.js`. The structure of the state is defined in
`lib/protocol/static/state.schema.json`.

## State configuration

All state configuration parameters are in the `[state]` section of the
`config/whiteflag.toml` configuration file.

## State preservation

To preserve the state across restarts of the API, the state object is stored in
the primary datastore. The state may also be written to file, if the
`saveToFile` parameter is set to `true`. The absolute file name inlcuding path
must then be defined with the `file` parameter.

When the API starts and initialises the state, the state is restored from file
if the file exists (regardless whether the `saveToFile` parameter is set to
`true` or not). If the file does not exist, the state is restored from the
primary datastore. If no state is found in either a file or datastore, the API
starts with an empty state.

## State encryption

The state contains sensitive data on which the security of the Whiteflag
data depends. Therefore, the state can and should be encrypted. A Master
Encryption Key (MEK) is used for the encryption of the state. This key is
provided with the `masterKey` parameter in the configuration file.

All secrets and keys that are stored in the state are always encrypted with a
unique Key Encryption Key (KEK) which is derived from the MEK, using a HKDF
function with a salt and the key identifier. The key identifier is a hash of
key specific attributes such as blockchain account and originator address.

The state as a whole can (and should) also be encrypted when stored in a file
or in the primary datastore if `encryption` parameter is set to `true` in the
configuration file. The state will then be encrytpted with a Data Encryption
Key (DEK) which is also derived from the MEK.

Currently it is not possible to change the MEK without losing the state. Also,
please be aware that losing the MEK results in unobtainable keys, including
private blockchain keys and pre-shared encryption keys!!
