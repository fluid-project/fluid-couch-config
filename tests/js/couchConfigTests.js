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
    components: {
        destroyDbIfExist: {
            type: "fluid.couchConfig.destroyDbIfExist"
        }
    },
    listeners: {
        onCreate: "fluid.identity",
        onSuccess: "fluid.log(SUCCESS)",
        onError: "fluid.log({arguments}.0)"
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
        },
        testDoc3: {
            //this won't fail, as PouchDB doesn't support validate_doc_update
            "noType": "test",
            "key": "value3"
        }
    },
    dbDesignDocuments: {
        testViews: {
            test: {
                map: "fluid.tests.couchConfig.testMapFunction",
                reduce: "fluid.tests.couchConfig.testReduceFunction"
            },
            test2: {
                map: function (doc) {
                    emit(doc, null);
                }
            },
            validate_doc_update: "fluid.tests.couchConfig.testValidateFunction"
        }
    }
});

fluid.defaults("fluid.tests.couchConfig.dbCreateSequenceElement", {
    gradeNames: "fluid.test.sequenceElement",
    sequence: [{
        "task": "{couchConfigTest}.couchConfig.createDbIfNotExistAction.doAction",
        "resolve": "jqUnit.assert",
        "resolveArgs": ["Database create/verify was completed successfully"]
    }]
});

fluid.defaults("fluid.tests.couchConfig.dbDestroySequenceElement", {
    gradeNames: "fluid.test.sequenceElement",
    sequence: [{
        "task": "{couchConfigTest}.couchConfig.destroyDbIfExist.doAction",
        "resolve": "jqUnit.assert",
        "resolveArgs": ["Database destroy was completed successfully"]
    }]
});

