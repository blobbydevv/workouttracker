// Claude-backed AI handlers shared by the Node server and the Netlify function.
//
// This is an independent assistant. The original BWS assistant's prompts,
// model and configuration are undisclosed; nothing here claims to reproduce
// them. Without ANTHROPIC_API_KEY (or another SDK credential) requests get a
// 503 and the app shows a "not configured" state.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";

export const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
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

/** Routes one API request. Returns [status, json]. */
export async function handleApi(path, method, readJson) {
  if (path === "/api/health") return [200, { ok: true, ai: configured }];
  if (method !== "POST") return [405, { error: "Method not allowed" }];
  if (!client) return [503, { error: "AI features aren't configured: set ANTHROPIC_API_KEY on the server." }];
  try {
    const body = await readJson();
    if (path === "/api/coach") return await handleCoach(body);
    if (path === "/api/food/estimate") return await handleFood(body);
    return [404, { error: "Not found" }];
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return [429, { error: "The AI service is busy. Try again shortly." }];
    if (e instanceof Anthropic.AuthenticationError) return [503, { error: "The server's AI credentials are invalid." }];
    if (e instanceof Anthropic.APIConnectionError) return [502, { error: "Couldn't reach the AI service." }];
    if (e instanceof Anthropic.APIError) return [502, { error: `AI service error (${e.status ?? "unknown"}).` }];
    return [e.status ?? 500, { error: e.message ?? "Server error." }];
  }
}
