import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Confirm, Header, Loading, NumberInput, Toggle, Unverified } from "../components/ui";
import { db } from "../db/db";
import { today } from "../domain/dates";
import { currentTarget } from "../domain/checkin";
import { useProfile } from "../lib/hooks";
import { requestNotifications } from "../lib/alerts";

type Theme = "system" | "light" | "dark";
export function applyTheme(t: Theme) {
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

export default function Profile() {
  const p = useProfile();
  const target = useLiveQuery(() => currentTarget(today()), []);
  const ent = useLiveQuery(() => db.entitlements.get("membership"), []);
  const [t, setT] = useState<{ calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem("theme") as Theme) ?? "system"; } catch { return "system"; }
  });
  const [wipe, setWipe] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (target && !t) setT({ calories: target.calories, protein: target.protein, carbs: target.carbs, fat: target.fat });
  }, [target]);
  if (!p) return <Loading />;
  const up = (patch: Partial<typeof p>) => db.profiles.update("me", patch);

  async function exportData() {
    const tables = db.tables.filter((x) => x.name !== "photos");
    const out: Record<string, unknown> = {};
    for (const tb of tables) out[tb.name] = await tb.toArray();
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tracker-export-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="screen">
      <Header title="Profile & Settings" back="/" />
      <section className="card">
        <h2>Profile</h2>
        <div className="field">
          <label htmlFor="pname">Name</label>
          <input id="pname" className="input" defaultValue={p.name} onBlur={(e) => e.target.value.trim() && up({ name: e.target.value.trim() })} />
        </div>
        <div className="field">
          <label>Units</label>
          <div className="chips">{(["kg", "lb"] as const).map((u) => <button key={u} className="chip" aria-pressed={p.units === u} onClick={() => up({ units: u })}>{u}</button>)}</div>
        </div>
        <div className="field">
          <label>Week starts on</label>
          <div className="chips">
            <button className="chip" aria-pressed={p.weekStartsOn === 1} onClick={() => up({ weekStartsOn: 1 })}>Monday</button>
            <button className="chip" aria-pressed={p.weekStartsOn === 0} onClick={() => up({ weekStartsOn: 0 })}>Sunday</button>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Goals</h2>
        <div className="field">
          <label>Weight Pacer — target rate of change (% body weight per week)</label>
          <div className="chips">
            {[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5].map((r) => (
              <button key={r} className="chip" aria-pressed={p.weightPacerPctPerWeek === r} onClick={() => up({ weightPacerPctPerWeek: r })}>{r > 0 ? "+" : ""}{r}%</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Daily step goal</label>
          <div className="input" style={{ padding: 0 }}><NumberInput label="Daily step goal" inputMode="numeric" value={p.stepGoal} onChange={(v) => v && up({ stepGoal: Math.round(v) })} /></div>
        </div>
        <Unverified>Pacer options are provisional; the reference app's selectable rates are unverified.</Unverified>
      </section>

      <section className="card">
        <h2>Nutrition targets</h2>
        {t && (
          <>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
                <div key={k} className="field" style={{ flex: "1 1 40%" }}>
                  <label>{k === "calories" ? "Calories" : `${k[0].toUpperCase()}${k.slice(1)} (g)`}</label>
                  <div className="input" style={{ padding: 0 }}><NumberInput label={`Target ${k}`} inputMode="numeric" value={t[k]} onChange={(v) => setT({ ...t, [k]: v })} /></div>
                </div>
              ))}
            </div>
            <button
              className="btn block secondary"
              disabled={!t.calories}
              onClick={async () => {
                await db.targets.add({ effectiveDate: today(), calories: Math.round(t.calories!), protein: Math.round(t.protein ?? 0), carbs: Math.round(t.carbs ?? 0), fat: Math.round(t.fat ?? 0), source: "manual", createdAt: Date.now() });
                setMsg("Targets updated from today. Past days keep their old targets.");
              }}
            >
              Save targets
            </button>
          </>
        )}
        {msg && <p className="faint" role="status">{msg}</p>}
      </section>

      <section className="card">
        <h2>Reminders & appearance</h2>
        <label className="row between" style={{ padding: "6px 0" }}>
          <span>Weigh-in reminder</span>
          <Toggle checked={p.weighInReminder} onChange={async (v) => { if (v) await requestNotifications(); up({ weighInReminder: v }); }} />
        </label>
        <p className="faint">Web limitation: scheduled reminders need a push service, which this build doesn't have. The preference is stored; a reminder shows on the dashboard checklist.</p>
        <div className="field">
          <label>Appearance</label>
          <div className="chips">
            {(["system", "light", "dark"] as Theme[]).map((x) => (
              <button key={x} className="chip" aria-pressed={theme === x} onClick={() => { setTheme(x); applyTheme(x); try { localStorage.setItem("theme", x); } catch { /* storage blocked */ } }}>{x[0].toUpperCase() + x.slice(1)}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Membership & integrations</h2>
        <div className="row between"><span>Membership</span><span className="badge warn">{ent?.status ?? "unverified"}</span></div>
        <p className="faint">{ent?.note} In-app subscriptions and restore require App Store / Google Play billing, which a web build can't use.</p>
        {[
          ["Apple Health / Health Connect", "Not available on the web"],
          ["Apple Watch live workout sync", "Not available on the web"],
          ["iOS Live Activities", "Not available on the web"],
          ["US grocery prices", "No data source"],
        ].map(([k, v]) => (
          <div key={k} className="row between list-item"><span>{k}</span><span className="faint">{v}</span></div>
        ))}
      </section>

      <section className="card">
        <h2>Data</h2>
        <button className="btn block secondary" onClick={exportData}>Export my data (JSON)</button>
        <button className="btn block danger" style={{ marginTop: 8 }} onClick={() => setWipe(true)}>Delete all data on this device</button>
        <p className="faint">Development control. Not part of the reference app: its support site says progress can't be reset.</p>
      </section>
      <Confirm open={wipe} title="Delete everything?" body="This erases all workouts, food logs, weigh-ins, photos and chats on this device." confirmLabel="Delete all data" danger onClose={() => setWipe(false)} onConfirm={async () => { await db.delete(); location.href = import.meta.env.BASE_URL; }} />
    </div>
  );
}
