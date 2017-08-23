var fluid = require("infusion");
var nano = require("nano")('http://localhost:5984');

fluid.defaults("sjrk.server.couchConfig", {
    gradeNames: "fluid.component",
    desiredViews: {
        titles: {
            map: titleMapFunction
        },
        authors: {
            map: authorMapFunction
        },
        tags: {
            map: tagsMapFunction
        }
    }
})

var titleMapFunction = function (doc) {
     emit("title", doc.value.title);
};

var authorMapFunction = function (doc) {
     emit("author", doc.value.author);
};

var tagsMapFunction = function (doc) {
     emit("tags", doc.value.tags);
};

var desiredViews = {
    titles: {
        map: titleMapFunction
    },
    authors: {
        map: authorMapFunction
    },
    tags: {
        map: tagsMapFunction
    }
};

var generateViews = function (desiredViews) {
    var transformedView = fluid.transform(desiredViews, function (desiredView, viewKey) {
        var transformedFunction = fluid.transform(desiredView, function (viewFunc, funcKey){
            return viewFunc.toString();
        });
        return transformedFunction;
    });
    return transformedView;
};

var generatedViews = generateViews(desiredViews);

var viewDoc;

var stories = nano.use("stories");

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
