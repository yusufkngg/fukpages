import { getStore } from "@netlify/blobs";
import { createDemoHandler } from "../../server/netlify-demo.mjs";
import deployment from "../.deployment-context.json" with { type: "json" };

export default async function handler(request, context) {
  // Production keeps the same store on every deploy. Preview deploys are
  // isolated so they cannot change the owner's production data or sessions.
  const store = getStore({
    name: `fukpages-demo-${deployment.scope}`,
    consistency: "strong",
  });
  const url = new URL(request.url);
  const event = {
    httpMethod: request.method,
    path: url.pathname,
    headers: { ...Object.fromEntries(request.headers), host: url.host },
    body: Buffer.from(await request.arrayBuffer()).toString("base64"),
    isBase64Encoded: true,
    queryStringParameters: Object.fromEntries(url.searchParams),
    requestContext: { identity: { sourceIp: context.ip || "unknown" } },
  };
  // The platform supplies context.ip. Discard a caller-supplied proxy IP.
  delete event.headers["x-nf-client-connection-ip"];
  const result = await createDemoHandler({
    store,
    password: process.env.FUKPAGES_DEMO_PASSWORD,
    ownerHash: process.env.OWNER_PASSWORD_HASH,
    ownerLogin: process.env.OWNER_LOGIN || "owner",
  })(event, context);
  const headers = new Headers(result.headers);
  for (const [key, values] of Object.entries(result.multiValueHeaders || {})) {
    headers.delete(key);
    for (const value of values) headers.append(key, value);
  }
  return new Response(
    result.statusCode === 204 || request.method === "HEAD"
      ? null
      : Buffer.from(result.body, result.isBase64Encoded ? "base64" : "utf8"),
    { status: result.statusCode, headers },
  );
}
