import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BarChart, LineChart } from "../components/Charts";
import { Icon } from "../components/Icon";
import { WeighInSheet, StepsSheet } from "../components/LogSheets";
import { Confirm, Loading, Segmented, Sheet, fmt } from "../components/ui";
import { db } from "../db/db";
import type { ISODate, ProgressPhoto, WeighIn } from "../db/types";
import { addDays, longDate, today } from "../domain/dates";
import { currentTarget } from "../domain/checkin";
import { sumEntries } from "../domain/nutrition";
import { toDisplay, useProfile } from "../lib/hooks";
import { exerciseHistory, exerciseProgress } from "../domain/workout";

type Tab = "exercises" | "weight" | "workouts" | "nutrition" | "steps" | "photos";

export default function Progress() {
  const profile = useProfile();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "exercises";
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  if (!profile) return <Loading />;
  return (
    <div className="screen">
      <header className="header"><h1>Progress</h1></header>
      <Segmented label="Progress view" value={tab} onChange={setTab} options={[["exercises", "Lifts"], ["weight", "Weight"], ["workouts", "Workouts"], ["nutrition", "Food"], ["steps", "Steps"], ["photos", "Photos"]]} />
      <div style={{ height: 12 }} />
      {tab === "exercises" && <ExercisesView units={profile.units} />}
      {tab === "weight" && <WeightView units={profile.units} />}
      {tab === "workouts" && <WorkoutsView units={profile.units} />}
      {tab === "nutrition" && <NutritionView />}
      {tab === "steps" && <StepsView goal={profile.stepGoal} />}
      {tab === "photos" && <PhotosView />}
    </div>
  );
}

function WeightView({ units }: { units: "kg" | "lb" }) {
  const [log, setLog] = useState<ISODate | null>(null);
  const [del, setDel] = useState<WeighIn | null>(null);
  const list = useLiveQuery(() => db.weighins.orderBy("date").toArray(), []);
  if (!list) return <Loading />;
  const pts = list.filter((w) => w.date >= addDays(today(), -90)).map((w) => ({ x: w.date, y: toDisplay(w.weightKg, units)! }));
  const change = list.length > 1 ? toDisplay(list.at(-1)!.weightKg - list[0].weightKg, units) : null;
  return (
    <>
      <section className="card">
        <div className="row between">
          <div>
            <div className="big-number">{list.length ? `${fmt(toDisplay(list.at(-1)!.weightKg, units), 1)} ${units}` : "–"}</div>
            <div className="faint">{change != null ? `${change > 0 ? "+" : ""}${fmt(change, 1)} ${units} since ${longDate(list[0].date)}` : "Latest weigh-in"}</div>
          </div>
          <button className="btn small" onClick={() => setLog(today())}><Icon name="plus" size={16} />Log</button>
        </div>
        <LineChart points={pts} label="Body weight, last 90 days" unit={units} />
      </section>
      <div className="card list">
        {list.length === 0 && <div className="empty">No weigh-ins yet.</div>}
        {[...list].reverse().map((w) => (
          <div key={w.id} className="list-item">
            <button className="grow" style={{ border: 0, background: "none", textAlign: "left", padding: 0 }} onClick={() => setLog(w.date)}>
              {longDate(w.date)} <span className="faint">· tap to edit</span>
            </button>
            <strong>{fmt(toDisplay(w.weightKg, units), 1)} {units}</strong>
            <button className="icon-btn" aria-label={`Delete weigh-in ${w.date}`} onClick={() => setDel(w)}><Icon name="trash" /></button>
          </div>
        ))}
      </div>
      <WeighInSheet open={!!log} date={log ?? today()} units={units} onClose={() => setLog(null)} />
      <Confirm open={!!del} title="Delete weigh-in?" confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={() => db.weighins.delete(del!.id!)} />
    </>
  );
}

