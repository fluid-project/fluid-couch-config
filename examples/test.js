/* eslint-env node */
/* global emit */

"use strict";

var fluid = require("infusion");

var sjrk = fluid.registerNamespace("sjrk");
require("../src/couchConfig");

fluid.defaults("sjrk.server.couchConfig.test", {
    gradeNames: ["sjrk.server.couchConfig.auto"],
    dbConfig: {
        dbName: "test",
        designDocName: "views"
    },
    dbDocuments: {
        "test1": {
            "message": "Hello, World!",
            "tags": ["Hello", "World", "test"]
        },
        "test2": {
            "message": "Goodbye, World!",
            "tags": ["Goodbye", "World"]
        }
    },
    dbViews: {
        "tags": {
            "map": "sjrk.server.couchConfig.test.tagsMapFunction"
        }
    }
});

sjrk.server.couchConfig.test.tagsMapFunction = function (doc) {
    emit("tags", doc.tags);
};

sjrk.server.couchConfig.test();
