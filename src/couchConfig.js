"use strict";

var fluid = require("infusion");
var isEqual = require("underscore").isEqual;

var sjrk = fluid.registerNamespace("sjrk");

fluid.defaults("sjrk.server.couchConfig.base", {
    gradeNames: ["fluid.component"],
    dbConfig: {
        couchURL: "http://localhost:5984"
    }
});

fluid.defaults("sjrk.server.couchConfig.db", {
    gradeNames: ["sjrk.server.couchConfig.base"],
    dbConfig: {
        // dbName: "targetDB",
    },
    events: {
        // Fired after the component confirms the target DB exists;
        // necessary for sequencing document-related updates
        onDBExists: null
    },
    invokers: {
        ensureDBExists: {
            funcName: "sjrk.server.couchConfig.ensureDBExists",
            args: ["{that}.options.dbConfig.couchURL", "{that}.options.dbConfig.dbName", "{that}.events.onDBExists"]
        }
    }
});

fluid.defaults("sjrk.server.couchConfig.documents", {
    gradeNames: ["sjrk.server.couchConfig.base"],
    dbDocuments: {
        // "test1": {
        //     "message": "Hello, World!",
        //     "tags": ["Hello", "World", "test"]
        // }
    },
    invokers: {
        updateDocuments: {
            funcName: "sjrk.server.couchConfig.updateDocuments",
            args: ["{that}.options.dbDocuments", "{that}.options.dbConfig.couchURL", "{that}.options.dbConfig.dbName"]
        }
    }
});

fluid.defaults("sjrk.server.couchConfig.designDocument", {
    gradeNames: ["sjrk.server.couchConfig.base"],
    events: {
        // Fired after the design document is updated
        // necessary for making sure documents aren't pushed before a
        // validation function is in place
        onDesignDocUpdated: null
    },
    invokers: {
        generateViews: {
            funcName: "sjrk.server.couchConfig.generateViews",
            args: ["{that}.options.dbViews"]
        },
        updateDesignDoc: {
            funcName: "sjrk.server.couchConfig.updateDesignDoc",
            args: ["@expand:{that}.generateViews()", "{that}.options.dbValidate.validateFunction", "{that}.options.dbConfig.couchURL", "{that}.options.dbConfig.dbName", "{that}.options.dbConfig.designDocName", "{that}.events.onDesignDocUpdated"]
        }
    },
    dbConfig: {
        // designDocName: "views"
    },
    // Set in derived grade - map / reduce can be a function reference or a
    // function name as string. CouchDB's internal reduce functions can also
    // be used by name in the reduce key
    dbViews: {
        // count: {
        //     map: "sjrk.server.couchConfig.countMapFunction",
        //     reduce: "_count"
        // }
    },
    // dbValidate: {
    //     validateFunction: "sjrk.server.couchConfig.validateFunction"
    // },
    // Ensure one or more documents exist; key will be used as the document _id
});

// Convenience grade that calls all the configuration functions at instantiation
fluid.defaults("sjrk.server.couchConfig.auto", {
    gradeNames: ["sjrk.server.couchConfig.db", "sjrk.server.couchConfig.documents", "sjrk.server.couchConfig.designDocument"],
    listeners: {
        "onCreate.ensureDBExists": {
            func: "{that}.ensureDBExists"
        },
        "onDBExists.updateDesignDoc": {
            func: "{that}.updateDesignDoc"
        },
        "onDesignDocUpdated.updateDocuments": {
            func: "{that}.updateDocuments"
        }

    }
});

sjrk.server.couchConfig.updateDocuments = function (documents, couchURL, dbName) {
    if (isEqual(documents, {})) {
        console.log("No documents to update");
        return;
    }

    console.log("Updating documents at for DB " + dbName + " in Couch instance at " + couchURL);

    var nano = require("nano")(couchURL);
    nano.use(dbName);

    var targetDB = nano.use(dbName);

    fluid.each(documents, function (doc, id) {

        targetDB.get(id, function (err, body) {
            if (!err) {
                console.log("Document " + id + " found");

                var existingDocValues = fluid.censorKeys(body, ["_id", "_rev"]);
                var docValuesEqual = isEqual(doc, existingDocValues);
                if (docValuesEqual) {
                    console.log("Document values of " + id + " are equivalent, not updating to avoid needless revisioning");
                    return;
                }

                doc._rev = body._rev;
                targetDB.insert(doc, id, function (err, body) {
                    if (!err) {
                        console.log("Update of document " + id + " inserted");
                        console.log(body);
                    }
                    if (err) {
                        console.log("Update of document " + id + " could not be inserted");
                        console.log(err, body);
                    }
                });
            }
            if (err) {
                console.log("Document " + id + " not found, creating");
                targetDB.insert(doc, id, function (err, body) {
                    if (!err) {
                        console.log("Document " + id + " inserted");
                        console.log(body);
                    }
                    if (err) {
                        console.log("Document " + id + " could not be inserted");
                        console.log(err, body);
                    }
                });
            }
        });
    });
};

