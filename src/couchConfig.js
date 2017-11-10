/*
Copyright 2017 OCAD University
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://raw.githubusercontent.com/fluid-project/fluid-couch-config/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion");
var isEqual = require("underscore").isEqual;
var size = require("underscore").size;

fluid.defaults("fluid.couchConfig.base", {
    gradeNames: ["fluid.component"],
    dbConfig: {
        couchURL: "http://localhost:5984"
    }
});

fluid.defaults("fluid.couchConfig.db", {
    gradeNames: ["fluid.couchConfig.base"],
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
            funcName: "fluid.couchConfig.db.ensureDBExists",
            args: ["{that}.options.dbConfig.couchURL", "{that}.options.dbConfig.dbName", "{that}.events.onDBExists"]
        }
    }
});

fluid.couchConfig.db.ensureDBExists = function (couchURL, dbName, completionEvent) {
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

fluid.defaults("fluid.couchConfig.documents", {
    dbConfig: {
        // dbName: "targetDB",
    },
    gradeNames: ["fluid.couchConfig.base"],
    // Ensure one or more documents exist; key will be used as the document _id
    dbDocuments: {
        // "test1": {
        //     "message": "Hello, World!",
        //     "tags": ["Hello", "World", "test"]
        // }
    },
    members: {
        totalDocuments: {
            expander: {
                func: "fluid.couchConfig.documents.getTotalDocuments",
                args: "{that}.options.dbDocuments"
            }
        },
        processedDocuments: 0
    },
    events: {
        // Fired after the documents are updated
        // necessary for making sure documents aren't pushed before a
        // validation function is in place
        onDocsUpdated: null,
        onDocumentProcessed: null
    },
    listeners: {
        onDocumentProcessed: {
            func: "fluid.couchConfig.documents.handleOnDocumentProcessed",
            args: ["{that}", "{that}.events.onDocsUpdated"]
        }
    },
    invokers: {
        updateDocuments: {
            funcName: "fluid.couchConfig.documents.updateDocuments",
            args: ["{that}.options.dbDocuments", "{that}.options.dbConfig.couchURL", "{that}.options.dbConfig.dbName", "{that}.events.onDocumentProcessed"]
        }
    }
});

fluid.couchConfig.documents.getTotalDocuments = function (dbDocuments) {
    return size(dbDocuments);
};

fluid.couchConfig.documents.handleOnDocumentProcessed = function (that, completionEvent) {
    that.processedDocuments = that.processedDocuments +1;

    // Document processing complete
    if (that.processedDocuments === that.totalDocuments) {
        that.processedDocuments = 0;
        completionEvent.fire();
    }
};

fluid.couchConfig.documents.updateDocuments = function (documents, couchURL, dbName, completionEvent) {
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
                    completionEvent.fire();
                    return;
                }

                doc._rev = body._rev;
                targetDB.insert(doc, id, function (err, body) {
                    if (!err) {
                        console.log("Update of document " + id + " inserted");
                        console.log(body);
                        completionEvent.fire();
                    }
                    if (err) {
                        console.log("Update of document " + id + " could not be inserted");
                        console.log(err, body);
                        completionEvent.fire();
                    }
                });
            }
            if (err) {
                console.log("Document " + id + " not found, creating");
                targetDB.insert(doc, id, function (err, body) {
                    if (!err) {
                        console.log("Document " + id + " inserted");
                        console.log(body);
                        completionEvent.fire();
                    }
                    if (err) {
                        console.log("Document " + id + " could not be inserted");
                        console.log(err, body);
                        completionEvent.fire();
                    }
                });
            }
        });
    });
};

fluid.defaults("fluid.couchConfig.designDocument", {
    gradeNames: ["fluid.couchConfig.base"],
    events: {
        // Fired after the design document is updated
        // necessary for making sure documents aren't pushed before a
        // validation function is in place
        onDesignDocUpdated: null
    },
    invokers: {
        updateDesignDoc: {
            funcName: "fluid.couchConfig.designDocument.updateDesignDoc",
            args: ["{that}.options.dbViews", "{that}.options.dbValidate.validateFunction", "{that}.options.dbConfig.couchURL", "{that}.options.dbConfig.dbName", "{that}.options.dbConfig.designDocName", "{that}.events.onDesignDocUpdated"]
        }
    },
    dbConfig: {
        // dbName: "targetDB",
        // designDocName: "views"
    },
    // map / reduce can be a function reference or a
    // function name as string. CouchDB's internal
    // reduce functions (_sum, _count, and _stats) can also
    // be used by name as strings in the reduce key
    dbViews: {
        // count: {
        //     map: "fluid.couchConfig.countMapFunction",
        //     reduce: "_count"
        // }
    },
    // Supply a validation function to be mapped to validate_doc_update in the
    // design document
    dbValidate: {
        // validateFunction: "fluid.couchConfig.validateFunction"
    }
});

fluid.couchConfig.designDocument.generateViews = function (viewsObj) {
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
fluid.couchConfig.designDocument.getBaseDesignDocument = function (designDocName) {
    return {
        _id: "_design/" + designDocName,
        views: {},
        language: "javascript"
    };
};

fluid.couchConfig.designDocument.updateDesignDoc = function (viewsObj, validateFunction, couchURL, dbName, designDocName, completionEvent) {

    var designDocObj = {};

    var generatedViews = fluid.couchConfig.designDocument.generateViews(viewsObj);

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
            designDoc = fluid.couchConfig.designDocument.getBaseDesignDocument(designDocName);

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

// Convenience grade that calls all the configuration functions at instantiation,
// in an appropriate order - intended to set up an application's initial
// configuration in one go
fluid.defaults("fluid.couchConfig.auto", {
    gradeNames: ["fluid.couchConfig.db", "fluid.couchConfig.documents", "fluid.couchConfig.designDocument"],
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
