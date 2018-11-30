/*
Copyright 2017-2018 OCAD University
Licensed under the New BSD license. You may not use this file except in
compliance with one these Licenses. You may obtain a copy of the BSD License at
https://raw.githubusercontent.com/fluid-project/fluid-couch-config/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion");

// Can be used as a subcomponent to implement
// retrying behaviour for an action that can
// potentially fail, such as in a distributed
// application set-up
fluid.defaults("fluid.couchConfig.retryingBehaviour", {
    gradeNames: ["fluid.modelComponent"],
    retryOptions: {
        maxRetries: 3,
        retryDelay: 10
    },
    model: {
        currentRetries: 0
    },
    events: {
        // In an implementation, this should be
        // fired to indicate a failed attempted
        // action
        "onAttemptFailure": null
    },
    listeners: {
        "onAttemptFailure.handleRetry": "{that}.handleRetry"
    },
    invokers: {
        handleRetry: {
            funcName: "fluid.couchConfig.retryingBehaviour.handleRetry",
            args: ["{that}", "{that}.retryFunction"]
        },
        retryFunction: {
            funcName: "fluid.notImplemented"
        }
    }
});

fluid.couchConfig.retryingBehaviour.handleRetry = function (retrying, retryingFunction) {
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
