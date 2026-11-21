const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
	const url = new URL(typeof input === "string" ? input : input.url);
	if (url.origin === "https://api.clickup.com") {
		if (
			url.pathname === "/api/v2/oauth/token" &&
			JSON.parse(init.body).redirect_uri !==
				"http://127.0.0.1:3365/api/auth/clickup/callback"
		)
			throw new Error("OAuth redirect URI mismatch");
		url.protocol = "http:";
		url.hostname = "127.0.0.1";
		url.port = "4921";
		url.pathname = `/clickup${url.pathname}`;
		return originalFetch(url, init);
	}
	return originalFetch(input, init);
};
