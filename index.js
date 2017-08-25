var fluid = require("infusion");
var isEqual = require("underscore").isEqual;

var sjrk = fluid.registerNamespace("sjrk");

fluid.defaults("sjrk.server.couchDesignDocument", {
    gradeNames: "fluid.component",
    dbConfig: {
        couchURL: "http://localhost:5984",
        // These should be set in the derived grade
        // dbName: "stories",
        // designDocName: "views"
    },
    // Set in derived grade - map / reduce can be a function reference or a
    // function name as string. CouchDB's internal reduce functions can also
    // be used by name in the reduce key
    views: {
        // count: {
        //     map: "sjrk.server.couchDesignDocument.countMapFunction",
        //     reduce: "_count"
        // }
    },
    invokers: {
        generateViews: {
            funcName: "sjrk.server.couchDesignDocument.generateViews",
            args: ["{that}.options.views"]
        },
        updateViews: {
            funcName: "sjrk.server.couchDesignDocument.updateViews",
            args: ["@expand:{that}.generateViews()", "{that}.options.dbConfig.couchURL", "{that}.options.dbConfig.dbName", "{that}.options.dbConfig.designDocName"]
        }
    }
});

fluid.defaults("sjrk.server.couchDesignDocument.stories", {
    gradeNames: "sjrk.server.couchDesignDocument",
    dbConfig: {
        couchURL: "http://localhost:5984",
        dbName: "stories",
        designDocName: "views"
    },
    views: {
        titles: {
            map: "sjrk.server.couchDesignDocument.titleMapFunction"
        },
        authors: {
            map: "sjrk.server.couchDesignDocument.authorMapFunction"
        },
        tags: {
            map: "sjrk.server.couchDesignDocument.tagsMapFunction"
        },
        language: {
            map: "sjrk.server.couchDesignDocument.languageMapFunction"
        },
        count: {
            map: "sjrk.server.couchDesignDocument.countMapFunction",
            reduce: "_count"
        }
    }
});

sjrk.server.couchDesignDocument.titleMapFunction = function (doc) {
     emit("title", doc.value.title);
};

sjrk.server.couchDesignDocument.authorMapFunction = function (doc) {
     emit("author", doc.value.author);
};

sjrk.server.couchDesignDocument.tagsMapFunction = function (doc) {
     emit("tags", doc.value.tags);
};

sjrk.server.couchDesignDocument.languageMapFunction = function (doc) {
     emit("language", doc.value.language);
};

sjrk.server.couchDesignDocument.countMapFunction = function (doc) {
    emit("count", 1);
};

sjrk.server.couchDesignDocument.generateViews = function (viewsObj) {
    var transformedView = fluid.transform(viewsObj, function (desiredView, viewKey) {
        var transformedFunction = fluid.transform(desiredView, function (viewFunc, funcKey){
            // The internal CouchDB reduce functions
            if(viewFunc === "_count" || viewFunc === "_sum" || viewFunc === "_stats") {
                return viewFunc;
            }
            // Direct function references
            if(typeof viewFunc === "function") {
                return viewFunc.toString();
            }
            // Resolve funcNames using fluid.getGlobalValue
            if(typeof viewFunc === "string") {
                var namedFunc = fluid.getGlobalValue(viewFunc);
                return namedFunc.toString();
            }
        });
        return transformedFunction;
    });
    return transformedView;
};

sjrk.server.couchDesignDocument.getBaseDesignDocument = function (designDocName) {
        return {
            _id: "_design/" + designDocName,
            views: {},
            language: "javascript"
        };
};

sjrk.server.couchDesignDocument.updateViews = function (generatedViews, couchURL, dbName, designDocName) {

    var viewDoc;

    var nano = require("nano")(couchURL);

    var stories = nano.use(dbName);

    var designDocId = "_design/" + designDocName;
    console.log(designDocId);

    stories.get(designDocId, function(err, body) {
        // Design document exists
        if (!err) {
            console.log("Design document found");
            viewDoc = body;
            var originalViewDoc = fluid.copy(viewDoc);

            viewDoc.views = generatedViews;
            var viewsChanged = !isEqual(originalViewDoc, viewDoc);

            if(viewsChanged) {
                stories.insert(viewDoc, designDocId, function (err, body) {
                    console.log("views changed, updating");
                    if(!err) {
                        console.log(body);
                    } else {
                        console.log(err, body);
                    }
                });
            } else {
                console.log("Views unchanged, not updating");
            }
        // Design document does not exist
        } else {
            console.log("Design document not found");
            viewDoc = sjrk.server.couchDesignDocument.getBaseDesignDocument(designDocName);
            viewDoc.views = generatedViews;
            stories.insert(viewDoc, designDocId, function (err, body) {
                if(!err) {
                    console.log(body);
                } else {
                    console.log(err, body);
                }
            });
        }


    });

};

var couchConfig = sjrk.server.couchDesignDocument.stories();

couchConfig.updateViews();
