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
//var size = require("underscore").size;

fluid.defaults("fluid.couchConfig", {
    gradeNames: "fluid.component",
    couchOptions: {
        couchUrl: "http://localhost:5984",
        dbName: null, // To be provided
        dbDocuments: {
            // An object whose keys are the IDs of documents to
            // be created in the database, and the values are the documents
            // themselves.
        },
        dbDesignDocuments: {
            // An object whose keys are the names of design documents to be
            // created in the database. Each design document can have a
            // collection of zero or more views, where the keys are the names
            // of each view. Each view would in turn have the keys "map" and
            // "reduce", which are function references or function names for
            // functions accessible by couchConfig. These functions, internally,
            // can only refer to other functions known to CouchDB.
            // http://guide.couchdb.org/editions/1/en/views.html
            // TODO: verify that this last claim is accurate

            // Additionally, "reduce" may specify by name one of the three
            // built-in reduce functions: "_sum", "_count", or "_stats"
            // https://wiki.apache.org/couchdb/Built-In_Reduce_Functions

            // Each design document may also have up to one validate_doc_update
            // function, and must conform to this specification:
            // http://guide.couchdb.org/editions/1/en/validation.html

            // for example:
            // designDocumentName: {
            //     someViewFunction: {
            //         map: "reference.to.a.function",
            //         reduce: "reference.to.another.function"
            //     },
            //     anotherViewFunction: {
            //         map: "reference.to.yet.another.function",
            //         reduce: "reference.to.still.another.function"
            //     },
            //     validate_doc_update: "a.validation.function"
            // }
        }
    },
    invokers: {
        configureCouch: {
            funcName: "fluid.couchConfig.configureCouch",
            args: [
                "{that}.options.couchOptions",
                "{that}.events.onConfiguring",
                "{that}.events.onSuccess",
                "{that}.events.onError"
            ]
        }
    },
    events: {
        onConfiguring: null, // Actions listen to this event
        onSuccess: null, // Fired upon successful configuration
        onError: null // Fired if a configuration action signals rejection
    }
});

fluid.couchConfig.configureCouch = function (couchOptions, onConfiguringEvent, onSuccessEvent, onErrorEvent) {
    fluid.promise.fireTransformEvent(onConfiguringEvent, {}, {
        couchOptions : couchOptions
    }).then(function (value) {
        onSuccessEvent.fire(value);
    }, function (err) {
        onErrorEvent.fire(err);
    });
};

fluid.defaults("fluid.couchConfig.action", {
    gradeNames: "fluid.component",
    invokers: {
        doAction: "fluid.notImplemented" // To be provided
    }
});

fluid.defaults("fluid.couchConfig.createDbIfNotExist", {
    gradeNames: "fluid.couchConfig.action",
    invokers: {
        doAction: {
            funcName: "fluid.couchConfig.createDbIfNotExist.doAction",
            args: [{}, "{couchConfig}.options.couchOptions"]
        }
    }
});

fluid.couchConfig.createDbIfNotExist.doAction = function (payload, options) {
    var togo = fluid.promise();

    var dbName = options.couchOptions.dbName;
    var couchUrl = options.couchOptions.couchUrl;

    fluid.log("Making sure DB " + dbName + " exists in Couch instance at " + couchUrl);
    var nano = require("nano")(couchUrl);

    nano.db.get(dbName, function (err, body) {
        if (!err) {
            fluid.log("DB " + dbName + " exists");
            togo.resolve(payload);
        } else {
            if (err.statusCode === 404) {
                fluid.log("DB does not exist, trying to create");
                nano.db.create(dbName, function (err, body) {
                    if (!err) {
                        fluid.log("DB " + dbName + " created");
                        togo.resolve(payload);
                    } else {
                        fluid.log("DB " + dbName + " could not be created");
                        //fluid.log(err, body);
                        togo.reject({
                            isError: true,
                            message: err + " " + body,
                            statusCode: 404
                        });
                    }
                });
            } else {
                fluid.log("Could not get information about DB " + dbName);
                //fluid.log(err, body);
                togo.reject({
                    isError: true,
                    message: err + " " + body,
                    statusCode: err.statusCode
                });
            }

        }
    });

    return togo;
};

fluid.defaults("fluid.couchConfig.updateDesignDocument", {
    gradeNames: "fluid.couchConfig.action",
    invokers: {
        doAction: {
            funcName: "fluid.couchConfig.updateDesignDocument.doAction",
            args: [{}, "{couchConfig}.options.couchOptions"]
        }
    }
});

fluid.couchConfig.designDocument.renderFunctionString = function (func) {
    // Direct function references
    if (typeof func === "function") {
        return func.toString();
    }
    // Resolve funcNames using fluid.getGlobalValue
    if (typeof func === "string") {
        var namedFunc = fluid.getGlobalValue(func);
        return namedFunc.toString();
    }
};

