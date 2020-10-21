/*
Copyright 2017-2019 OCAD University
Licensed under the New BSD license. You may not use this file except in
compliance with one these Licenses. You may obtain a copy of the BSD License at
https://raw.githubusercontent.com/fluid-project/fluid-couch-config/master/LICENSE.txt
*/

/* global emit, sum */

"use strict";

var fluid = require("infusion");

require("../../src/couchConfig");

fluid.defaults("fluid.couchConfig.example", {
    gradeNames: ["fluid.couchConfig.pipeline"],
    couchOptions: {
        dbName: "basic-fluid-couch-config-db"
    },
    listeners: {
        onCreate: "{that}.configureCouch",
        onSuccess: "fluid.log(SUCCESS)",
        onError: "fluid.log({arguments}.0.message)"
    },
    dbDocuments: {
        test1: {
            title: "Hello, World!",
            tags: ["hello", "world", "test"],
            type: "post"
        },
        test2: {
            title: "Goodbye, World!",
            tags: ["goodbye", "world", "test"],
            type: "post"
        },
        // This document will fail to be updated/inserted due to the
        // validation function
        test3: {
            title: "I don't have a 'type' field. I'm going to fail validation.",
            tags: ["invalid", "test"]
        }
    },
    dbDesignDocuments: {
        exampleDesignDocument: {
            views: {
                docIdsWithTitles: {
                    map: "fluid.couchConfig.example.docIdsWithTitlesMapFunction"
                },
                tagCount: {
                    map: "fluid.couchConfig.example.tagCountMapFunction",
                    reduce: "fluid.couchConfig.example.tagCountReduceFunction"
                }
            },
            validate_doc_update: "fluid.couchConfig.example.validateFunction"
        }

    }
});

fluid.couchConfig.example.docIdsWithTitlesMapFunction = function (doc) {
    emit(doc._id, doc.title);
};

// http://localhost:5984/basic-fluid-couch-config-db/_design/exampleDesignDocument/_view/tagCount?group=true
fluid.couchConfig.example.tagCountMapFunction = function (doc) {
    if (doc.tags.length > 0) {
        for (var idx in doc.tags) {
            emit(doc.tags[idx], 1);
        }
    }
};

// eslint-disable-next-line no-unused-vars
fluid.couchConfig.example.tagCountReduceFunction = function (keys, values, rereduce) {
    return sum(values);
};

// eslint-disable-next-line no-unused-vars
fluid.couchConfig.example.validateFunction = function (newDoc, oldDoc, userCtx, secObj) {
    if (!newDoc.type) {
        throw ({forbidden: "doc.type is required"});
    }
};

fluid.couchConfig.example();
