import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Header, Loading, NumberInput, Sheet, fmt } from "../components/ui";
import { db } from "../db/db";
import type { SetRecord } from "../db/types";
import { longDate } from "../domain/dates";
import { e1rm, exerciseHistory, personalRecords } from "../domain/workout";
import { fromDisplay, toDisplay, useProfile } from "../lib/hooks";

/** Editable exercise history; PRs are derived from stored sets, so edits update them. */
export default function ExerciseHistory() {
  const { id } = useParams();
  const profile = useProfile();
  const data = useLiveQuery(async () => ({ ex: await db.exercises.get(id!), rows: await exerciseHistory(id!) }), [id]);
  const [edit, setEdit] = useState<SetRecord | null>(null);
  if (!data || !profile) return <Loading />;
  const u = profile.units;
  const pr = personalRecords(data.rows);
  const w = (kg: number | null) => `${fmt(toDisplay(kg, u), 1)} ${u}`;
  return (
    <div className="screen">
      <Header title={data.ex?.name ?? "Exercise"} back />
      <section className="card" aria-label="Personal records">
        <h2>Personal records</h2>
        <div className="row between"><span>Heaviest weight</span><strong data-testid="pr-heaviest">{pr.heaviest ? `${w(pr.heaviest.weight)} × ${pr.heaviest.reps}` : "–"}</strong></div>
        <div className="row between"><span>Best estimated 1RM</span><strong>{pr.best1rm ? w(pr.best1rm.value) : "–"}</strong></div>
        <div className="row between"><span>Most reps</span><strong>{pr.mostReps ? `${pr.mostReps.reps} @ ${w(pr.mostReps.weight)}` : "–"}</strong></div>
        <p className="faint">Estimated 1RM uses the Epley formula for display only.</p>
      </section>
      {data.rows.length === 0 && <div className="empty">No completed sets for this exercise yet.</div>}
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
