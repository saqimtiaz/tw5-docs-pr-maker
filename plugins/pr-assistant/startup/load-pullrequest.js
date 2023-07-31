/*\
title: $:/plugins/sq/github-pr-assistant/startup/load-pullrequest.js
type: application/javascript
module-type: startup

\*/

(function(){


exports.name = "contribute-getpr-handler";
exports.platforms = ["browser"];
exports.after = ["startup"];

let stateTitle,
	prStateTitle,
	Logger;

const OCTOKIT_URL_TILE = "$:/config/github-pr-assistant/octokit/url",
	REPO_OWNER_TITLE = "$:/config/github-pr-assistant/repo/owner",
	REPO_TITLE = "$:/config/github-pr-assistant/repo";

const updateStatus = function(text,fields) {
	$tw.wiki.addTiddler(new $tw.Tiddler({title: stateTitle, text: text},fields));
};

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
	var tiddler = new $tw.Tiddler({title: prStateTitle},data);
	$tw.wiki.addTiddler(tiddler);
};

async function loadOctokit() {
	if(!$tw.Octokit) {
		updateStatus(`loading external library`);
		const { Octokit } = await import($tw.wiki.getTiddlerText(OCTOKIT_URL_TILE));
		$tw.Octokit = Octokit;
	}
};

async function loadPR(pr_number) {

	async function getBlob(octokit,sha) {
		updateStatus("Loading the PR files...");
		const blob = await octokit.request(
			`GET /repos/${repoOwner}/${repo}/git/blobs/${sha}`, {
				owner: repoOwner,
				repo: repo,
				file_sha: sha,
				  headers: {
			'X-GitHub-Api-Version': '2022-11-28'
		  }
		});
		return $tw.utils.base64Decode(blob.data.content);
	};
	
	async function getPR(pr_number) {
		updateStatus("Finding the PR...")
		const pr = await octokit.request(`GET /repos/${repoOwner}/${repo}/pulls/${pr_number}`, {
			owner: repoOwner,
			repo: repo,
			pull_number: `${pr_number}`,
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

	async function getFilesForPR(pr_number) {
		updateStatus("Finding the changes for the PR...")
		return await octokit.request(`GET /repos/${repoOwner}/${repo}/pulls/${pr_number}/files`, {
			owner: repoOwner,
			repo: repo,
			pull_number: `${pr_number}`,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});
	};

	const repoOwner = $tw.wiki.getTiddlerText(REPO_OWNER_TITLE),
		repo = $tw.wiki.getTiddlerText(REPO_TITLE);
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

		const pr = await getPR(pr_number);

		const pr_metadata = {
			"pr-title": pr.title,
			"pr-body": pr.body,
			"pr-url": pr.html_url,
			"pr-branch": pr.head.ref,
			"pr-exists": "yes",
			"pr-number": pr_number,
			"pr-isdraft": pr.draft ? "yes" : "no",
			"pr-nodeid": pr.node_id
		};

		Logger.log("PR exists");
	
		const fileObjects = await getFilesForPR(pr_number);
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
			updateStatus("The submission has been loaded. You can make further changes and submit them.",{status: "complete"});
		}
	} catch (err) {
		updateStatus(`There was an error loading the pull request ${err}.`);
	}
};

exports.startup = async function() {
	Logger = new $tw.utils.Logger("load-pullrequest");
	$tw.rootWidget.addEventListener("tm-loadpr",function(event){
		var pr_number = event.param;
		stateTitle = event.paramObject && event.paramObject.loadState,
		prStateTitle = event.paramObject && event.paramObject.prState;
		if(!pr_number || ! stateTitle || !prStateTitle) {
			return;
		}
		loadPR(pr_number);
	});
};

})();