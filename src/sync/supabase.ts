import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { RemoteRow, SyncBackend } from "./engine";

// Public client settings. The publishable key is designed to ship in web apps:
// row-level security on public.sync_rows limits every account to its own rows.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://gizdyxulqmievjrnbpni.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_p2ad3N_VJ4fCIQQOEs2Xag_GDFjQRoL";

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export class SupabaseBackend implements SyncBackend {
  constructor(private sb: SupabaseClient, private userId: string) {}

  async push(rows: RemoteRow[]) {
    const { error } = await this.sb
      .from("sync_rows")
      .upsert(rows.map((r) => ({ user_id: this.userId, tbl: r.tbl, pk: r.pk, data: r.data, deleted: r.deleted })), { onConflict: "user_id,tbl,pk" });
    if (error) throw new Error(error.message);
  }

  async pull(since: string | null) {
    const out: RemoteRow[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = this.sb.from("sync_rows").select("tbl,pk,data,deleted,updated_at").order("updated_at", { ascending: true }).range(from, from + PAGE - 1);
      if (since) q = q.gte("updated_at", since);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      out.push(...(data as RemoteRow[]));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  /** Calls `onChange` when another device writes (realtime), so we pull promptly. */
  watch(onChange: () => void): RealtimeChannel {
    return this.sb
      .channel(`sync-${this.userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sync_rows", filter: `user_id=eq.${this.userId}` }, onChange)
      .subscribe();
  }
}
