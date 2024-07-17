/*\
title: $:/plugins/sq/github-pr-assistant/filters/sanitize-filename.js
type: application/javascript
module-type: filteroperator

Filter operator to check whether a password exists in local storage

\*/
(function(){

	/*jslint node: true, browser: true */
	/*global $tw: false */
	"use strict";
	


	// https://github.com/Jermolene/TiddlyWiki5/blob/7e2b035803438450509c57ec7d6db5b952644ec7/core/modules/utils/filesystem.js#L339
	const sanitize = function(title,dataTiddler,wiki) {
		// Remove any forward or backward slashes so we don't create directories
		let filename = title.replace(/\/|\\/g,"_");
		// Replace any Windows control codes
		filename = filename.replace(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i,"_$1_");
		// Replace any leading spaces with the same number of underscores
		filename = filename.replace(/^ +/,function (u) { return u.replace(/ /g, "_")});
		// Don't let the filename start with any dots because such files are invisible on *nix
		filename = filename.replace(/^\.+/g,function (u) { return u.replace(/\./g, "_")});
		// Replace any Unicode control codes
		filename = filename.replace(/[\x00-\x1f\x80-\x9f]/g,"_");
		// Replace any characters that can't be used in cross-platform filenames
		filename = $tw.utils.transliterate(filename.replace(/<|>|~|\:|\"|\||\?|\*|\^/g,"_"));
		/*
		// Replace any dots or spaces at the end of the extension with the same number of underscores
		extension = extension.replace(/[\. ]+$/, function (u) { return u.replace(/[\. ]/g, "_")});
		
		// Truncate the extension if it is too long
		if(extension.length > 32) {
			extension = extension.substr(0,32);
		}
		*/
		let extension = "tid";
		// If the filename already ends in the extension then remove it
		if(filename.substring(filename.length - extension.length) === extension) {
			filename = filename.substring(0,filename.length - extension.length);
		}
		
		// Truncate the filename if it is too long
		if(filename.length > 200) {
			filename = filename.substr(0,200);
		}
		// If the resulting filename is blank (eg because the title is just punctuation)
		if(!filename || /^_+$/g.test(filename)) {
			// ...then just use the character codes of the title
			filename = "";
			$tw.utils.each(title.split(""),function(char) {
				if(filename) {
					filename += "-";
				}
				filename += char.charCodeAt(0).toString();
			});
		}


		const fileExists = function(file) {
			let data = wiki.getTiddlerDataCached(dataTiddler),
				values = Object.values(data);
			return values.includes(file);
		}
		// Add a uniquifier if the file already exists (default)
		let	count = 1,
			qualifiedName = `${filename}.${extension}`; 
		while(fileExists(qualifiedName)) {
			qualifiedName = filename + "_" + count + extension;
			count++;
		}
		return qualifiedName;
	}


	/*
	Export our filter function
	*/
	exports["sanitize-filename"] = function(source,operator,options) {
		var results = [];
		source(function(tiddler,title) {
			results.push(sanitize(title,operator.operand,options.wiki));
		});
		return results;
	};
		
	})();