/* global emit */

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
