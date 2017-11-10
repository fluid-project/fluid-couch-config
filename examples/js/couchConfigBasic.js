// These eslint directives prevent the linter from complaining about the use of
// globals or arguments that will be prevent in CouchDB design doc functions
// such as views or validate_doc_update

/* global emit, doc, newDoc, oldDoc, userCtx, secObj, sum, rereduce */
/*eslint no-unused-vars: ["error", { "vars": "local", "argsIgnorePattern": "rereduce|doc|newDoc|oldDoc|userCtx|secObj" }]*/


"use strict";

var fluid = require("infusion");

require("../../src/couchConfig");

fluid.defaults("fluid.couchConfig.example", {
    gradeNames: ["fluid.couchConfig.auto"],
    dbConfig: {
        dbName: "test",
        designDocName: "views"
    },
    dbDocuments: {
        "test1": {
            "title": "Hello, World!",
            "tags": ["hello", "world", "test"],
            "type": "post"
        },
        "test2": {
            "title": "Goodbye, World!",
            "tags": ["goodbye", "world", "test"],
            "type": "post"
        },
        // This document will fail to be updated/inserted due to the
        // validation function
        "test3": {
            "title": "I don't have a 'type' field. I'm going to fail validation.",
            "tags": ["invalid", "test"]
        }
    },
    dbViews: {
        "docIdsWithTitles": {
            "map": "fluid.couchConfig.example.docIdsWithTitlesMapFunction"
        },
        "tagCount": {
            "map": "fluid.couchConfig.example.tagCountMapFunction",
            "reduce": "fluid.couchConfig.example.tagCountReduceFunction"
        }
    },
    dbValidate: {
        validateFunction: "fluid.couchConfig.example.validateFunction"
    }
});

fluid.couchConfig.example.docIdsWithTitlesMapFunction = function (doc) {
    emit(doc._id, doc.title);
};

// http://localhost:5984/test/_design/views/_view/tagCount?group=true
fluid.couchConfig.example.tagCountMapFunction = function (doc) {
    if (doc.tags.length > 0) {
        for (var idx in doc.tags) {
            emit(doc.tags[idx], 1);
        }
    }
};


fluid.couchConfig.example.tagCountReduceFunction = function (keys, values, rereduce) {
    return sum(values);
};

fluid.couchConfig.example.validateFunction = function (newDoc, oldDoc, userCtx, secObj) {
    if (!newDoc.type) {
        throw ({forbidden: "doc.type is required"});
    }
};

fluid.couchConfig.example();
