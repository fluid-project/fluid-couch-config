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
            args: [{}, "{couchConfig}.options"]
        }
    }
});

fluid.couchConfig.createDbIfNotExist.doAction = function (payload, options) {
    var togo = fluid.promise();

    var dbName = options.couchOptions.dbName;
    var couchUrl = options.couchOptions.couchUrl;

    console.log("Making sure DB " + dbName + " exists in Couch instance at " + couchUrl);
    var nano = require("nano")(couchUrl);

    nano.db.get(dbName, function (err, body) {
        if (!err) {
            console.log("DB " + dbName + " exists");
            togo.resolve(payload);
        } else {
            if (err.statusCode === 404) {
                console.log("DB does not exist, trying to create");
                nano.db.create(dbName, function (err, body) {
                    if (!err) {
                        console.log("DB " + dbName + " created");
                        togo.resolve(payload);
                    } else {
                        console.log("DB " + dbName + " could not be created");
                        togo.reject({
                            isError: true,
                            message: err + " " + body,
                            statusCode: 404
                        });
                    }
                });
            } else {
                console.log("Could not get information about DB " + dbName);
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
            args: [{}, "{couchConfig}.options"]
        }
    }
});

fluid.couchConfig.updateDesignDocument.renderFunctionString = function (func) {
    if (func) {
        // Direct function references
        if (typeof func === "function") {
            return func.toString();
        }
        // Resolve funcNames using fluid.getGlobalValue
        if (typeof func === "string") {
            var namedFunc = fluid.getGlobalValue(func);
            return namedFunc.toString();
        }
    } else {
        return func;
    }
};

fluid.couchConfig.updateDesignDocument.renderViewFunctions = function (viewsCollection) {
    var transformedViews = fluid.transform(viewsCollection, function (desiredView, viewKey) {
        // The special-case validate_doc_update function
        if (viewKey && viewKey === "validate_doc_update") {
            return fluid.couchConfig.updateDesignDocument.renderFunctionString(desiredView);
        } else {
            return fluid.transform(desiredView, function (viewFunc, funcKey) {
                // The internal CouchDB reduce functions
                if (funcKey === "reduce" && (viewFunc === "_count" || viewFunc === "_sum" || viewFunc === "_stats")) {
                    return viewFunc;
                }

                return fluid.couchConfig.updateDesignDocument.renderFunctionString(viewFunc);
            });
        }
    });
    return transformedViews;
};

fluid.couchConfig.action.writeToDb = function (targetDb, doc, id) {
    var togo = fluid.promise();

    targetDb.insert(doc, id, function (err, body) {
        if (!err) {
            console.log("Document " + id + " inserted successfully");
            togo.resolve();
        } else {
            console.log("Error in inserting document " + id);
            togo.reject({
                isError: true,
                message: err + " " + body,
                statusCode: err.statusCode
            });
        }
    });

    return togo;
};

fluid.couchConfig.action.updateSingleDocument = function (targetDb, doc, id) {
    var togo = fluid.promise();

    targetDb.get(id, function (err, body) {
        if (!err) {
            console.log("Existing document " + id + " found");

            var existingDocValues = fluid.censorKeys(body, ["_id", "_rev"]);

            if (isEqual(doc, existingDocValues)) {
                console.log("Document " + id + " unchanged from existing in CouchDB, not updating");
                togo.resolve();
            } else {
                console.log("Document " + id + " has been changed, attempting to update");
                doc._rev = body._rev; // Including the _rev indicates an update
                return fluid.couchConfig.action.writeToDb(targetDb, doc, id);
            }
        } else {
            console.log("Document " + id + " not found, creating");
            return fluid.couchConfig.action.writeToDb(targetDb, doc, id);
        }
    });

    return togo;
};

fluid.couchConfig.action.updateDocuments = function (payload, options, docs, docOperation, idOperation) {
    var togo = fluid.promise();
    var dbName = options.couchOptions.dbName;
    var couchUrl = options.couchOptions.couchUrl;

    if (isEqual(docs, {})) {
        console.log("No documents to update");
        togo.resolve(payload);
        return togo;
    }

    var nano = require("nano")(couchUrl);
    var targetDb = nano.use(dbName);

    var promises = [];
    fluid.each(docs, function (doc, id) {
        // TODO: think of a cleaner way to do this
        doc = docOperation ? docOperation(doc) : doc;
        id = idOperation ? idOperation(id) : id;

        console.log(
            fluid.stringTemplate("Updating document at %couchUrl/%dbName/%id with defined views",
            {couchUrl: couchUrl, dbName: dbName, id: id}));

        promises.push(fluid.couchConfig.action.updateSingleDocument(targetDb, doc, id));
    });

    fluid.promise.sequence(promises).then(function () {
        togo.resolve(payload);
    }, function (err) {
        togo.reject(err);
    });

    return togo;
};

fluid.couchConfig.updateDesignDocument.doAction = function (payload, options) {
    var designDocuments = options.dbDesignDocuments;

    return fluid.couchConfig.action.updateDocuments(payload, options, designDocuments, function (doc) {
        // TODO: add error handling for doc input
        return fluid.couchConfig.updateDesignDocument.renderViewFunctions(doc);
    }, function (id) {
        return "_design/" + id;
    });
};

fluid.defaults("fluid.couchConfig.updateDocuments", {
    gradeNames: "fluid.couchConfig.action",
    invokers: {
        doAction: {
            funcName: "fluid.couchConfig.updateDocuments.doAction",
            args: [{}, "{couchConfig}.options"]
        }
    }
});

fluid.couchConfig.updateDocuments.doAction = function (payload, options) {
    var documents = options.dbDocuments;
    return fluid.couchConfig.action.updateDocuments(payload, options, documents, null, null);
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
