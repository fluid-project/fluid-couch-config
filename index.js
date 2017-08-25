var fluid = require("infusion");
var isEqual = require("underscore").isEqual;

var sjrk = fluid.registerNamespace("sjrk");
require("./src/couchConfig");

fluid.defaults("sjrk.server.couchConfig.test", {
    gradeNames: "sjrk.server.couchConfig",
    dbConfig: {
        dbName: "test",
        designDocName: "views"
    },
    dbDocuments: {
        "test1": {
            "message": "Hello, World!"
        },
        "test2": {
            "message": "Goodbye, World!"
        }
    }
});

var testConfig = sjrk.server.couchConfig.test();

fluid.defaults("sjrk.server.couchConfig.stories", {
    gradeNames: "sjrk.server.couchConfig",
    dbConfig: {
        dbName: "stories",
        designDocName: "views"
    },
    dbViews: {
        titles: {
            map: "sjrk.server.couchConfig.titleMapFunction"
        },
        authors: {
            map: "sjrk.server.couchConfig.authorMapFunction"
        },
        tags: {
            map: "sjrk.server.couchConfig.tagsMapFunction"
        },
        language: {
            map: "sjrk.server.couchConfig.languageMapFunction"
        },
        count: {
            map: "sjrk.server.couchConfig.countMapFunction",
            reduce: "_count"
        }
    }
});

sjrk.server.couchConfig.titleMapFunction = function (doc) {
     emit("title", doc.value.title);
};

sjrk.server.couchConfig.authorMapFunction = function (doc) {
     emit("author", doc.value.author);
};

sjrk.server.couchConfig.tagsMapFunction = function (doc) {
     emit("tags", doc.value.tags);
};

sjrk.server.couchConfig.languageMapFunction = function (doc) {
     emit("language", doc.value.language);
};

sjrk.server.couchConfig.countMapFunction = function (doc) {
    emit("count", 1);
};

// var storiesConfig = sjrk.server.couchConfig.stories();
