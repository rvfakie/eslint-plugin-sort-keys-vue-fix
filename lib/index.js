/**
 * @fileoverview autofix sort-keys in vue
 * @author Roman Volchkov
 */
 "use strict";

 //------------------------------------------------------------------------------
 // Requirements
 //------------------------------------------------------------------------------
 
 const requireIndex = require("requireindex");
 
 //------------------------------------------------------------------------------
 // Plugin Definition
 //------------------------------------------------------------------------------
 
 
 // import all rules in lib/rules
 module.exports.rules = requireIndex(__dirname + "/rules");
 