fluid.defaults("fluid.tests.couchConfig.dbSetupSequence", {
    gradeNames: "fluid.test.sequence",
    sequenceElements: {
        dbCreate: {
            gradeNames: "fluid.tests.couchConfig.dbCreateSequenceElement",
            priority: "before:sequence"
        },
        dbDestroy: {
            gradeNames: "fluid.tests.couchConfig.dbDestroySequenceElement",
            priority: "after:sequence"
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
            name: "Test CouchDB destruction",
            expect: 1,
            sequence: [{
                "task": "{couchConfigTest}.couchConfig.destroyDbIfExist.doAction",
                "resolve": "jqUnit.assert",
                "resolveArgs": ["Database destroy was completed successfully"]
            }]
            // TODO: determine what occurs when destroy is called again
        },
        {
            name: "Test CouchDB design document loading",
            expect: 7,
            sequenceGrade: "fluid.tests.couchConfig.dbSetupSequence",
            sequence: [{
                "task": "{couchConfigTest}.couchConfig.updateDesignDocumentAction.doAction",
                "resolve": "fluid.tests.couchConfig.verifyDbViewEquals",
                "resolveArgs": ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDesignDocuments",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Design document verification completed"]
            }]
        },
        {
            name: "Test CouchDB document loading",
            expect: 5,
            sequenceGrade: "fluid.tests.couchConfig.dbSetupSequence",
            sequence: [{
                "task": "{couchConfigTest}.couchConfig.updateDocumentsAction.doAction",
                "resolve": "fluid.tests.couchConfig.verifyDbDocumentEquals",
                "resolveArgs": ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDocuments.testDoc",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Document verification completed"]
            }]
        },
        {
            // If the document is identical, it shouldn't update it
            // TODO: add checking of _rev keys to make sure they don't change either
            name: "Test CouchDB duplicate document loading",
            expect: 8,
            sequenceGrade: "fluid.tests.couchConfig.dbSetupSequence",
            sequence: [{
                "task": "{couchConfigTest}.couchConfig.updateDocumentsAction.doAction",
                "resolve": "fluid.tests.couchConfig.verifyDbDocumentEquals",
                "resolveArgs": ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDocuments.testDoc",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Primary document verification completed"]
            },
            {
                "task": "{couchConfigTest}.couchConfig.updateDocumentsAction.doAction",
                "resolve": "fluid.tests.couchConfig.verifyDbDocumentEquals",
                "resolveArgs": ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDocuments.testDoc",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Subsequent document verification completed"]
            }]
        },
        {
            // If the document is different but ID is identical, it should update it
            name: "Test CouchDB differing document loading on identical IDs",
            expect: 8,
            sequenceGrade: "fluid.tests.couchConfig.dbSetupSequence",
            sequence: [{
                func: "fluid.tests.couchConfig.insertTestDocumentManually",
                args: ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "fluid.tests.couchConfig.verifyDbDocumentNotEquals",
                args: ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDocuments.testDoc",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Primary document verification completed"]
            },
            {
                "task": "{couchConfigTest}.couchConfig.updateDocumentsAction.doAction",
                "resolve": "fluid.tests.couchConfig.verifyDbDocumentEquals",
                "resolveArgs": ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDocuments.testDoc",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Subsequent document verification completed"]
            }]
        },
        {
            name: "Test CouchDB duplicate design document loading",
            expect: 12,
            sequenceGrade: "fluid.tests.couchConfig.dbSetupSequence",
            sequence: [{
                "task": "{couchConfigTest}.couchConfig.updateDesignDocumentAction.doAction",
                "resolve": "fluid.tests.couchConfig.verifyDbViewEquals",
                "resolveArgs": ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDesignDocuments",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Primary design document verification completed"]
            },
            {
                "task": "{couchConfigTest}.couchConfig.updateDesignDocumentAction.doAction",
                "resolve": "fluid.tests.couchConfig.verifyDbViewEquals",
                "resolveArgs": ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDesignDocuments",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Subsequent design document verification completed"]
            }]
        },
        {
            name: "Test CouchDB differing design document loading on identical IDs",
            expect: 12,
            sequenceGrade: "fluid.tests.couchConfig.dbSetupSequence",
            sequence: [{
                func: "fluid.tests.couchConfig.insertTestDesignDocumentManually",
                args: ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "fluid.tests.couchConfig.verifyDbViewNotEquals",
                args: ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDesignDocuments",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Primary design document verification completed"]
            },
            {
                "task": "{couchConfigTest}.couchConfig.updateDesignDocumentAction.doAction",
                "resolve": "fluid.tests.couchConfig.verifyDbViewEquals",
                "resolveArgs": ["{couchConfigTest}.couchConfig.options.couchOptions.dbName",
                    "{couchConfigTest}.couchConfig.options.couchOptions.couchUrl",
                    "{couchConfigTest}.couchConfig.options.dbDesignDocuments",
                    "{that}.events.nanoCallBackDone"]
            },
            {
                "event": "{that}.events.nanoCallBackDone",
                "listener": "jqUnit.assert",
                args: ["Subsequent design document verification completed"]
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

var preExistingTestDoc = {
    "type": "test",
    "key": "valueDifferent",
    "arrayKey": ["different", "values", "in", "an", "array"]
};

var preExistingTestDesignDoc = {
    test: {
        map: "function (doc) {if (doc.key) {emit(doc.key, null);}}",
        reduce: "function (keys, values, rereduce) {return sum(values);}"
    },
    test2: {
        map: "function (differentDoc) {emit(differentDoc, null);}"
    },
    validate_doc_update: "function (newDoc, oldDoc, userCtx) { throw ({forbidden: \"It's not a test document\"});}"
};

fluid.tests.couchConfig.insertTestDocumentManually = function (dbName, couchUrl, completionEvent) {
    var nano = require("nano")(couchUrl);
    var db = nano.use(dbName);

    // manually insert to the ID of a document that is already defined in the configuration
    db.insert(preExistingTestDoc, "testDoc", function (err) {
        if (!err) {
            fluid.log("Document testDoc inserted successfully");
        } else {
            fluid.log("Error " + err.statusCode + " in inserting document testDoc:" + err);
        }

        completionEvent.fire();
    });
};

fluid.tests.couchConfig.insertTestDesignDocumentManually = function (dbName, couchUrl, completionEvent) {
    var nano = require("nano")(couchUrl);
    var db = nano.use(dbName);

    // manually insert to the ID of a document that is already defined in the configuration
    db.insert(preExistingTestDesignDoc, "_design/testViews", function (err) {
        if (!err) {
            fluid.log("Document _design/testViews inserted successfully");
        } else {
            fluid.log("Error " + err.statusCode + " in inserting document _design/testViews:" + err);
        }

        completionEvent.fire();
    });
};

fluid.tests.couchConfig.verifyDbDocumentEquals = function (dbName, couchUrl, expectedTestDoc, completionEvent) {
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

fluid.tests.couchConfig.verifyDbDocumentNotEquals = function (dbName, couchUrl, unexpectedTestDoc, completionEvent) {
    var nano = require("nano")(couchUrl);
    var db = nano.use(dbName);

    db.get("testDoc", function (err, actualTestDoc) {
        if (!err) {
            jqUnit.assertNotEquals("The actual test document key is different from unexpected", unexpectedTestDoc.key, actualTestDoc.key);
            jqUnit.assertDeepNeq("The actual test document array is different from unexpected", unexpectedTestDoc.arrayKey, actualTestDoc.arrayKey);
        } else {
            jqUnit.fail(err);
        }

        completionEvent.fire();
    });
};

fluid.tests.couchConfig.verifyDbViewEquals = function (dbName, couchUrl, expectedView, completionEvent) {
    var nano = require("nano")(couchUrl);
    var db = nano.use(dbName);

    db.get("_design/testViews", function (err, actualDesignDoc) {
        if (!err) {
            jqUnit.assertTrue("The actual view map function is is the same as expected", fluid.tests.couchConfig.functionsAreIdentical(expectedView.testViews.test.map, actualDesignDoc.test.map));
            jqUnit.assertTrue("The actual view reduce function is is the same as expected", fluid.tests.couchConfig.functionsAreIdentical(expectedView.testViews.test.reduce, actualDesignDoc.test.reduce));
            jqUnit.assertTrue("The actual view inline-specified function is is the same as expected", fluid.tests.couchConfig.functionsAreIdentical(expectedView.testViews.test2.map, actualDesignDoc.test2.map));
            jqUnit.assertTrue("The actual validate_doc_update function is is the same as expected", fluid.tests.couchConfig.functionsAreIdentical(expectedView.testViews.validate_doc_update, actualDesignDoc.validate_doc_update));
        }

        completionEvent.fire();
    });
};

fluid.tests.couchConfig.verifyDbViewNotEquals = function (dbName, couchUrl, unexpectedView, completionEvent) {
    var nano = require("nano")(couchUrl);
    var db = nano.use(dbName);

    db.get("_design/testViews", function (err, actualDesignDoc) {
        if (!err) {
            jqUnit.assertFalse("The actual view map function is different from unexpected", fluid.tests.couchConfig.functionsAreIdentical(unexpectedView.testViews.test.map, actualDesignDoc.test.map));
            jqUnit.assertFalse("The actual view reduce function is different from unexpected", fluid.tests.couchConfig.functionsAreIdentical(unexpectedView.testViews.test.reduce, actualDesignDoc.test.reduce));
            jqUnit.assertFalse("The actual view inline-specified function is different from unexpected", fluid.tests.couchConfig.functionsAreIdentical(unexpectedView.testViews.test2.map, actualDesignDoc.test2.map));
            jqUnit.assertFalse("The actual validate_doc_update function is different from unexpected", fluid.tests.couchConfig.functionsAreIdentical(unexpectedView.testViews.validate_doc_update, actualDesignDoc.validate_doc_update));
        }

        completionEvent.fire();
    });
};

fluid.tests.couchConfig.functionsAreIdentical = function (expectedFunction, actualFunction) {
    var expectedFunctionBody = (function (func) {
        if (typeof func === "function") {
            return func.toString();
        }
        if (typeof func === "string") {
            var namedFunc = fluid.getGlobalValue(func);
            return namedFunc.toString();
        }
    })(expectedFunction);

    var actualFunctionBody = actualFunction.toString();

    return expectedFunctionBody === actualFunctionBody;
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
