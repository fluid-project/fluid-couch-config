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
* Don't needlessly create revisions of documents - checks for "equivalency" (document content aside from `_id` and `_rev` values) before updating

## Notes

Uses the official CouchDB Node library, [Nano](https://github.com/apache/couchdb-nano).

## Usage

See `examples/couchConfigBasic.js` for an example of usage.
