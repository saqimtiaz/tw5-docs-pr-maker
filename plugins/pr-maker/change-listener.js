/*\
title: $:/plugins/sq/contribute/startup/change-listener.js
type: application/javascript
module-type: startup
\*/
(function(){

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";
	
exports.name = "contribute-docs-change-listener";
exports.platforms = ["browser"];
exports.after = ["startup"];

exports.startup = function() {		
		$tw.wiki.addEventListener("change",function(changes){
			var modifiedTiddlers = Object.keys(changes).filter(tiddler => !tiddler.startsWith("$:/") && !changes[tiddler].deleted);
			if(modifiedTiddlers.length) {
				$tw.rootWidget.invokeActionsByTag("$:/tags/sq/change-actions",null,{"actionTiddler": $tw.utils.stringifyList(modifiedTiddlers)});
			}
		});
};
	
})();