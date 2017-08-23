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

fluid.defaults("sjrk.server.couchConfig", {
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
            funcName: "sjrk.server.couchConfig.generateViews",
            args: ["{that}.options.views"]
        },
        updateViews: {
            funcName: "sjrk.server.couchConfig.updateViews",
            args: ["{that}.generateViews", "{that}.options.dbConfig.dbName", "{that}.options.dbConfig.couchURL"]
        }
    }
});

sjrk.server.couchConfig.generateViews = function (desiredViews) {
    console.log(desiredViews);
    var transformedView = fluid.transform(desiredViews, function (desiredView, viewKey) {
        var transformedFunction = fluid.transform(desiredView, function (viewFunc, funcKey){
            return viewFunc.toString();
        });
        return transformedFunction;
    });
    return transformedView;
};

sjrk.server.couchConfig.updateViews = function (transformedViewsFunc, dbName, couchURL) {
    var generatedViews = transformedViewsFunc();

    var viewDoc;

    var nano = require("nano")(couchURL);

    var stories = nano.use(dbName);

    stories.get("_design/views", function(err, body) {
        if (!err) {
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
        }
    });

};

var couchConfig = sjrk.server.couchConfig();

couchConfig.updateViews();
