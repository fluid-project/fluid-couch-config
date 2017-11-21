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

var gpii  = fluid.registerNamespace("gpii");

require("gpii-pouchdb");
gpii.pouch.loadTestingSupport();

var jqUnit = require("node-jqunit");

require("../../src/couchConfig");

fluid.defaults("fluid.tests.couchConfig.testCouchConfig", {
    gradeNames: ["fluid.couchConfig.pipeline"],
    couchOptions: {
        couchUrl: "http://localhost:6789",
        dbName: "test-fluid-couch-config-db"
    },
    listeners: {
        onCreate: "fluid.identity",
        onSuccess: "console.log(SUCCESS)",
        onError: "console.log({arguments}.0)"
    },
    dbDocuments: {
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
    dbDesignDocuments: {
        testViews: {
            test: {
                map: "fluid.tests.couchConfig.testMapFunction",
                reduce: "fluid.tests.couchConfig.testReduceFunction"
            },
            validate_doc_update: "fluid.tests.couchConfig.testValidateFunction"
        }
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
                "task": "{couchConfigTest}.couchConfig.createDbIfNotExistAction.doAction",
                "resolve": "jqUnit.assert",
                "resolveArgs": ["Database create/verify was completed successfully"]
            }]
        },
        {
            name: "Test CouchDB document loading",
            expect: 5,
            sequence: [{
                "task": "{couchConfigTest}.couchConfig.createDbIfNotExistAction.doAction",
                "resolve": "jqUnit.assert",
                "resolveArgs": ["Database create/verify was completed successfully"]
            },
            {
                "task": "{couchConfigTest}.couchConfig.updateDocumentsAction.doAction",
                "resolve": "jqUnit.assert",
                "resolveArgs": ["Database documents were created/updated successfully"]
            },
            {
                "func": "fluid.tests.couchConfig.testDbDocument",
                args: ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
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
            expect: 6,
            sequence: [{
                "task": "{couchConfigTest}.couchConfig.createDbIfNotExistAction.doAction",
                "resolve": "jqUnit.assert",
                "resolveArgs": ["Database create/verify was completed successfully"]
            },
            {
                "task": "{couchConfigTest}.couchConfig.updateDesignDocumentAction.doAction",
                "resolve": "jqUnit.assert",
                "resolveArgs": ["Database design document were created/updated successfully"]
            },
            {
                "func": "fluid.tests.couchConfig.testDbView",
                args: ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDesignDocuments",
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
// eslint-disable-next-line no-unused-vars
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

fluid.tests.couchConfig.testDbView = function (dbName, couchUrl, expectedView, completionEvent) {
    var nano = require("nano")(couchUrl);
    var db = nano.use(dbName);

    db.get("_design/testViews", function (err, actualDesignDoc) {
        if (!err) {
            fluid.tests.couchConfig.compareFunctions("The actual view map function is the same as expected", expectedView.testViews.test.map, actualDesignDoc.test.map);
            fluid.tests.couchConfig.compareFunctions("The actual view reduce function is the same as expected", expectedView.testViews.test.reduce, actualDesignDoc.test.reduce);
            fluid.tests.couchConfig.compareFunctions("The actual validate function is the same as expected", expectedView.testViews.validate_doc_update, actualDesignDoc.validate_doc_update);
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