sjrk.server.couchConfig.ensureDBExists = function (couchURL, dbName, completionEvent) {
    console.log("Making sure DB " + dbName + " exists in Couch instance at " + couchURL);
    var nano = require("nano")(couchURL);
    nano.db.get(dbName, function (err, body) {
        if (!err) {
            console.log("DB " + dbName + " exists");
            completionEvent.fire();
        } else {
            if (err.statusCode === 404) {
                console.log("DB does not exist, trying to create");
                nano.db.create(dbName, function (err, body) {
                    if (!err) {
                        console.log("DB " + dbName + " created");
                        completionEvent.fire();
                    } else {
                        console.log("DB " + dbName + " could not be created");
                        console.log(err, body);
                    }
                });
            } else {
                console.log("Could not get information about DB " + dbName);
                console.log(err, body);
            }

        }
    });
};

sjrk.server.couchConfig.generateViews = function (viewsObj) {
    var transformedView = fluid.transform(viewsObj, function (desiredView) {
        var transformedFunction = fluid.transform(desiredView, function (viewFunc, funcKey) {
            // The internal CouchDB reduce functions
            if (funcKey === "reduce" && (viewFunc === "_count" || viewFunc === "_sum" || viewFunc === "_stats")) {
                return viewFunc;
            }
            // Direct function references
            if (typeof viewFunc === "function") {
                return viewFunc.toString();
            }
            // Resolve funcNames using fluid.getGlobalValue
            if (typeof viewFunc === "string") {
                var namedFunc = fluid.getGlobalValue(viewFunc);
                return namedFunc.toString();
            }
        });
        return transformedFunction;
    });
    return transformedView;
};

// Generates a base design document
sjrk.server.couchConfig.getBaseDesignDocument = function (designDocName) {
    return {
        _id: "_design/" + designDocName,
        views: {},
        language: "javascript"
    };
};

sjrk.server.couchConfig.updateDesignDoc = function (generatedViews, validateFunction, couchURL, dbName, designDocName, completionEvent) {

    var designDocObj = {};

    if (!isEqual(generatedViews, {})) {
        designDocObj.views = generatedViews;
    }

    if (validateFunction) {
        // Direct function references
        if (typeof validateFunction === "function") {
            designDocObj.validate_doc_update = validateFunction.toString();
        }
        // Resolve funcNames using fluid.getGlobalValue
        if (typeof validateFunction === "string") {
            var namedFunc = fluid.getGlobalValue(validateFunction);
            designDocObj.validate_doc_update = namedFunc.toString();
        }
    }

    if (isEqual(designDocObj, {})) {
        console.log("No design document elements");
        return;
    }

    console.log(fluid.stringTemplate("Updating design document at %couchURL/%dbName/_design/%designDocName with defined views", {couchURL: couchURL, dbName: dbName, designDocName: designDocName}));

    var designDoc;

    var nano = require("nano")(couchURL);

    var targetDB = nano.use(dbName);

    var designDocId = "_design/" + designDocName;

    targetDB.get(designDocId, function (err, body) {
        // Design document exists
        if (!err) {
            console.log("Existing design document found");

            designDoc = body;
            var originaldesignDoc = fluid.copy(designDoc);

            fluid.each(designDocObj, function (designDocItem, designDocItemKey) {
                designDoc[designDocItemKey] = designDocItem;
            });

            var designDocChanged = !isEqual(originaldesignDoc, designDoc);

            if (designDocChanged) {
                targetDB.insert(designDoc, designDocId, function (err, body) {
                    console.log("Design doc has been changed, attempting to update");
                    if (!err) {
                        console.log("Design doc updated successfully");
                        console.log(body);
                        completionEvent.fire();
                    } else {
                        console.log("Error in updating design doc");
                        console.log(err, body);
                    }
                });
            } else {
                console.log("Design document unchanged from existing in CouchDB, not updating");
                completionEvent.fire();
            }
        // Design document does not exist
        } else {
            console.log("Design document not found, creating");
            designDoc = sjrk.server.couchConfig.getBaseDesignDocument(designDocName);

            fluid.each(designDocObj, function (designDocItem, designDocItemKey) {
                designDoc[designDocItemKey] = designDocItem;
            });

            targetDB.insert(designDoc, designDocId, function (err, body) {
                if (!err) {
                    console.log("Design doc created successfully");
                    console.log(body);
                    completionEvent.fire();
                } else {
                    console.log(err, body);
                    console.log("Error in creating design document");
                }
            });
        }
    });

};
