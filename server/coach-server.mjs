// App server: AI endpoints (Claude) + static hosting of the built app.
//
// This is an independent assistant. The original BWS assistant's prompts,
// model and configuration are undisclosed; nothing here claims to reproduce
// them. Without ANTHROPIC_API_KEY (or another SDK credential) the endpoints
// return 503 and the app shows a "not configured" state.
import Anthropic from "@anthropic-ai/sdk";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = "claude-opus-5-5";
const DIST = join(fileURLToPath(new URL(".", import.meta.url)), "..", "dist");
const MAX_BODY = 8 * 1024 * 1024;

const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = configured ? new Anthropic() : null;

const COACH_SYSTEM = `You are a fitness and nutrition coach inside a strength-training and food-logging app.
Answer questions about training, progressive overload, nutrition, and the user's own progress.
A JSON snapshot of the user's data is provided in each request; use it when relevant and say when data is missing.
Keep answers practical and concise. You are not a doctor: for pain, injury, medical conditions or disordered eating, recommend a qualified professional.
Do not claim to be the Built With Science coach or to know its internal algorithms.`;

const FOOD_SYSTEM = `You estimate the nutrition of food from a photo or description for a food log.
List each distinct food item with a sensible portion description and your best estimate of calories and macronutrients for that portion.
If the input isn't food, return an empty items list and explain in note. Estimates are approximate; mention major uncertainty in note.`;

const FOOD_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          servingLabel: { type: "string" },
          kcal: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
        },
        required: ["name", "servingLabel", "kcal", "protein", "carbs", "fat"],
        additionalProperties: false,
      },
    },
    note: { type: "string" },
  },
  required: ["items", "note"],
  additionalProperties: false,
};

async function callClaude(params) {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", ...(params.output_config ?? {}) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: params.system,
    messages: params.messages,
  });
  if (res.stop_reason === "refusal") {
    const err = new Error("The assistant declined this request.");
    err.status = 422;
    throw err;
  }
  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

function validMessages(m) {
  return (
    Array.isArray(m) &&
    m.length > 0 &&
    m.length <= 100 &&
    m.every((x) => (x.role === "user" || x.role === "assistant") && typeof x.content === "string" && x.content.length <= 8000) &&
    m.at(-1).role === "user"
  );
}

async function handleCoach(body) {
  if (!validMessages(body.messages)) return [400, { error: "Invalid conversation." }];
  const ctx = JSON.stringify(body.context ?? {}).slice(0, 20000);
  const messages = body.messages.map((m, i) =>
    i === body.messages.length - 1 ? { role: "user", content: `<user_data>${ctx}</user_data>\n\n${m.content}` } : m,
  );
  const reply = await callClaude({ system: COACH_SYSTEM, messages });
  return [200, { reply }];
}

async function handleFood(body) {
  let content;
  if (typeof body.text === "string" && body.text.trim()) content = [{ type: "text", text: `Food eaten: ${body.text.slice(0, 2000)}` }];
  else if (body.image && typeof body.image.data === "string" && /^image\/(jpeg|png|webp|gif)$/.test(body.image.mediaType))
    content = [
      { type: "image", source: { type: "base64", media_type: body.image.mediaType, data: body.image.data } },
      { type: "text", text: "Estimate the nutrition of this meal." },
    ];
  else return [400, { error: "Provide a description or an image." }];
  const text = await callClaude({
    system: FOOD_SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: FOOD_SCHEMA } },
  });
  try {
    return [200, JSON.parse(text)];
  } catch {
    return [502, { error: "The estimate couldn't be read. Try again." }];
  }
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  let p = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!p.startsWith(DIST)) return send(res, 403, { error: "Forbidden" });
  try {
    if (!(await stat(p)).isFile()) throw new Error();
  } catch {
    p = join(DIST, "index.html"); // SPA fallback
  }
  try {
    const data = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    send(res, 404, { error: "Build not found. Run npm run build." });
  }
}

function send(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request too large."), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (!path.startsWith("/api/")) return serveStatic(req, res);
  if (path === "/api/health") return send(res, 200, { ok: true, ai: configured });
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!client) return send(res, 503, { error: "AI features aren't configured: set ANTHROPIC_API_KEY on the server." });
  try {
    const body = await readBody(req);
    const [status, out] = path === "/api/coach" ? await handleCoach(body) : path === "/api/food/estimate" ? await handleFood(body) : [404, { error: "Not found" }];
    send(res, status, out);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: "The AI service is busy. Try again shortly." });
    if (e instanceof Anthropic.AuthenticationError) return send(res, 503, { error: "The server's AI credentials are invalid." });
    if (e instanceof Anthropic.APIConnectionError) return send(res, 502, { error: "Couldn't reach the AI service." });
    if (e instanceof Anthropic.APIError) return send(res, 502, { error: `AI service error (${e.status ?? "unknown"}).` });
    send(res, e.status ?? 500, { error: e.message ?? "Server error." });
  }
}).listen(PORT, () => console.log(`App server on http://localhost:${PORT} (AI ${configured ? "enabled" : "not configured"})`));
