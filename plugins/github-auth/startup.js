/*\
title: $:/plugins/sq/github-auth/startup.js
type: application/javascript
module-type: startup
\*/

exports.name = "github-auth-startup";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.synchronous = true;

class GithubAuth {

	constructor() {
		this.WORKER_BASE_URL = "https://sq-github-auth.saq-imtiaz.workers.dev";
		this.TOKEN_KEY = "gh_access_token";
		this.EXPIRY_KEY = "gh_token_expiry";
		this.POPUP_WIDTH = 500;
		this.POPUP_HEIGHT = 700;
		this.AUTH_STATE_TIDDLER = "$:/temp/state/github-auth";

		this.expiryTimer = null;
		this.warningTimer = null;

		void this.#restoreSession();
		this.#setupEventListeners();
	}

	getToken() {
		const token = sessionStorage.getItem(this.TOKEN_KEY),
			expiry = parseInt(sessionStorage.getItem(this.EXPIRY_KEY) || "0",10);
		if(token && Date.now() < expiry) {
			return token;
		}
		this.#clearToken();
		return null;
	}

	getTokenExpiry() {
		return parseInt(sessionStorage.getItem(this.EXPIRY_KEY) || "0",10);
	}

	#saveToken(token, expiresIn) {
		sessionStorage.setItem(this.TOKEN_KEY, token);
		const expiry = Date.now() + expiresIn*1000;
		sessionStorage.setItem(this.EXPIRY_KEY, expiry.toString());
		this.#setupExpiryTimers(expiry);
		return expiry;
	}

	#clearToken(revoke=false){
		const token = sessionStorage.getItem(this.TOKEN_KEY);
		if(revoke && token) {
			fetch(`${this.WORKER_BASE_URL}/revoke`,{
				method:"POST",
				headers:{"Content-Type":"application/json"},
				body:JSON.stringify({ access_token: token })
			});
		}
		sessionStorage.removeItem(this.TOKEN_KEY);
		sessionStorage.removeItem(this.EXPIRY_KEY);
		clearTimeout(this.expiryTimer);
		clearTimeout(this.warningTimer);
		this.expiryTimer = this.warningTimer = null;
		$tw.wiki.deleteTiddler(this.AUTH_STATE_TIDDLER);
	}

	#saveAuthState(state){
		const current = $tw.wiki.getTiddlerData(this.AUTH_STATE_TIDDLER,{}) || {};
		$tw.wiki.setTiddlerData(this.AUTH_STATE_TIDDLER,Object.assign({},current,state));
	}

	#setupExpiryTimers(expiryTime){
		clearTimeout(this.expiryTimer);
		clearTimeout(this.warningTimer);
		const ms = expiryTime - Date.now();
		if(ms <= 0) {
			return;
		}

		const warningTime = ms - 5*60*1000;
		if(warningTime > 0) {
			this.warningTimer = setTimeout(()=>{
				alert("Your GitHub session will expire in 5 minutes. Please save your work.");
			}, warningTime);
		}

		this.expiryTimer = setTimeout(()=>{
			this.#clearToken();
			alert("Your GitHub session has expired. Please log in again.");
		}, ms);
	}

	async #restoreSession(){
		const token = this.getToken();
		if(!token) {
			return;
		}
		await this.#fetchUserAndSaveState();
	}

	async #fetchUserAndSaveState(){
		const token = this.getToken();
		const expiry = this.getTokenExpiry();
		if(!token || !expiry) {
			return;
		}
		try {
			const resp = await fetch("https://api.github.com/user",{
				headers:{ "Authorization":"token "+token, "Accept":"application/vnd.github+json" }
			});
			if(!resp.ok){
				this.#clearToken();
				return;
			}
			const data = await resp.json();
			this.#saveAuthState({
				loggedIn:"yes",
				username:data.login,
				tokenExpiry: expiry
			});
			this.#setupExpiryTimers(expiry);
		} catch(err){
			this.#clearToken();
		}
	}

	#handleLogin(){
		const left = window.screenX + (window.innerWidth-this.POPUP_WIDTH)/2,
			top  = window.screenY + (window.innerHeight-this.POPUP_HEIGHT)/2,
			popup = window.open(`${this.WORKER_BASE_URL}/auth`,"_blank",
				`width=${this.POPUP_WIDTH},height=${this.POPUP_HEIGHT},left=${left},top=${top}`
			);

		window.addEventListener("message", (event)=>{
			if(!event.data || event.data.source !== "github-pkce") {
				return;
			}
			if(event.origin !== this.WORKER_BASE_URL) {
				return;
			}

			popup.close();

			const { access_token, expires_in } = event.data;
			this.#saveToken(access_token, expires_in);

			this.#fetchUserAndSaveState().then(()=>{
				alert("Logged in to GitHub!");
			}).catch(()=>{
				alert("Failed to fetch GitHub username.");
			});
		}, { once:true });
	}

	#handleLogout(){
		this.#clearToken(true);
		alert("Logged out from GitHub.");
	}

	#setupEventListeners(){
		$tw.rootWidget.addEventListener("tm-github-login", ()=>{
			this.#handleLogin();
		});
		$tw.rootWidget.addEventListener("tm-github-logout", ()=>{
			this.#handleLogout();
		});
	}
}

exports.startup = function() {
	$tw.githubAuth = new GithubAuth();
};
