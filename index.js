var fluid = require("infusion");

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

var countMapFunction = function (doc) {
    emit("count", 1);
};

fluid.defaults("sjrk.server.couchDesignDocument", {
    gradeNames: "fluid.component",
    dbConfig: {
        couchURL: "http://localhost:5984",
        dbName: "stories"
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
            args: ["{that}.generateViews", "{that}.options.dbConfig.dbName", "{that}.options.dbConfig.couchURL"]
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

sjrk.server.couchDesignDocument.baseDesignDocument =
    {
        _id: "_design/views",
        views: {},
        language: "javascript"
    };

sjrk.server.couchDesignDocument.updateViews = function (transformedViewsFunc, dbName, couchURL) {
    var generatedViews = transformedViewsFunc();

    var viewDoc;

    var nano = require("nano")(couchURL);

    var stories = nano.use(dbName);

    stories.get("_design/views", function(err, body) {
        // Design document exists
        if (!err) {
            console.log("Design document found");
            viewDoc = body;
            console.log(viewDoc);
            viewDoc.views = generatedViews;
            console.log(viewDoc);
            stories.insert(viewDoc, "_design/views", function (err, body) {
                if(!err) {
                    console.log(body);
                } else {
                    console.log(err, body);
                }
            });
        // Design document does not exist
        } else {
            console.log("Design document not found");
            viewDoc = fluid.copy(sjrk.server.couchDesignDocument.baseDesignDocument);
            console.log(viewDoc);
            viewDoc.views = generatedViews;
            console.log(viewDoc);
            stories.insert(viewDoc, "_design/views", function (err, body) {
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