fluid.couchConfig.designDocument.renderViewFunctions = function (viewsCollection) {
    var transformedViews = fluid.transform(viewsCollection, function (desiredView, viewKey) {
        // The special-case validate_doc_update function
        if (viewKey === "validate_doc_update") {
            return fluid.couchConfig.designDocument.renderFunctionString(desiredView);
        } else {
            return fluid.transform(desiredView, function (viewFunc, funcKey) {
                // The internal CouchDB reduce functions
                if (funcKey === "reduce" && (viewFunc === "_count" || viewFunc === "_sum" || viewFunc === "_stats")) {
                    return viewFunc;
                }

                return fluid.couchConfig.designDocument.renderFunctionString(viewFunc);
            });
        }
    });
    return transformedViews;
};

fluid.couchConfig.updateSingleDocument = function (targetDb, doc, id) {
    var togo = fluid.promise();

    targetDb.get(id, function (err, body) {
        if (!err) {
            fluid.log("Existing document " + id + " found");

            var existingDocValues = fluid.censorKeys(body, ["_id", "_rev"]);

            if (isEqual(doc, existingDocValues)) {
                fluid.log("Document unchanged from existing in CouchDB, not updating");
                togo.resolve();
            } else {
                doc._rev = body._rev; // Including the _rev indicates an update
                targetDb.insert(doc, id, function (err, body) {
                    fluid.log("Document has been changed, attempting to update");
                    if (!err) {
                        fluid.log("Document updated successfully");
                        togo.resolve();
                    } else {
                        fluid.log("Error in updating document");
                        togo.reject({
                            isError: true,
                            message: err + " " + body,
                            statusCode: err.statusCode
                        });
                    }
                });
            }
        // Design document does not exist
        } else {
            fluid.log("Document not found, creating");
            targetDb.insert(doc, id, function (err, body) {
                if (!err) {
                    fluid.log("Document created successfully");
                    togo.resolve();
                } else {
                    fluid.log("Error in creating document");
                    togo.reject({
                        isError: true,
                        message: err + " " + body,
                        statusCode: err.statusCode
                    });
                }
            });
        }
    });
};

fluid.couchConfig.updateDesignDocument.doAction = function (payload, options) {
    var togo = fluid.promise();
    var designDocuments = options.couchOptions.dbDesignDocuments;
    var dbName = options.couchOptions.dbName;
    var couchUrl = options.couchOptions.couchUrl;

    if (isEqual(designDocuments, {})) {
        fluid.log("No design document elements");
        togo.resolve(payload);
        return togo;
    }

    var nano = require("nano")(couchUrl);
    var targetDb = nano.use(dbName);

    var promises = [];
    fluid.each(designDocuments, function (doc, id) {
        var designDocId = "_design/" + id;

        fluid.log(
            fluid.stringTemplate("Updating design document at %couchUrl/%dbName/%id with defined views",
            {couchUrl: couchUrl, dbName: dbName, id: designDocId}));

        // TODO: add error handling for doc input
        doc = fluid.couchConfig.designDocument.renderViewFunctions(doc);

        promises.push(fluid.couchConfig.updateDocuments.updateSingleDesignDocument(targetDb, doc, id));
    });

    fluid.promise.sequence(promises).then(function () {
        togo.resolve(payload);
    }, function (err) {
        togo.reject(err);
    });

    return togo;
};

fluid.defaults("fluid.couchConfig.updateDocuments", {
    gradeNames: "fluid.couchConfig.action",
    invokers: {
        doAction: {
            funcName: "fluid.couchConfig.updateDocuments.doAction",
            args: [{}, "{couchConfig}.options.couchOptions"]
        }
    }
});

fluid.couchConfig.updateDocuments.updateSingleDocument = function (targetDb, doc, id) {
    var togo = fluid.promise();

    targetDb.get(id, function (err, body) {
        if (!err) {
            fluid.log("Document " + id + " found");

            var existingDocValues = fluid.censorKeys(body, ["_id", "_rev"]);
            var docValuesEqual = isEqual(doc, existingDocValues);
            if (docValuesEqual) {
                fluid.log("Document values of " + id + " are equivalent, not updating to avoid needless revisioning");
                togo.resolve();
            } else {
                doc._rev = body._rev; // Including the _rev indicates an update
                targetDb.insert(doc, id, function (err, body) {
                    if (!err) {
                        fluid.log("Update of document " + id + " inserted");
                        togo.resolve();
                    } else {
                        fluid.log("Update of document " + id + " could not be inserted");
                        togo.reject({
                            isError: true,
                            message: err + " " + body,
                            statusCode: err.statusCode
                        });
                    }
                });
            }
        } else {
            fluid.log("Document " + id + " not found, creating");
            targetDb.insert(doc, id, function (err, body) {
                if (!err) {
                    fluid.log("Document " + id + " inserted");
                    togo.resolve();
                } else {
                    fluid.log("Document " + id + " could not be inserted");
                    togo.reject({
                        isError: true,
                        message: err + " " + body,
                        statusCode: err.statusCode
                    });
                }
            });
        }
    });

    return togo;
};

