// Test-only preload (node --require): replaces fetch for the Instagram OAuth token hosts with
// synthetic responses so the callback route can be exercised end to end without Meta.
// Never load this outside isolated tests.
const BIG_ID = "17841400000000000123";
const realFetch = globalThis.fetch;
globalThis.fetch = async function mockedFetch(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://api.instagram.com/oauth/access_token")) {
    const body = String(init?.body || "");
    if (!body.includes("code=synthetic-good-code")) return new Response('{"error_type":"OAuthException","code":400,"error_message":"invalid code"}', { status: 400 });
    return new Response(`{"access_token":"synthetic-short","user_id":${BIG_ID},"permissions":["instagram_business_basic","instagram_business_content_publish"]}`, { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url.startsWith("https://graph.instagram.com/access_token")) {
    return new Response(`{"access_token":"synthetic-long-token","token_type":"bearer","expires_in":5184000,"user_id":${BIG_ID}}`, { status: 200, headers: { "content-type": "application/json" } });
  }
  return realFetch(input, init);
};