function WorkoutsView({ units }: { units: "kg" | "lb" }) {
  const data = useLiveQuery(async () => {
    const sessions = (await db.sessions.where("status").equals("completed").toArray()).sort((a, b) => (a.date < b.date ? 1 : -1));
    const sets = await db.sets.toArray();
    const exIds = [...new Set(sets.filter((s) => s.done).map((s) => s.exerciseId))];
    const exercises = (await db.exercises.bulkGet(exIds)).filter(Boolean);
    return { sessions, sets, exercises };
  }, []);
  if (!data) return <Loading />;
  const vol = (id: string) => data.sets.filter((s) => s.sessionId === id && s.done && s.type !== "warmup").reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0);
  return (
    <>
      <h2 className="section-title">Completed workouts</h2>
      <div className="card list">
        {data.sessions.length === 0 && <div className="empty">No completed workouts yet.</div>}
        {data.sessions.map((s) => (
          <Link key={s.id} to={`/session/${s.id}`} className="list-item" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div className="faint">{longDate(s.date)} · {data.sets.filter((x) => x.sessionId === s.id && x.done).length} sets · {fmt(toDisplay(vol(s.id), units))} {units} volume</div>
            </div>
            <Icon name="chevron" size={18} />
          </Link>
        ))}
      </div>
      <h2 className="section-title">Exercise history & records</h2>
      <div className="card list">
        {data.exercises.length === 0 && <div className="empty">Log sets to see exercise history.</div>}
        {data.exercises.map((e) => (
          <Link key={e!.id} to={`/progress/exercise/${e!.id}`} className="list-item" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="grow">{e!.name}</div>
            <Icon name="chevron" size={18} />
          </Link>
        ))}
      </div>
    </>
  );
}

function NutritionView() {
  const data = useLiveQuery(async () => {
    const from = addDays(today(), -13);
    const entries = await db.foodLog.where("date").between(from, today(), true, true).toArray();
    const days = Array.from({ length: 14 }, (_, i) => addDays(from, i));
    const totals = days.map((d) => ({ d, t: sumEntries(entries.filter((e) => e.date === d)) }));
    return { totals, target: await currentTarget(today()) };
  }, []);
  if (!data) return <Loading />;
  const logged = data.totals.filter((x) => x.t.kcal > 0);
  const avg = (k: "kcal" | "protein") => (logged.length ? logged.reduce((a, x) => a + x.t[k], 0) / logged.length : null);
  return (
    <section className="card">
      <h2>Last 14 days</h2>
      <div className="row between">
        <div><div className="big-number">{fmt(avg("kcal"))}</div><div className="faint">avg kcal (logged days)</div></div>
        <div style={{ textAlign: "right" }}><div className="big-number">{fmt(avg("protein"))} g</div><div className="faint">avg protein</div></div>
      </div>
      <BarChart bars={data.totals.map((x) => ({ x: x.d, y: x.t.kcal }))} goal={data.target?.calories} label="Daily calories, last 14 days" />
      <p className="faint">{logged.length} of 14 days logged. Dashed line: current calorie target.</p>
    </section>
  );
}

function StepsView({ goal }: { goal: number }) {
  const [edit, setEdit] = useState<ISODate | null>(null);
  const data = useLiveQuery(async () => {
    const from = addDays(today(), -13);
    const rows = await db.steps.where("date").between(from, today(), true, true).toArray();
    return Array.from({ length: 14 }, (_, i) => addDays(from, i)).map((d) => ({ x: d, y: rows.find((r) => r.date === d)?.steps ?? 0 }));
  }, []);
  if (!data) return <Loading />;
  return (
    <section className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Steps · last 14 days</h2>
        <button className="btn small" onClick={() => setEdit(today())}><Icon name="plus" size={16} />Log</button>
      </div>
      <BarChart bars={data} goal={goal} label="Daily steps, last 14 days" />
      <p className="faint">Goal {goal.toLocaleString()} (dashed). Health app sync isn't available in this web build.</p>
      <StepsSheet open={!!edit} date={edit ?? today()} onClose={() => setEdit(null)} />
    </section>
  );
}

