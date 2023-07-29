/*\
title: $:/plugins/sq/contribute/startup/create-pullrequest.js
type: application/javascript
module-type: startup
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";
	
exports.name = "contribute-createpr-handler";
exports.platforms = ["browser"];
exports.after = ["startup"];

const OCTOKIT_URL_TILE = "$:/config/contribute/octokit/url",
	CREATEPULLREQUEST_URL_TITLE = "$:/config/contribute/octokit/createPullRequest/url",
	REPO_OWNER_TITLE = "$:/config/contribute/createPR/repo/owner",
	REPO_BRANCH_TITLE = "$:/config/contribute/createPR/repo/branch",
	REPO_TITLE = "$:/config/contribute/createPR/repo";

let pullrequest,
	Logger;

const updateStatus = function(text,fields) {
	$tw.wiki.addTiddler(new $tw.Tiddler({title: pullrequest.stateTitle, text: text},fields));
};


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes
const initPR = function(stateTitle) {
	pullrequest = Object.create(null);
	pullrequest.files = Object.create(null);
	pullrequest.lingo = {
		"success": "Submission request created.",
		"error": "There was an error in submitting the update."
	};
	pullrequest.stateTitle = stateTitle;
};

const addToPr = function(path,data) {
	pullrequest.files[path] = data;
};

async function loadOctokit() {
	updateStatus(`loading external library`);
	if(!$tw.Octokit) {
		const { Octokit } = await import($tw.wiki.getTiddlerText(OCTOKIT_URL_TILE));
		$tw.Octokit = Octokit;
	}
	if(!$tw.createPullRequest) {
		const { createPullRequest} = await import($tw.wiki.getTiddlerText(CREATEPULLREQUEST_URL_TITLE));
		$tw.createPullRequest = createPullRequest;
	}
};

const createPR = async function() {
	let octokit,
		metadata = pullrequest.metadata;
	try {
		await loadOctokit();
		const MyOctokit = $tw.Octokit.plugin($tw.createPullRequest);
		const token = $tw.utils.getPassword("github-docs-pr");
		if(!token || !token.length) {
			alert("Please set the github personal access token");
			return;
		}
		octokit = new MyOctokit({
			auth: token
		});
		const prUserBranch = metadata["branch"],
			repoOwner = $tw.wiki.getTiddlerText(REPO_OWNER_TITLE),
			repo = $tw.wiki.getTiddlerText(REPO_TITLE);
		updateStatus(`Creating submission...`);

		const pr = await octokit.createPullRequest({
			//owner of target repo to create PR against
			owner: repoOwner,
			//title of target repo to create PR against
			repo: repo,
			//pr title
			title: metadata["title"],
			//pr body text
			body: metadata["body"],
			// base branch of target repo to create PR against
			base: $tw.wiki.getTiddlerText(REPO_BRANCH_TITLE),
			//user branch to push changes to
			head: prUserBranch,
			update: metadata["exists"] === "yes",
			draft: metadata["isdraft"] === "yes",
			changes: [
				{
					files: pullrequest.files,
					commit: metadata["title"],
					emptyCommit: false
				}
			],
			createWhenEmpty: false
		});
		updateStatus(pullrequest.lingo.success,{link: `https://github.com/${repoOwner}/${repo}/pull/${pr.data.number}`, status: "complete"});
	} catch (err) {
		updateStatus(`${pullrequest.lingo.error} ${err}`);
	}
};

exports.startup = function() {		

	Logger = new $tw.utils.Logger("load-pullrequest");

	$tw.rootWidget.addEventListener("tm-pr-init",function(event){
		initPR(event.param);
	});

	$tw.rootWidget.addEventListener("tm-pr-add",function(event){
		let path = event.paramObject.path,
			data = event.paramObject.data;
		if(path && data) {
			addToPr(path,data);
		}
	});
	
	$tw.rootWidget.addEventListener("tm-pr-create",function(event){
		let getPropertiesWithPrefix = function(properties,prefix) {
			let result = {};
			$tw.utils.each(properties,function(value,name) {
				if(name.indexOf(prefix) === 0) {
					result[name.substring(prefix.length)] = properties[name];
				}
			});
			return result;
		};

		pullrequest.metadata = getPropertiesWithPrefix(event.paramObject,"pr-");

		//verify that all required metadata fields are present
		const checkRequiredFields = function(){
			const requiredFields = ["title","branch","body"];
			return requiredFields.every(f => pullrequest.metadata.hasOwnProperty(f));
		};

		if(!pullrequest.metadata || !checkRequiredFields() || !$tw.utils.count(pullrequest.files)) {
			Logger.log("Not enough data to create a PR.");
			updateStatus("Incomplete data provided to create a PR");
			return;
		}
		if(!!event.paramObject.successMessage) {
			pullrequest.lingo.success = paramObject.successMessage;
		}
		if(!!event.paramObject.errorMessage) {
			pullrequest.lingo.error = paramObject.errorMessage;
		}
		createPR();
	});
};
	
})();