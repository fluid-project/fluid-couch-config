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

// Can be used as a subcomponent to implement
// retrying behaviour
fluid.defaults("fluid.retrying", {
    gradeNames: ["fluid.modelComponent"],
    retryOptions: {
        maxRetries: 3,
        retryDelay: 10
    },
    model: {
        currentRetries: 0
    },
    // In an implementation, this should be
    // bound or fired by an appropriate
    // error event in the function etc
    // that we wish to retry
    events: {
        "onError": null
    },
    listeners: {
        "onError.handleRetry": "{that}.handleRetry"
    },
    invokers: {
        handleRetry: {
            funcName: "fluid.retrying.handleRetry",
            args: ["{that}", "{that}.retryFunction"]
        },
        retryFunction: {
            funcName: "fluid.notImplemented"
        }
    }
});

fluid.retrying.handleRetry = function (retrying, retryingFunction) {
    var maxRetries = retrying.options.retryOptions.maxRetries,
        retryDelay = retrying.options.retryOptions.retryDelay,
        currentRetries = retrying.model.currentRetries;

        if (currentRetries < maxRetries) {
            retrying.applier.change("currentRetries", currentRetries + 1);
            fluid.log("Retry " + retrying.model.currentRetries + " of " + maxRetries + "; retrying after " + retryDelay + " seconds");
            setTimeout(function () {
                retryingFunction();
            }, retryDelay * 1000);

        } else {
            fluid.log("Max retries exceeded");
        }
};
