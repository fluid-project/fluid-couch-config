// These eslint directives prevent the linter from complaining about the use of
// globals or arguments that will be prevent in CouchDB design doc functions
// such as views or validate_doc_update

/* global emit, doc, newDoc, oldDoc, userCtx, secObj, sum, rereduce */
/*eslint no-unused-vars: ["error", { "vars": "local", "argsIgnorePattern": "rereduce|doc|newDoc|oldDoc|userCtx|secObj" }]*/


"use strict";

var fluid = require("infusion");

var sjrk = fluid.registerNamespace("sjrk");
require("../../src/couchConfig");

fluid.defaults("sjrk.server.couchConfig.example", {
    gradeNames: ["sjrk.server.couchConfig.auto"],
    dbConfig: {
        dbName: "test",
        designDocName: "views"
    },
    dbDocuments: {
        "test1": {
            "message": "Hello, World!",
            "tags": ["hello", "world", "test"],
            "type": "message"
        },
        "test2": {
            "message": "Goodbye, World!",
            "tags": ["goodbye", "world", "test"],
            "type": "message"
        },
        // This document will fail to be updated/inserted due to the
        // validation function
        "test3": {
            "message": "I don't have a 'type' field.",
            "tags": ["invalid", "test"]
        }
    },
    dbViews: {
        "docIdsWithMessages": {
            "map": "sjrk.server.couchConfig.example.docIdsWithMessagesMapFunction"
        },
        "tagCount": {
            "map": "sjrk.server.couchConfig.example.tagCountMapFunction",
            "reduce": "sjrk.server.couchConfig.example.tagCountReduceFunction"
        }
    },
    dbValidate: {
        validateFunction: "sjrk.server.couchConfig.example.validateFunction"
    }
});

sjrk.server.couchConfig.example.docIdsWithMessagesMapFunction = function (doc) {
    emit(doc._id, doc.message);
};

sjrk.server.couchConfig.example.tagCountMapFunction = function (doc) {
    if (doc.tags.length > 0) {
        for (var idx in doc.tags) {
            emit(doc.tags[idx], 1);
        }
    }
};

// http://localhost:5984/test/_design/views/_view/tagCount?group=true
sjrk.server.couchConfig.example.tagCountReduceFunction = function (keys, values, rerereduce) {
    return sum(values);
};

sjrk.server.couchConfig.example.validateFunction = function (newDoc, oldDoc, userCtx, secObj) {
    if (!newDoc.type) {
        throw ({forbidden: "doc.type is required"});
    }
};

sjrk.server.couchConfig.example();
