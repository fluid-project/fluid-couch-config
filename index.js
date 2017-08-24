var fluid = require("infusion");
var isEqual = require("underscore").isEqual;

var sjrk = fluid.registerNamespace("sjrk");

var titleMapFunction = function (doc) {
     emit("title", doc.value.title);
};

var authorMapFunction = function (doc) {
     emit("author", doc.value.author);
};

var tagsMapFunction = function (doc) {
     emit("tags", doc.value.tags);
};

var languageMapFunction = function (doc) {
     emit("language", doc.value.language);
};

var countMapFunction = function (doc) {
    emit("count", 1);
};

fluid.defaults("sjrk.server.couchDesignDocument", {
    gradeNames: "fluid.component",
    dbConfig: {
        couchURL: "http://localhost:5984",
        dbName: "stories",
        designDocName: "views"
    },
    views: {
        titles: {
            map: titleMapFunction
        },
        authors: {
            map: authorMapFunction
        },
        tags: {
            map: tagsMapFunction
        },
        language: {
            map: languageMapFunction
        },
        count: {
            map: countMapFunction,
            reduce: "_count"
        }
    },
    invokers: {
        generateViews: {
            funcName: "sjrk.server.couchDesignDocument.generateViews",
            args: ["{that}.options.views"]
        },
        updateViews: {
            funcName: "sjrk.server.couchDesignDocument.updateViews",
            args: ["{that}.generateViews", "{that}.options.dbConfig.couchURL", "{that}.options.dbConfig.dbName", "{that}.options.dbConfig.designDocName"]
        }
    }
});

sjrk.server.couchDesignDocument.generateViews = function (desiredViews) {
    console.log(desiredViews);
    var transformedView = fluid.transform(desiredViews, function (desiredView, viewKey) {
        var transformedFunction = fluid.transform(desiredView, function (viewFunc, funcKey){
            return viewFunc.toString();
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

sjrk.server.couchDesignDocument.updateViews = function (transformedViewsFunc, couchURL, dbName, designDocName) {
    var generatedViews = transformedViewsFunc();

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
                console.log("Views unchanged, not updating")
            }
        // Design document does not exist
        } else {
            console.log("Design document not found");
            viewDoc = sjrk.server.couchDesignDocument.getBaseDesignDocument(designDocName);
            console.log(viewDoc);
            viewDoc.views = generatedViews;
            console.log(viewDoc);
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

var couchConfig = sjrk.server.couchDesignDocument();

couchConfig.updateViews();
