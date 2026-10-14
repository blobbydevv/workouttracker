// Netlify Function serving /api/* with the same handlers as the Node server.
// Set ANTHROPIC_API_KEY in Netlify → Site configuration → Environment variables to enable AI.
import { handleApi } from "../../server/ai.mjs";

export default async (req) => {
  const path = new URL(req.url).pathname;
  const readJson = async () => {
    const text = await req.text();
    if (text.length > 8 * 1024 * 1024) throw Object.assign(new Error("Request too large."), { status: 413 });
    try {
      return JSON.parse(text || "{}");
    } catch {
      throw Object.assign(new Error("Invalid JSON."), { status: 400 });
    }
  };
  const [status, body] = await handleApi(path, req.method, readJson);
  return Response.json(body, { status });
};

export const config = { path: "/api/*" };
