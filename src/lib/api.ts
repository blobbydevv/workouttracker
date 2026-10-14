// Client for this app's own server (server/coach-server.mjs). The original
// BWS assistant's prompts, model and data access are undisclosed; this is an
// independent Claude-backed implementation and is labelled as such in the UI.

export interface Estimate {
  items: Array<{ name: string; servingLabel: string; kcal: number; protein: number; carbs: number; fat: number }>;
  note?: string;
}

export class ApiError extends Error {
  constructor(message: string, public code: "not_configured" | "offline" | "unreachable" | "server" | "refused") {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  if (!navigator.onLine) throw new ApiError("You're offline. Connect to use AI features.", "offline");
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Couldn't reach the AI service. Check that the app server is running.", "unreachable");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) throw new ApiError(data.error ?? "The AI service isn't configured on this server.", "not_configured");
  if (res.status === 422) throw new ApiError(data.error ?? "The request was declined.", "refused");
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status}).`, "server");
  return data as T;
}

export const estimateFood = (input: { text: string } | { image: { data: string; mediaType: string } }) => post<Estimate>("/api/food/estimate", input);

export const coachReply = (messages: Array<{ role: "user" | "assistant"; content: string }>, context: unknown, signal?: AbortSignal) =>
  post<{ reply: string }>("/api/coach", { messages, context }, signal);
