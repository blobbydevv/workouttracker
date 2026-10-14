import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProgressChart } from "../components/ProgressChart";
import { Header, Loading, NumberInput, Segmented, Sheet, fmt } from "../components/ui";
import { db } from "../db/db";
import type { SetRecord } from "../db/types";
import { addDays, longDate, today } from "../domain/dates";
import { e1rm, exerciseHistory, exerciseProgress, personalRecords } from "../domain/workout";
import { fromDisplay, toDisplay, useProfile } from "../lib/hooks";

type Range = "1m" | "3m" | "6m" | "1y" | "all";
const RANGE_DAYS: Record<Range, number | null> = { "1m": 30, "3m": 91, "6m": 182, "1y": 365, all: null };

/** Progress graphs plus editable history; everything is derived from stored sets, so edits update it. */
export default function ExerciseHistory() {
  const { id } = useParams();
  const profile = useProfile();
  const data = useLiveQuery(async () => ({ ex: await db.exercises.get(id!), rows: await exerciseHistory(id!) }), [id]);
  const [edit, setEdit] = useState<SetRecord | null>(null);
  const [range, setRange] = useState<Range>("3m");
  if (!data || !profile) return <Loading />;
  const u = profile.units;
  const pr = personalRecords(data.rows);
  const w = (kg: number | null) => `${fmt(toDisplay(kg, u), 1)} ${u}`;
  const days = RANGE_DAYS[range];
  const progress = exerciseProgress(data.rows).filter((p) => days == null || p.date >= addDays(today(), -days));
  const first = progress[0];
  const last = progress[progress.length - 1];
  const change = first && last && progress.length > 1 ? toDisplay(last.topWeight - first.topWeight, u)! : null;
  return (
    <div className="screen">
      <Header title={data.ex?.name ?? "Exercise"} back />
      {data.rows.length > 0 && (
        <>
          <Segmented label="Time range" value={range} onChange={setRange} options={[["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["1y", "1Y"], ["all", "All"]]} />
          <section className="card" aria-label="Progress" style={{ marginTop: 12 }}>
            <div className="stat-row" style={{ marginBottom: 14 }}>
              <div><span className="faint">Latest</span><b data-testid="stat-latest">{last ? `${fmt(toDisplay(last.topWeight, u), 1)} × ${last.topReps}` : "–"}</b></div>
              <div><span className="faint">Change</span><b data-testid="stat-change">{change == null ? "–" : `${change > 0 ? "+" : ""}${fmt(change, 1)} ${u}`}</b></div>
              <div><span className="faint">Workouts</span><b>{progress.length}</b></div>
            </div>
            <ProgressChart title={`Top set weight (${u})`} unit={u} points={progress.map((p) => ({ date: p.date, value: toDisplay(p.topWeight, u)!, detail: `${p.topReps} reps` }))} />
            <div style={{ height: 18 }} />
            <ProgressChart title="Reps on top set" unit="reps" points={progress.map((p) => ({ date: p.date, value: p.topReps, detail: `at ${fmt(toDisplay(p.topWeight, u), 1)} ${u}` }))} />
            <p className="faint" style={{ marginBottom: 0 }}>Top set = your heaviest working set each workout (warmups excluded). Tap or hover a graph for exact numbers.</p>
          </section>
        </>
      )}
      <section className="card" aria-label="Personal records">
        <h2>Personal records</h2>
        <div className="row between"><span>Heaviest weight</span><strong data-testid="pr-heaviest">{pr.heaviest ? `${w(pr.heaviest.weight)} × ${pr.heaviest.reps}` : "–"}</strong></div>
        <div className="row between"><span>Best estimated 1RM</span><strong>{pr.best1rm ? w(pr.best1rm.value) : "–"}</strong></div>
        <div className="row between"><span>Most reps</span><strong>{pr.mostReps ? `${pr.mostReps.reps} @ ${w(pr.mostReps.weight)}` : "–"}</strong></div>
        <p className="faint">Estimated 1RM uses the Epley formula for display only.</p>
      </section>
      {data.rows.length === 0 && (
        <section className="card empty">
          <strong>No sets logged yet</strong>
          <p className="faint">Tick off a set of this exercise in a workout. Your weight and reps graphs appear here straight away.</p>
        </section>
      )}
      {data.rows.length > 0 && <h2 className="section-title">History</h2>}
      {data.rows.map((r) => (
        <section key={r.session.id} className="card">
          <div className="row between">
            <Link to={`/session/${r.session.id}`} style={{ fontWeight: 600, color: "inherit" }}>{r.session.name}</Link>
            <span className="faint">{longDate(r.session.date)}</span>
          </div>
          <div className="list">
            {r.sets.map((s) => (
              <button key={s.id} className="list-item" onClick={() => setEdit(s)} aria-label={`Edit set ${s.index + 1} from ${r.session.date}`}>
                <span className="faint" style={{ width: 40 }}>{s.type === "warmup" ? "W" : s.index + 1}</span>
                <span className="grow">{w(s.weight)} × {s.reps}</span>
                <span className="faint">e1RM {fmt(toDisplay(e1rm(s.weight ?? 0, s.reps ?? 0), u))}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Edit set">
        {edit && (
          <>
            <div className="row">
              <div className="field grow">
                <label>Weight ({u})</label>
                <div className="input" style={{ padding: 0 }}><NumberInput label="Weight" value={toDisplay(edit.weight, u)} onChange={(v) => setEdit({ ...edit, weight: fromDisplay(v, u) })} /></div>
              </div>
              <div className="field grow">
                <label>Reps</label>
                <div className="input" style={{ padding: 0 }}><NumberInput label="Reps" inputMode="numeric" value={edit.reps} onChange={(v) => setEdit({ ...edit, reps: v == null ? null : Math.round(v) })} /></div>
              </div>
            </div>
            <button className="btn block" onClick={async () => { await db.sets.update(edit.id!, { weight: edit.weight, reps: edit.reps }); setEdit(null); }}>Save</button>
          </>
        )}
      </Sheet>
    </div>
  );
}
