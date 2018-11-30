/*
Copyright 2017-2018 OCAD University
Licensed under the New BSD license. You may not use this file except in
compliance with one these Licenses. You may obtain a copy of the BSD License at
https://raw.githubusercontent.com/fluid-project/fluid-couch-config/master/LICENSE.txt
*/

"use strict";

/* eslint-env node */
var fluid = require("infusion");

require("./src/couchConfig");

// Register our content so that it can be referenced in other packages using `fluid.module.resolvePath("%fluid-couch-config/path/to/content")`
fluid.module.register("fluid-couch-config", __dirname, require);
