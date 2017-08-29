/*
Copyright 2017 OCAD University
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://raw.githubusercontent.com/BlueSlug/couch-config/master/LICENSE.txt
*/

/* global fluid, sjrk, jqUnit */

(function ($, fluid) {

    "use strict";

    fluid.defaults("sjrk.server.testCouchConfig", {
        gradeNames: ["sjrk.server.couchConfig"],
        dbConfig: {
            dbName: "testDbForTests",
            designDocName: "testViews"
        }
    });

    fluid.defaults("sjrk.server.testCouchConfigTester", {
        gradeNames: ["fluid.test.testCaseHolder"],
        modules: [{
            name: "Test couch config.",
            tests: [{
                name: "Test CouchDB intializing",
                expect: 0,
                sequence: [{
                    // TODO: fill in with invoker calls and verify results
                    "func": "fluid.identity"
                }]
            }]
        }]
    });

    fluid.defaults("sjrk.server.couchConfigTest", {
        gradeNames: ["fluid.test.testEnvironment"],
        components: {
            couchConfig: {
                type: "sjrk.server.testCouchConfigTester",
                createOnEvent: "{testCouchConfigTester}.events.onTestCaseStart"
            },
            couchConfigTester: {
                type: "sjrk.server.testCouchConfigTester"
            }
        }
    });

    $(document).ready(function () {
        fluid.test.runTests([
            "sjrk.server.couchConfigTest"
        ]);
    });

})(jQuery, fluid);