function PhotosView() {
  const photos = useLiveQuery(() => db.photos.orderBy("date").reverse().toArray(), []);
  const [date, setDate] = useState(today());
  const [view, setView] = useState<ProgressPhoto | null>(null);
  const [urls, setUrls] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    if (!photos) return;
    const m = new Map(photos.map((p) => [p.id!, URL.createObjectURL(p.blob)]));
    setUrls(m);
    return () => m.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);
  if (!photos) return <Loading />;
  return (
    <>
      <section className="card">
        <div className="field">
          <label htmlFor="pdate">Photo date (can be backdated)</label>
          <input id="pdate" className="input" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <label className="btn block secondary" style={{ cursor: "pointer" }}>
          <Icon name="camera" />Add progress photo
          <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) await db.photos.add({ date, blob: f, createdAt: Date.now() }); e.target.value = ""; }} />
        </label>
        <p className="faint">Photos are stored only on this device.</p>
      </section>
      {photos.length === 0 ? <div className="empty">No progress photos yet.</div> : (
        <div className="photo-grid">
          {photos.map((p) => (
            <button key={p.id} style={{ border: 0, padding: 0, background: "none" }} onClick={() => setView(p)} aria-label={`Photo from ${longDate(p.date)}`}>
              <img src={urls.get(p.id!)} alt="" />
              <div className="faint">{longDate(p.date)}</div>
            </button>
          ))}
        </div>
      )}
      <Sheet open={!!view} onClose={() => setView(null)} title={view ? longDate(view.date) : ""}>
        {view && (
          <>
            <img src={urls.get(view.id!)} alt={`Progress photo ${view.date}`} style={{ width: "100%", borderRadius: 12 }} />
            <button className="btn block danger" onClick={async () => { await db.photos.delete(view.id!); setView(null); }}>Delete photo</button>
          </>
        )}
      </Sheet>
    </>
  );
}

function ExercisesView({ units }: { units: "kg" | "lb" }) {
  const [q, setQ] = useState("");
  const data = useLiveQuery(async () => {
    const done = (await db.sets.toArray()).filter((s) => s.done);
    const ids = [...new Set(done.map((s) => s.exerciseId))];
    const exercises = (await db.exercises.bulkGet(ids)).filter(Boolean);
    const rows = await Promise.all(
      exercises.map(async (e) => {
        const p = exerciseProgress(await exerciseHistory(e!.id));
        return { ex: e!, latest: p[p.length - 1], first: p[0], count: p.length };
      }),
    );
    return rows.filter((r) => r.latest).sort((a, b) => (a.latest!.date < b.latest!.date ? 1 : -1));
  }, []);
  if (!data) return <Loading />;
  const list = data.filter((r) => r.ex.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      {data.length > 4 && <input className="input" placeholder="Search exercises" aria-label="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />}
      <div className="card list">
        {data.length === 0 && <div className="empty">Finish a workout to see progress for each exercise here.</div>}
        {list.map(({ ex, latest, first, count }) => {
          const diff = count > 1 ? toDisplay(latest!.topWeight - first!.topWeight, units)! : null;
          return (
            <Link key={ex.id} to={`/progress/exercise/${ex.id}`} className="list-item" style={{ color: "inherit", textDecoration: "none" }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{ex.name}</div>
                <div className="faint">{count} workout{count === 1 ? "" : "s"} · last {longDate(latest!.date)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{fmt(toDisplay(latest!.topWeight, units), 1)} {units} × {latest!.topReps}</div>
                {diff != null && <div className="faint">{diff > 0 ? "▲ +" : diff < 0 ? "▼ " : ""}{fmt(diff, 1)} {units}</div>}
              </div>
              <Icon name="chevron" size={18} />
            </Link>
          );
        })}
      </div>
    </>
  );
}
