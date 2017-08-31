// These eslint directives prevent the linter from complaining about the use of
// globals or arguments that will be prevent in CouchDB design doc functions
// such as views or validate_doc_update

/* global emit, doc, newDoc, oldDoc, userCtx, secObj */
/*eslint no-unused-vars: ["error", { "vars": "local", "argsIgnorePattern": "doc|newDoc|oldDoc|userCtx|secObj" }]*/


"use strict";

var fluid = require("infusion");

var sjrk = fluid.registerNamespace("sjrk");
require("../src/couchConfig");

fluid.defaults("sjrk.server.couchConfig.example", {
    gradeNames: ["sjrk.server.couchConfig.auto"],
    dbConfig: {
        dbName: "test",
        designDocName: "views"
    },
    dbDocuments: {
        "test1": {
            "message": "Hello, World!",
            "tags": ["Hello", "World", "test"],
            "type": "message"
        },
        "test2": {
            "message": "Goodbye, World!",
            "tags": ["Goodbye", "World"],
            "type": "message"
        },
        // This document will fail to be updated/inserted due to the
        // validation function
        "test3": {
            "message": "I don't have a 'type' field.",
            "tags": ["Invalid"]
        }
    },
    dbViews: {
        "tags": {
            "map": "sjrk.server.couchConfig.example.tagsMapFunction"
        }
    },
    dbValidate: {
        validateFunction: "sjrk.server.couchConfig.example.validateFunction"
    }
});

sjrk.server.couchConfig.example.tagsMapFunction = function (doc) {
    emit("tags", doc.tags);
};


sjrk.server.couchConfig.example.validateFunction = function (newDoc, oldDoc, userCtx, secObj) {
    if (!newDoc.type) {
        throw ({forbidden: "doc.type is required"});
    }
};

sjrk.server.couchConfig.example();
