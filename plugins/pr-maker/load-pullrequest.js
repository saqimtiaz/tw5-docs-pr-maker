/*\
title: $:/plugins/sq/contributor/load-pullrequest/startup.js
type: application/javascript
module-type: startup

collabwriter
docuwriter

\*/

(function(){


exports.name = "getpr-handler";
exports.platforms = ["browser"];
exports.after = ["startup"];

const STATETITLE = "$:/temp/contribute-docs/load-pr/status",
	FORMSTATE = "$:/temp/contribute-docs/form-state";

const updateStatus = function(text) {
	$tw.wiki.addTiddler(new $tw.Tiddler({title: STATETITLE, text: text}));
};

let Logger;

function convertFilesToTiddlers(files) {
	const deserializer = $tw.Wiki.tiddlerDeserializerModules["application/x-tiddler"];
	let hasError = false;
	files.every((file) => {
		let tiddlers;
		try {
			tiddlers = deserializer(file);
			if(tiddlers.length) {
				tiddlers.forEach((tiddlerFields) => {
					var title = tiddlerFields.title;
					if(title) {
						var tiddler = new $tw.Tiddler(tiddlerFields);
						// Add the tiddlers to the store
						$tw.wiki.addTiddler(tiddler);
					}					
				});
			}
			return true;
		} catch(e) {
			updateStatus(`There was an error loading the files for the PR ${e}.`);
			hasError = true;
			return false;
		}
	});
	return !hasError;
};

function savePRMetadata(data) {
	var tiddler = new $tw.Tiddler({title: FORMSTATE},data);
	$tw.wiki.addTiddler(tiddler);
};


async function loadOctokit() {
	if(!$tw.Octokit) {
		updateStatus(`loading external library`);
		const { Octokit } = await import("https://esm.sh/octokit");
		$tw.Octokit = Octokit;
	}
};

async function loadPR(pr_id) {

	async function getBlob(octokit,sha) {
		updateStatus("Loading the PR files...");
		const blob = await octokit.request(
			`GET /repos/Jermolene/TiddlyWiki5/git/blobs/${sha}`, {
			owner: 'jermolene',
				repo: 'TiddlyWiki5',
				file_sha: sha,
				  headers: {
			'X-GitHub-Api-Version': '2022-11-28'
		  }
		});
		return $tw.utils.base64Decode(blob.data.content);
	};
	
	async function getPR(pr_id) {
		updateStatus("Finding the PR...")
		const pr = await octokit.request(`GET /repos/jermolene/TiddlyWiki5/pulls/${pr_id}`, {
			owner: 'jermolene',
			repo: 'TiddlyWiki5',
			pull_number: `${pr_id}`,
			headers: {
			  'X-GitHub-Api-Version': '2022-11-28'
			}
		}).catch((err) => {
			if(err.status === 404) {
				throw new Error("Cannot find the specified PR, please check the URL or PR number.");
			}
		});
		return pr.data;
	};

	async function getFilesForPR(pr_id) {
		updateStatus("Finding the changes for the PR...")
		return await octokit.request(`GET /repos/jermolene/TiddlyWiki5/pulls/${pr_id}/files`, {
			owner: 'jermolene',
			repo: 'TiddlyWiki5',
			pull_number: `${pr_id}`,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});
	};

	let octokit;
	try {
		await loadOctokit();
		const TOKEN = $tw.utils.getPassword("github-docs-pr");
		if(!TOKEN || !TOKEN.length) {
			alert("Please set the github personal access token");
			return;
		}
		octokit = new $tw.Octokit({
			auth: TOKEN
		});

		const pr = await getPR(pr_id);

		const pr_metadata = {
			pr_title: pr.title,
			pr_body: pr.body,
			pr_url: pr.html_url,
			pr_branch: pr.head.ref,
			pr_exists: true
		};

		Logger.log("PR exists");
	
		const fileObjects = await getFilesForPR(pr_id);
		Logger.log(`got file info for ${fileObjects.data.length} files`);
	
		let filePromises = [];
		fileObjects.data.forEach(async function (fob) {
			filePromises.push(getBlob(octokit,fob.sha));
		});

		let files = await Promise.all(filePromises)
		Logger.log("Fetched all PR files");

		let tiddlersCreated = convertFilesToTiddlers(files);
		if(tiddlersCreated) {
			savePRMetadata(pr_metadata);
			updateStatus("PR has been loaded. You can make further changes and submit them.");
		}
	} catch (err) {
		updateStatus(`There was an error loading the pull request ${err}.`);
	}
};

exports.startup = async function() {
	Logger = new $tw.utils.Logger("load-pullrequest");
	$tw.rootWidget.addEventListener("tm-loadpr",function(event){
		var pr_id = event.param;
		loadPR(pr_id);
	});
};

})();

/*

To do:
	- refactor makePR code to be more generic, just accepts text chunks (or tiddler) to save as files, along with PR metadata
		- means all the metadata handling happens in wikitext
	- have a flag to indicate that we have loaded an existing PR and offer option to update existing PR or submit as new PR
	- save as draft option, can be loaded again to continue work. (instead of backup)
	- floating ? button, opens a tiddler:
		- show intro again
		- load an existing PR (including drafts)
		- settings
	- settings button also in submission form
	- load existing PR button in submission form
	- tour explanation for loading existing PR and saving as draft
		- new tour that can be opened from submission form?
		- which tour opens is controlled by their config tiddler, and the config tiddlers can themselves be tagged and provide the tag for the tour
		- so for example tiddlers tagged $:/tags/tour and each one in the text field provides the tag for that tour
	- comment in body of PR that PR was created with PR maker
	- add comment via API to edit PR in pr maker
	- handle tiddler deletions
*/