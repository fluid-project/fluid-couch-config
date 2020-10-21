# couch-config

## What Is This?

Infusion grade for writing CouchDB configs.

Can currently do the following:

* ensure a specified DB exists in a particular Couch instance
* ensure a particular set of initial documents exists
* ensure a particular set of views exists in a design document

## Goals

* Write configurations for Infusion applications using CouchDB, using Infusion
* Integrate with existing Infusion components, such as Kettle
* Don't needlessly create revisions of documents - checks for "equivalence" (document content aside from `_id` and `_rev` values) before updating

## How do I use it?

See [`examples/js/couchConfigBasic.js`](examples/js/couchConfigBasic.js) for an example of usage.

## Tests

To run tests:

* run `npm install` from a command prompt at the project root to install dependencies
* then run `node .\tests\js\couchConfigTests.js` to run the test sequence

The tests set up a mock database using PouchDB which is near-identical in functionality to CouchDB. Do not be alarmed if one or more of the attempts to connect to the mock database fails, as it will automatically retry.

## Notes

* Uses the official CouchDB Node library, [Nano](https://github.com/apache/couchdb-nano).

* Includes a behaviour-based grade (`fluid.couchConfig.retryingBehaviour`) to implement retrying functionality, which is useful when running initial configuration in distributed environments such as containerization
