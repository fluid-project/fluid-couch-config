/*
Copyright 2017 OCAD University
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://raw.githubusercontent.com/fluid-project/fluid-couch-config/master/LICENSE.txt
*/

/* global fluid */

"use strict";

var fluid = require("infusion");

var gpii  = fluid.registerNamespace("gpii");

require("gpii-pouchdb");
gpii.pouch.loadTestingSupport();

var jqUnit = require("node-jqunit");

require("../../src/couchConfig");

"use strict";

fluid.defaults("fluid.tests.couchConfig.testCouchConfig", {
    gradeNames: ["fluid.couchConfig.db", "fluid.couchConfig.documents", "fluid.couchConfig.designDocument"],
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
            map: "fluid.tests.couchConfig.testMapFunction",
            reduce: "fluid.tests.couchConfig.testReduceFunction"
        }
    },
    dbValidate: {
        validateFunction: "fluid.tests.couchConfig.testValidateFunction"
    }
});

fluid.defaults("fluid.tests.couchConfig.couchConfigTester", {
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
                "func": "fluid.tests.couchConfig.testDbDocument",
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
                "func": "fluid.tests.couchConfig.testDbView",
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
fluid.tests.couchConfig.testValidateFunction = function (newDoc, oldDoc, userCtx) {
    if (!newDoc.type || newDoc.type !== "test") {
        throw ({forbidden: "It's not a test document"});
    }
};

// A basic map function that lists all keys
fluid.tests.couchConfig.testMapFunction = function (doc) {
    if (doc.key) {
        emit(doc.key, null);
    }
};

// A basic reduce function that sums the values
fluid.tests.couchConfig.testReduceFunction = function (keys, values, rereduce) {
    return sum(values);
};

fluid.tests.couchConfig.testDbDocument = function (dbName, couchUrl, expectedTestDoc, completionEvent) {
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

fluid.tests.couchConfig.testDbView = function (dbName, couchUrl, expectedView, expectedValidateFunction, completionEvent) {
    var nano = require("nano")(couchUrl);
    var db = nano.use(dbName);

    db.get("_design/testViews", function (err, actualDesignDoc) {
        if (!err) {
            var expectedMapFunction = expectedView.map;
            var expectedReduceFunction = expectedView.reduce;
            fluid.tests.couchConfig.compareFunctions("The actual view map function is the same as expected", expectedMapFunction, actualDesignDoc.views.test.map);
            fluid.tests.couchConfig.compareFunctions("The actual view reduce function is the same as expected", expectedReduceFunction, actualDesignDoc.views.test.reduce);
            fluid.tests.couchConfig.compareFunctions("The actual validate function is the same as expected", expectedValidateFunction, actualDesignDoc.validate_doc_update);
        }

        completionEvent.fire();
    });
};

fluid.tests.couchConfig.compareFunctions = function (message, expectedFunction, actualFunction) {
    //calling toString makes the line breaks \n's instead of whatever they were before
    var expectedFunctionBody = fluid.getGlobalValue(expectedFunction).toString();
    var actualFunctionBody = actualFunction.toString();

    jqUnit.assertEquals(message, expectedFunctionBody, actualFunctionBody);
};

fluid.defaults("fluid.tests.couchConfig.couchConfigTest", {
    gradeNames: ["gpii.test.pouch.environment"],
    port: 6789,
    components: {
        couchConfig: {
            type: "fluid.tests.couchConfig.testCouchConfig",
            createOnEvent: "{couchConfigTester}.events.onTestCaseStart"
        },
        couchConfigTester: {
            type: "fluid.tests.couchConfig.couchConfigTester"
        }
    },
    listeners: {
        "onCreate.constructFixtures": {
            func: "{that}.events.constructFixtures.fire"
        }
    }
});

fluid.test.runTests("fluid.tests.couchConfig.couchConfigTest");