fluid.couchConfig.updateDocuments.doAction = function (payload, options) {
    var togo = fluid.promise();
    var documents = options.couchOptions.dbDocuments;
    var dbName = options.couchOptions.dbName;
    var couchUrl = options.couchOptions.couchUrl;

    if (isEqual(documents, {})) {
        fluid.log("No documents to update");
        togo.resolve(payload);
        return togo;
    }

    var nano = require("nano")(couchUrl);
    var targetDb = nano.use(dbName);

    fluid.log("Updating documents at for DB " + dbName + " in Couch instance at " + couchUrl);

    var promises = [];
    fluid.each(documents, function (doc, id) {
        // togo = togo.then(function () {
        //     fluid.couchConfig.updateDocuments.updateSingleDocument(targetDb, doc, id, payload);
        // }, function (isError, message, statusCode) {
        //     togo.reject({
        //         isError: isError,
        //         message: message,
        //         statusCode: statusCode
        //     });
        // });

        promises.push(fluid.couchConfig.updateDocuments.updateSingleDocument(targetDb, doc, id));
    });

    fluid.promise.sequence(promises).then(function () {
        togo.resolve(payload);
    }, function (err) {
        togo.reject(err);
    });

    return togo;
};

fluid.defaults("fluid.couchConfig.pipeline", {
    gradeNames: "fluid.couchConfig",
    components: {
        createDbIfNotExistAction: {
            type: "fluid.couchConfig.createDbIfNotExist",
            options: {
                listeners: {
                    "{fluid.couchConfig}.events.onConfiguring": {
                        listener: "{that}.doAction",
                        priority: 30
                    }
                }
            }
        },
        updateDesignDocumentAction: {
            type: "fluid.couchConfig.updateDesignDocument",
            options: {
                listeners: {
                    "{fluid.couchConfig}.events.onConfiguring": {
                        listener: "{that}.doAction",
                        priority: 20
                    }
                }
            }
        },
        updateDocumentsAction: {
            type: "fluid.couchConfig.updateDocuments",
            options: {
                listeners: {
                    "{fluid.couchConfig}.events.onConfiguring": {
                        listener: "{that}.doAction",
                        priority: 10
                    }
                }
            }
        }
    }
});

// // Generates a base design document
// fluid.couchConfig.designDocument.getBaseDesignDocument = function (designDocName) {
//     return {
//         _id: "_design/" + designDocName,
//         views: {},
//         language: "javascript"
//     };
// };
//
// fluid.couchConfig.designDocument.updateDesignDoc = function (viewsObj, validateFunction, couchURL, dbName, designDocName, completionEvent) {
//
//     var designDocObj = {};
//
//     var generatedViews = fluid.couchConfig.designDocument.generateViews(viewsObj);
//
//     if (!isEqual(generatedViews, {})) {
//         designDocObj.views = generatedViews;
//     }
//
//     if (validateFunction) {
//         // Direct function references
//         if (typeof validateFunction === "function") {
//             designDocObj.validate_doc_update = validateFunction.toString();
//         }
//         // Resolve funcNames using fluid.getGlobalValue
//         if (typeof validateFunction === "string") {
//             var namedFunc = fluid.getGlobalValue(validateFunction);
//             designDocObj.validate_doc_update = namedFunc.toString();
//         }
//     }
//
//     if (isEqual(designDocObj, {})) {
//         console.log("No design document elements");
//         return;
//     }
//
//     console.log(fluid.stringTemplate("Updating design document at %couchURL/%dbName/_design/%designDocName with defined views", {couchURL: couchURL, dbName: dbName, designDocName: designDocName}));
//
//     var designDoc;
//
//     var nano = require("nano")(couchURL);
//
//     var targetDB = nano.use(dbName);
//
//     var designDocId = "_design/" + designDocName;
//
//     targetDB.get(designDocId, function (err, body) {
//         // Design document exists
//         if (!err) {
//             console.log("Existing design document found");
//
//             designDoc = body;
//             var originaldesignDoc = fluid.copy(designDoc);
//
//             fluid.each(designDocObj, function (designDocItem, designDocItemKey) {
//                 designDoc[designDocItemKey] = designDocItem;
//             });
//
//             var designDocChanged = !isEqual(originaldesignDoc, designDoc);
//
//             if (designDocChanged) {
//                 targetDB.insert(designDoc, designDocId, function (err, body) {
//                     console.log("Design doc has been changed, attempting to update");
//                     if (!err) {
//                         console.log("Design doc updated successfully");
//                         console.log(body);
//                         completionEvent.fire();
//                     } else {
//                         console.log("Error in updating design doc");
//                         console.log(err, body);
//                     }
//                 });
//             } else {
//                 console.log("Design document unchanged from existing in CouchDB, not updating");
//                 completionEvent.fire();
//             }
//         // Design document does not exist
//         } else {
//             console.log("Design document not found, creating");
//             designDoc = fluid.couchConfig.designDocument.getBaseDesignDocument(designDocName);
//
//             fluid.each(designDocObj, function (designDocItem, designDocItemKey) {
//                 designDoc[designDocItemKey] = designDocItem;
//             });
//
//             targetDB.insert(designDoc, designDocId, function (err, body) {
//                 if (!err) {
//                     console.log("Design doc created successfully");
//                     console.log(body);
//                     completionEvent.fire();
//                 } else {
//                     console.log(err, body);
//                     console.log("Error in creating design document");
//                 }
//             });
//         }
//     });
// };
