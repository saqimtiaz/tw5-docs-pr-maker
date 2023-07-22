/*\
title: $:/sq/operators/password-exists.js
type: application/javascript
module-type: filteroperator

Filter operator to check whether a password exists in local storage

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

/*
Export our filter function
*/
exports["password-exists"] = function(source,operator,options) {
    var key = operator.operand;
    if(key && !!$tw.utils.getPassword(key)) {
        return ["yes"];
    } else {
        return ["no"];
    }
};
    
})();