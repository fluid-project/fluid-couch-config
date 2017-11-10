/*
Copyright 2017 OCAD University
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://raw.githubusercontent.com/fluid-project/fluid-couch-config/master/LICENSE.txt
*/

/* global emit, sum  */

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
    gradeNames: ["sjrk.server.couchConfig.db", "sjrk.server.couchConfig.documents", "sjrk.server.couchConfig.designDocument"],
    dbConfig: {
        couchURL: "http://localhost:6789",
        dbName: "testDbForTests",
        designDocName: "testViews"
    },
    dbDocuments : {
        testDoc: {
            "type": "test",
            "key": "value",
            "arrayKey": ["values", "in", "an", "array"]
        },
        testDoc2: {
            "type": "test",
            "key": "value2",
            "arrayKey": ["values", "in", "an", "array"]
        }
    },
    dbViews: {
        test: {
            map: "sjrk.server.couchConfigTester.testMapFunction",
            reduce: "sjrk.server.couchConfigTester.testReduceFunction"
        }
    },
    dbValidate: {
        validateFunction: "sjrk.server.couchConfigTester.testValidateFunction"
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
            expect: 5,
            sequence: [{
                "func": "{couchConfigTest}.couchConfig.ensureDBExists"
            },
            {
                "event": "{couchConfig}.events.onDBExists",
                "listener": "{couchConfigTest}.couchConfig.updateDocuments"
            },
            {
                "func": "jqUnit.assertEquals",
                "args": ["Total documents count is expected number", 2, "{couchConfigTest}.couchConfig.totalDocuments"]
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
                    "{couchConfigTest}.couchConfig.options.dbDocuments.testDoc",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["End of test sequence"]
            }]
        },
        {
            name: "Test CouchDB design document loading",
            expect: 5,
            sequence: [{
                "func": "{couchConfigTest}.couchConfig.ensureDBExists"
            },
            {
                "event": "{couchConfig}.events.onDBExists",
                "listener": "{couchConfigTest}.couchConfig.updateDesignDoc"
            },
            {
                "event": "{couchConfig}.events.onDesignDocUpdated",
                "listener": "jqUnit.assert",
                args: ["Database design document was created/updated successfully"]
            },
            {
                "func": "sjrk.server.couchConfigTester.testDbView",
                args: ["{couchConfigTest}.couchConfig.options.dbConfig.dbName",
                    "{couchConfigTest}.couchConfig.options.dbConfig.couchURL",
                    "{couchConfigTest}.couchConfig.options.dbViews.test",
                    "{couchConfigTest}.couchConfig.options.dbValidate.validateFunction",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["End of test sequence"]
            }]
        }]
    }]
});

// A basic validation that checks the document to make sure its 'type' is 'test'
// eslint-disable-next-line no-unused-vars
sjrk.server.couchConfigTester.testValidateFunction = function (newDoc, oldDoc, userCtx) {
    if (!newDoc.type || newDoc.type !== "test") {
        throw ({forbidden: "It's not a test document"});
    }
};

// A basic map function that lists all keys
sjrk.server.couchConfigTester.testMapFunction = function (doc) {
    if (doc.key) {
        emit(doc.key, null);
    }
};

// A basic reduce function that sums the values
// eslint-disable-next-line no-unused-vars
sjrk.server.couchConfigTester.testReduceFunction = function (keys, values, rereduce) {
    return sum(values);
};

sjrk.server.couchConfigTester.testDbDocument = function (dbName, couchUrl, expectedTestDoc, completionEvent) {
    var nano = require("nano")(couchUrl);
    var db = nano.use(dbName);

    db.get("testDoc", function (err, actualTestDoc) {
        if (!err) {
            jqUnit.assertEquals("The actual test document key is the same as expected", expectedTestDoc.key, actualTestDoc.key);
            jqUnit.assertDeepEq("The actual test document array is the same as expected", expectedTestDoc.arrayKey, actualTestDoc.arrayKey);
        }

        completionEvent.fire();
    });
};

sjrk.server.couchConfigTester.testDbView = function (dbName, couchUrl, expectedView, expectedValidateFunction, completionEvent) {
    var nano = require("nano")(couchUrl);
    var db = nano.use(dbName);

    db.get("_design/testViews", function (err, actualDesignDoc) {
        if (!err) {
            var expectedMapFunction = expectedView.map;
            var expectedReduceFunction = expectedView.reduce;
            sjrk.server.couchConfigTester.compareFunctions("The actual view map function is the same as expected", expectedMapFunction, actualDesignDoc.views.test.map);
            sjrk.server.couchConfigTester.compareFunctions("The actual view reduce function is the same as expected", expectedReduceFunction, actualDesignDoc.views.test.reduce);
            sjrk.server.couchConfigTester.compareFunctions("The actual validate function is the same as expected", expectedValidateFunction, actualDesignDoc.validate_doc_update);
        }

        completionEvent.fire();
    });
};

sjrk.server.couchConfigTester.compareFunctions = function (message, expectedFunction, actualFunction) {
    //calling toString makes the line breaks \n's instead of whatever they were before
    var expectedFunctionBody = fluid.getGlobalValue(expectedFunction).toString();
    var actualFunctionBody = actualFunction.toString();

    jqUnit.assertEquals(message, expectedFunctionBody, actualFunctionBody);
};

fluid.defaults("sjrk.server.couchConfigTest", {
    gradeNames: ["gpii.test.pouch.environment"],
    port: 6789,
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
