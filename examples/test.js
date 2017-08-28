/* eslint-env node */
var fluid = require("infusion");
var isEqual = require("underscore").isEqual;

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

var testConfig = sjrk.server.couchConfig.test();
