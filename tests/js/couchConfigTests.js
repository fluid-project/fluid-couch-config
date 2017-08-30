/*
Copyright 2017 OCAD University
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://raw.githubusercontent.com/BlueSlug/couch-config/master/LICENSE.txt
*/

/* global fluid, sjrk, jqUnit */

var fluid = require("infusion");
var sjrk  = fluid.registerNamespace("sjrk");

var gpii  = fluid.registerNamespace("gpii");
require("gpii-pouchdb");
gpii.pouch.loadTestingSupport();

require("../../src/couchConfig");

"use strict";

fluid.defaults("sjrk.server.testCouchConfig", {
    gradeNames: ["sjrk.server.couchConfig.db"],
    dbConfig: {
        couchURL: "http://localhost:6789",
        dbName: "testDbForTests",
        designDocName: "testViews"
    }
});

fluid.defaults("sjrk.server.couchConfigTester", {
    gradeNames: ["fluid.test.testCaseHolder"],
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
                args: ["it fired!"]
            }]
        }]
    }]
});

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
        },
        "onFixturesConstructed.log": {
            "func": "sjrk.server.couchConfigTest.log",
            args: ["Fixtures here!"]
        }
    }
});

sjrk.server.couchConfigTest.log = function (message) {
    console.log(message);
}

//sjrk.server.couchConfigTest();
fluid.test.runTests("sjrk.server.couchConfigTest");
