/*\
title: $:/plugins/sq/github-pr-assistant/startup/change-listener.js
type: application/javascript
module-type: startup
\*/
(function(){

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";
	
exports.name = "contribute-change-listener";
exports.platforms = ["browser"];
exports.after = ["startup"];

exports.startup = function() {		
		$tw.wiki.addEventListener("change",function(changes){
			var tiddlers = Object.keys(changes),
				modifiedTiddlers = tiddlers.filter(tiddler => !changes[tiddler].deleted),
				deletedTiddlers = tiddlers.filter(tiddler => !!changes[tiddler].deleted);
			if(tiddlers.length) {
				$tw.rootWidget.invokeActionsByTag("$:/tags/contribute/change-actions",null,{"modifiedTiddlers": $tw.utils.stringifyList(modifiedTiddlers), "deletedTiddlers": $tw.utils.stringifyList(deletedTiddlers)});
			}
		});
};
	
})();