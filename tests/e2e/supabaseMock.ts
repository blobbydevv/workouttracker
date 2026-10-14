import type { BrowserContext, Route } from "@playwright/test";

// A stand-in for the Supabase project that speaks the same HTTP protocol the
// real supabase-js client uses (GoTrue auth + PostgREST on public.sync_rows).
// State is shared by every browser context in a test, so two contexts behave
// like a phone and a PC signed in to one account.

export interface Row { user_id: string; tbl: string; pk: string; data: unknown; deleted: boolean; updated_at: string }

export class SupabaseMock {
  users = new Map<string, { id: string; email: string; password: string }>();
  rows = new Map<string, Row>();
  private clock = Date.parse("2026-01-01T00:00:00Z");
  requests: string[] = [];

  now() {
    this.clock = Math.max(this.clock + 1, Date.now());
    return new Date(this.clock).toISOString();
  }

  seedRows(email: string, rows: Array<Omit<Row, "user_id" | "updated_at" | "deleted"> & { deleted?: boolean }>) {
    const u = this.users.get(email)!;
    for (const r of rows) this.rows.set(`${u.id}|${r.tbl}|${r.pk}`, { user_id: u.id, deleted: false, ...r, updated_at: this.now() });
  }

  async install(context: BrowserContext) {
    await context.route(/https:\/\/[a-z]+\.supabase\.co\/.*/, (route) => this.handle(route));
    await context.routeWebSocket(/supabase\.co\/realtime/, (ws) => ws.close());
  }

  private token(user: { id: string; email: string }) {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
  }

  private session(u: { id: string; email: string }) {
    const user = { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email" }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
    return { access_token: this.token(u), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${u.id}`, user };
  }

  private userFrom(route: Route) {
    const auth = route.request().headers()["authorization"] ?? "";
    const tok = auth.replace(/^Bearer /i, "");
    try {
      const payload = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString());
      return [...this.users.values()].find((u) => u.id === payload.sub) ?? null;
    } catch {
      return null;
    }
  }

  private async handle(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const cors = {
      "access-control-allow-origin": req.headers()["origin"] ?? "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,HEAD,OPTIONS",
      "access-control-expose-headers": "content-range",
    };
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({ status, headers: { ...cors, "content-type": "application/json", ...headers }, body: body === undefined ? "" : JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    this.requests.push(`${req.method()} ${url.pathname}${url.search}`);
    const body = req.postData() ? JSON.parse(req.postData()!) : {};

    // ---- auth ----
    if (url.pathname === "/auth/v1/signup") {
      if (this.users.has(body.email)) return json(422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
      const u = { id: crypto.randomUUID(), email: body.email, password: body.password };
      this.users.set(u.email, u);
      return json(200, this.session(u));
    }
    if (url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const u = this.users.get(body.email);
        if (!u || u.password !== body.password) return json(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        return json(200, this.session(u));
      }
      if (grant === "refresh_token") {
        const u = [...this.users.values()].find((x) => `r-${x.id}` === body.refresh_token);
        return u ? json(200, this.session(u)) : json(400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      }
    }
    if (url.pathname === "/auth/v1/user") {
      const u = this.userFrom(route);
      return u ? json(200, this.session(u).user) : json(401, { msg: "invalid JWT" });
    }
    if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, headers: cors });

    // ---- PostgREST: sync_rows with row-level security by token ----
    if (url.pathname === "/rest/v1/sync_rows") {
      const u = this.userFrom(route);
      if (!u) return json(401, { message: "permission denied for table sync_rows" });
      if (req.method() === "POST") {
        for (const r of body as Array<Omit<Row, "updated_at">>) {
          if (r.user_id !== u.id) return json(403, { message: "new row violates row-level security policy" });
          this.rows.set(`${u.id}|${r.tbl}|${r.pk}`, { ...r, updated_at: this.now() });
        }
        return json(201, undefined);
      }
      let list = [...this.rows.values()].filter((r) => r.user_id === u.id);
      for (const [k, v] of url.searchParams) {
        if (["select", "order", "offset", "limit"].includes(k)) continue;
        const [op, ...rest] = v.split(".");
        const val = rest.join(".");
        list = list.filter((r) => {
          const field = String((r as unknown as Record<string, unknown>)[k]);
          if (op === "eq") return field === val;
          if (op === "gte") return field >= val;
          return true;
        });
      }
      list.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      const off = Number(url.searchParams.get("offset") ?? 0);
      const lim = Number(url.searchParams.get("limit") ?? 1e9);
      const page = list.slice(off, off + lim);
      const range = { "content-range": `${page.length ? `${off}-${off + page.length - 1}` : "*"}/${list.length}` };
      if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, ...range } });
      const cols = (url.searchParams.get("select") ?? "*").split(",");
      return json(200, page.map((r) => (cols[0] === "*" ? r : Object.fromEntries(cols.map((c) => [c, (r as unknown as Record<string, unknown>)[c]])))), range);
    }
    return json(404, { message: `mock: unhandled ${req.method()} ${url.pathname}` });
  }
}
