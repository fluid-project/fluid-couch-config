/*
Copyright 2017-2018 OCAD University
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://raw.githubusercontent.com/fluid-project/fluid-couch-config/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion");
require("./retrying");

var isEqual = require("underscore").isEqual;

fluid.defaults("fluid.couchConfig", {
    gradeNames: "fluid.component",
    couchOptions: {
        couchUrl: "http://localhost:5984",
        dbName: null // To be provided
    },
    dbDocuments: {
        // An object whose keys are the IDs of documents to
        // be created in the database, and the values are the documents
        // themselves.
    },
    dbDesignDocuments: {
        // An object whose keys are the names of design documents to be
        // created in the database. Each design document can have a
        // collection of zero or more views under the key 'views', where th
        // keys are the name of each view. Each view would in turn have the
        // keys "map" and "reduce", which are function references or function
        // names for functions accessible by couchConfig. These functions,
        // internally, can only refer to other functions known to CouchDB.
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
        //     views: {
        //         someViewFunction: {
        //             map: "reference.to.a.function",
        //             reduce: "reference.to.another.function"
        //         },
        //         anotherViewFunction: {
        //             map: "reference.to.yet.another.function",
        //             reduce: "reference.to.still.another.function"
        //         }
        //     },
        //     validate_doc_update: "a.validation.function"
        // }
    },
    invokers: {
        configureCouch: {
            funcName: "fluid.couchConfig.configureCouch",
            args: [
                "{that}.options.couchOptions",
                "{that}.options.retryOptions",
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

fluid.couchConfig.configureCouch = function (couchOptions, retryOptions, onConfiguringEvent, onSuccessEvent, onErrorEvent) {
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

    fluid.log("Making sure DB " + options.couchOptions.dbName + " exists in Couch instance at " + options.couchOptions.couchUrl);
    var nano = require("nano")(options.couchOptions.couchUrl);

    nano.db.get(options.couchOptions.dbName, function (err, body) {
        if (!err) {
            fluid.log("DB " + options.couchOptions.dbName + " exists");
            togo.resolve(payload);
        } else {
            if (err.statusCode === 404) {
                fluid.log("DB does not exist, trying to create");
                nano.db.create(options.couchOptions.dbName, function (err, body) {
                    if (!err) {
                        fluid.log("DB " + options.couchOptions.dbName + " created");
                        togo.resolve(payload);
                    } else {
                        fluid.log("DB " + options.couchOptions.dbName + " could not be created");
                        togo.reject({
                            isError: true,
                            message: err + " " + body,
                            statusCode: 404
                        });
                    }
                });
            } else {
                fluid.log("Could not get information about DB " + options.couchOptions.dbName);
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

fluid.defaults("fluid.couchConfig.destroyDbIfExist", {
    gradeNames: "fluid.couchConfig.action",
    invokers: {
        doAction: {
            funcName: "fluid.couchConfig.destroyDbIfExist.doAction",
            args: [{}, "{couchConfig}.options"]
        }
    }
});

fluid.couchConfig.destroyDbIfExist.doAction = function (payload, options) {
    var togo = fluid.promise();

    fluid.log("Making sure DB " + options.couchOptions.dbName + " no longer exists in Couch instance at " + options.couchOptions.couchUrl);
    var nano = require("nano")(options.couchOptions.couchUrl);

    nano.db.destroy(options.couchOptions.dbName, function (err) {
        if (!err) {
            fluid.log("DB " + options.couchOptions.dbName + " no longer exists");
            togo.resolve(payload);
        } else {
            if (err.statusCode === 404) {
                fluid.log("DB " + options.couchOptions.dbName + " does not exist, nothing to destroy");
                togo.resolve(payload);
            } else {
                fluid.log("Could not get information about DB " + options.couchOptions.dbName + ", destroy not successful.");
                togo.reject({
                    isError: true,
                    message: err,
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

fluid.couchConfig.updateDesignDocument.renderViewFunctions = function (designDocument) {
    var transformedDesignDocument = fluid.transform(designDocument, function (obj, key) {
        // The special-case validate_doc_update function
        if (key && key === "validate_doc_update") {
            return fluid.couchConfig.updateDesignDocument.renderFunctionString(obj);
        } else if (key && key === "views") {
            return fluid.transform(obj, function (desiredView) {
                return fluid.transform(desiredView, function (viewFunc, funcKey) {
                    // The internal CouchDB reduce functions
                    if (funcKey === "reduce" && (viewFunc === "_count" || viewFunc === "_sum" || viewFunc === "_stats")) {
                        return viewFunc;
                    }
                    return fluid.couchConfig.updateDesignDocument.renderFunctionString(viewFunc);
                });
            });
        }
    });
    return transformedDesignDocument;
};

fluid.couchConfig.action.writeToDb = function (targetDb, doc, id) {
    var togo = fluid.promise();

    targetDb.insert(doc, id, function (err) {
        if (!err) {
            fluid.log("Document " + id + " inserted successfully");
            togo.resolve();
        } else {
            fluid.log("Error in inserting document " + id + ", " + err);
            togo.reject({
                isError: true,
                message: err + ", document ID: " + id,
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
            fluid.log("Existing document " + id + " found");

            var existingDocValues = fluid.censorKeys(body, ["_id", "_rev"]);

            if (isEqual(doc, existingDocValues)) {
                fluid.log("Document " + id + " unchanged from existing in CouchDB, not updating");
                togo.resolve();
            } else {
                fluid.log("Document " + id + " has been changed, attempting to update");
                doc._rev = body._rev; // Including the _rev indicates an update
                fluid.promise.follow(fluid.couchConfig.action.writeToDb(targetDb, doc, id), togo);
            }
        } else {
            fluid.log("Document " + id + " not found, creating");
            fluid.promise.follow(fluid.couchConfig.action.writeToDb(targetDb, doc, id), togo);
        }
    });

    return togo;
};

fluid.couchConfig.action.updateDocuments = function (payload, options, docs) {
    var togo = fluid.promise();

    if (isEqual(docs, {})) {
        fluid.log("No documents to update");
        togo.resolve(payload);
        return togo;
    }

    var nano = require("nano")(options.couchOptions.couchUrl);
    var targetDb = nano.use(options.couchOptions.dbName);

    var promises = [];
    fluid.each(docs, function (doc, id) {
        fluid.log(fluid.stringTemplate("Updating document at %dbName/%id", { dbName: options.couchOptions.dbName, id: id }));
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
    var updatedDocs = {};

    fluid.each(options.dbDesignDocuments, function (doc, id) {
        // TODO: add error handling for doc input
        doc = fluid.couchConfig.updateDesignDocument.renderViewFunctions(doc);
        id = "_design/" + id;

        updatedDocs[id] = doc;
        // TODO: make a copy of this and make sure the changes are stored
        // perhaps fluid.transform
    });

    return fluid.couchConfig.action.updateDocuments(payload, options, updatedDocs);
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
    return fluid.couchConfig.action.updateDocuments(payload, options, options.dbDocuments);
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

fluid.defaults("fluid.couchConfig.pipeline.retryingBehaviour", {
    gradeNames: ["fluid.couchConfig.retryingBehaviour"],
    events: {
        "onAttemptFailure": "{couchConfig}.events.onError"
    },
    invokers: {
        retryFunction: {
            func: "{couchConfig}.configureCouch"
        }
    }
});

fluid.defaults("fluid.couchConfig.pipeline.retrying", {
    gradeNames: ["fluid.couchConfig.pipeline"],
    components: {
        retryingBehaviour: {
            type: "fluid.couchConfig.pipeline.retryingBehaviour"
        }
    }
});
