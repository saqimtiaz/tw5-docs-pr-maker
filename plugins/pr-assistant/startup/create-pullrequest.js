/*\
title: $:/plugins/sq/github-pr-assistant/startup/create-pullrequest.js
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

const REPO_OWNER_TITLE = "$:/config/github-pr-assistant/repo/owner",
	REPO_BRANCH_TITLE = "$:/config/github-pr-assistant/repo/branch",
	REPO_TITLE = "$:/config/github-pr-assistant/repo";

let pullrequest,
	Logger;

const updateStatus = function(text,fields) {
	$tw.wiki.addTiddler(new $tw.Tiddler({title: pullrequest.stateTitle, text: text},fields));
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes
const initPR = function(stateTitle) {
	pullrequest = Object.create(null);
	pullrequest.files = Object.create(null);
	pullrequest.deletedFiles = [];
	pullrequest.lingo = {
		"success": "Submission request created.",
		"error": "There was an error in submitting the update."
	};
	pullrequest.stateTitle = stateTitle;
};

const addToPr = function(path,data,removeFile) {
	if(removeFile) {
		pullrequest.deletedFiles.push(path);
	} else {
		pullrequest.files[path] = data;
	}
};

function loadOctokit() {
	if(!$tw.Octokit) {
		$tw.Octokit = require("$:/plugins/sq/github-pr-assistant/octokit.js").Octokit;
	}
	if(!$tw.createPullRequest) {
		const { createPullRequest, DELETE_FILE } = require("$:/plugins/sq/github-pr-assistant/octokit-createPullRequest.js");
		$tw.createPullRequest = createPullRequest;
		$tw.cprDELETEFILE = DELETE_FILE;
	}
};

const createPR = async function() {
	let octokit,
		metadata = pullrequest.metadata;
	try {
		loadOctokit();
		const MyOctokit = $tw.Octokit.plugin($tw.createPullRequest);
//		const token = $tw.utils.getPassword("github-docs-pr");
		const token = sessionStorage.getItem("gh_access_token");

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
		updateStatus(`Creating submission...`,{status:"inprogress"});

		pullrequest.deletedFiles.forEach(file => pullrequest.files[file] = $tw.cprDELETEFILE);

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

		if(metadata["isdraft"] === "no" && pr.data.draft) {
			const { markPullRequestReadyForReview } = await octokit.graphql(
				`mutation publishDraft($prid: ID!) {
					markPullRequestReadyForReview(
					  input: {pullRequestId: $prid, clientMutationId: "tw-contribute-docs"}
					) {
					  clientMutationId
					  pullRequest {
						id
						isDraft
					  }
					}
				  }
				`,{
					"prid" : pr.data.node_id
				}
			);
			metadata["isdraft"] === markPullRequestReadyForReview.pullRequest.isDraft ? "yes" : "no";
		} else if(metadata["isdraft"] === "yes" && !pr.data.draft) {
			const { convertPullRequestToDraft } = await octokit.graphql(
				`mutation markAsDraft($prid: ID!) {
					convertPullRequestToDraft(input: {pullRequestId: $prid, clientMutationId: "tw-contribute-docs"}) {
					  clientMutationId
					  pullRequest {
						isDraft
					  }
					}
				  }
				`,{
					"prid" : pr.data.node_id
				}
			);
			metadata["isdraft"] === convertPullRequestToDraft.pullRequest.isDraft ? "yes" : "no";
		}

		if(pullrequest.actions) {
			let resultVariables = {
				"pr-number": pr.data.number.toString(),
				"pr-isdraft": metadata["isdraft"] === "yes" ? "yes" : "no", //XXXX
				"pr-exists": "yes",
				"pr-branch": pr.data.head.ref,
				"pr-url": pr.data.html_url,
				"pr-nodeid": pr.data.node_id
			};
			$tw.wiki.invokeActionString(pullrequest.actions,undefined,$tw.utils.extend({},resultVariables),{parentWidget: $tw.rootWidget});
		}
		updateStatus(pullrequest.lingo.success,{link: `https://github.com/${repoOwner}/${repo}/pull/${pr.data.number}`, status: "complete"});
	} catch (err) {
		updateStatus(`${pullrequest.lingo.error} ${err}`,{status: "error"});
	}
};

exports.startup = function() {		

	Logger = new $tw.utils.Logger("load-pullrequest");

	$tw.rootWidget.addEventListener("tm-pr-init",function(event){
		initPR(event.param);
	});

	$tw.rootWidget.addEventListener("tm-pr-add", function(event){
		let path = event.paramObject.path,
			data = event.paramObject.data,
			remove = !!event.paramObject["delete"];
		if((path && data) || (path && remove)) {
			addToPr(path,data,remove);
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

		if(!pullrequest.metadata || !checkRequiredFields() || (!$tw.utils.count(pullrequest.files) && !pullrequest.deletedFiles.length )) {
			Logger.log("Not enough data to create a PR.");
			updateStatus("Incomplete data provided to create a PR",{status:"error"});
			return;
		}
		if(event.paramObject.oncompletion) {
			pullrequest.actions = event.paramObject.oncompletion;
		}
		if(!!event.paramObject.successMessage) {
			pullrequest.lingo.success = event.paramObject.successMessage;
		}
		if(!!event.paramObject.errorMessage) {
			pullrequest.lingo.error = event.paramObject.errorMessage;
		}
		createPR();
	});
};
	
})();