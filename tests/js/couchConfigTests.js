/*
Copyright 2017 OCAD University
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://raw.githubusercontent.com/BlueSlug/couch-config/master/LICENSE.txt
*/

/* global fluid */

"use strict";

var fluid = require("infusion");

var sjrk  = fluid.registerNamespace("sjrk");

var gpii  = fluid.registerNamespace("gpii");

require("gpii-pouchdb");
gpii.pouch.loadTestingSupport();

var jqUnit = require("node-jqunit");

require("../../src/couchConfig");

"use strict";

fluid.defaults("sjrk.server.testCouchConfig", {
    gradeNames: ["sjrk.server.couchConfig.db", "sjrk.server.couchConfig.documents"],
    dbConfig: {
        couchURL: "http://localhost:6789",
        dbName: "testDbForTests",
        designDocName: "testViews"
    },
    dbDocuments : {
        testDoc: {
            "key": "value",
            "arrayKey": ["values", "in", "an", "array"]
        }
    }
});

fluid.defaults("sjrk.server.couchConfigTester", {
    gradeNames: ["fluid.test.testCaseHolder"],
    events: {
        nanoCallBackDone: null
    },
    modules: [{
        name: "Test couch config.",
        tests: [{
            name: "Test CouchDB intializing",
            expect: 1,
            sequence: [{
                "func": "{couchConfigTest}.couchConfig.ensureDBExists"
            },
            {
                "event": "{couchConfig}.events.onDBExists",
                "listener": "jqUnit.assert",
                args: ["Database create/verify was completed successfully"]
            }]
        },
        {
            name: "Test CouchDB document loading",
            expect: 4,
            sequence: [{
                "func": "{couchConfigTest}.couchConfig.ensureDBExists"
            },
            {
                "event": "{couchConfig}.events.onDBExists",
                "listener": "{couchConfigTest}.couchConfig.updateDocuments"
            },
            {
                "event": "{couchConfig}.events.onDocsUpdated",
                "listener": "jqUnit.assert",
                args: ["Database documents were created/updated successfully"]
            },
            {
                "func": "sjrk.server.couchConfigTester.testDbDocument",
                args: ["{couchConfigTest}.couchConfig.options.dbConfig.dbName",
                    "{couchConfigTest}.couchConfig.options.dbConfig.couchURL",
                    "{couchConfigTest}.couchConfig.options.dbDocuments.testDoc", "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["This is the end"]
            }]
        }]
    }]
});

sjrk.server.couchConfigTester.testDbDocument = function (dbName, couchURL, expectedTestDoc, completionEvent) {
    var nano = require("nano")(couchURL);
    var db = nano.use(dbName);

    db.get("testDoc", function (err, actualTestDoc) {
        if (!err) {
            jqUnit.assertEquals("The expected test document key is the same as the one inserted", expectedTestDoc.key, actualTestDoc.key);
            jqUnit.assertDeepEq("The expected test document array is the same as the one inserted", expectedTestDoc.arrayKey, actualTestDoc.arrayKey);
        }

        completionEvent.fire();
    });
};

fluid.defaults("sjrk.server.couchConfigTest", {
    gradeNames: ["gpii.test.pouch.environment"],
    port: 6789,
    //harnessGrades: ["sjrk.server.testCouchConfig"],
    components: {
        couchConfig: {
            type: "sjrk.server.testCouchConfig",
            createOnEvent: "{couchConfigTester}.events.onTestCaseStart"
        },
        couchConfigTester: {
            type: "sjrk.server.couchConfigTester"
        }
    },
    listeners: {
        "onCreate.constructFixtures": {
            func: "{that}.events.constructFixtures.fire"
        }
    }
});

sjrk.server.couchConfigTest.log = function (message) {
    console.log(message);
};

fluid.test.runTests("sjrk.server.couchConfigTest");
