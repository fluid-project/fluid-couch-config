"use strict";

/* eslint-env node */
var fluid = require("infusion");

require("./src/couchConfig");

// Register our content so that it can be referenced in other packages using `fluid.module.resolvePath("%gpii-binder/path/to/content")`
fluid.module.register("couch-config", __dirname, require);
