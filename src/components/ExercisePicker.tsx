import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "../db/db";
import type { ExerciseDef } from "../db/types";
import { Segmented, Sheet } from "./ui";
import { Icon } from "./Icon";
import { ExerciseThumb } from "./ExerciseImage";
import { createCustomExercise } from "../domain/plans";

/** Documented: swapping offers alternatives or browsing the library. */
export function ExercisePicker({ open, onClose, onPick, forExerciseId, title }: { open: boolean; onClose: () => void; onPick: (e: ExerciseDef) => void; forExerciseId?: string; title: string }) {
  const [tab, setTab] = useState<"alt" | "browse">(forExerciseId ? "alt" : "browse");
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string>("All");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState("Chest");
  const [newWeighted, setNewWeighted] = useState(true);
  useEffect(() => {
    if (open) {
      setTab(forExerciseId ? "alt" : "browse");
      setQ("");
      setCreating(false);
    }
  }, [open, forExerciseId]);
  const data = useLiveQuery(async () => {
    const all = await db.exercises.toArray();
    const cur = forExerciseId ? all.find((e) => e.id === forExerciseId) : undefined;
    const alts = cur ? all.filter((e) => cur.alternatives.includes(e.id) || (e.muscle === cur.muscle && e.id !== cur.id)) : [];
    return { all, alts, muscles: ["All", ...new Set(all.map((e) => e.muscle))] };
  }, [forExerciseId]);
  if (!data) return null;
  const list = tab === "alt" ? data.alts : data.all.filter((e) => (muscle === "All" || e.muscle === muscle) && e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {forExerciseId && (
        <div style={{ marginBottom: 12 }}>
          <Segmented label="Swap source" value={tab} onChange={setTab} options={[["alt", "Alternatives"], ["browse", "Browse"]]} />
        </div>
      )}
      {tab === "browse" && (
        <>
          <input className="input" placeholder="Search exercises" aria-label="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips" style={{ margin: "10px 0", overflowX: "auto", flexWrap: "nowrap" }}>
            {data.muscles.map((m) => (
              <button key={m} className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>{m}</button>
            ))}
          </div>
        </>
      )}
      {tab === "browse" && (
        creating ? (
          <div className="card" style={{ background: "var(--surface-2)", boxShadow: "none" }}>
            <div className="field">
              <label htmlFor="newex">Exercise name</label>
              <input id="newex" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Cable Y-Raise" />
            </div>
            <div className="field">
              <label htmlFor="newmuscle">Main muscle</label>
              <select id="newmuscle" className="input" value={newMuscle} onChange={(e) => setNewMuscle(e.target.value)}>
                {data.muscles.filter((m) => m !== "All").map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <label className="row between" style={{ marginBottom: 12 }}>
              <span>Uses added weight (dumbbells, barbell, machine)</span>
              <input type="checkbox" checked={newWeighted} onChange={(e) => setNewWeighted(e.target.checked)} style={{ width: 22, height: 22 }} />
            </label>
            <div className="row">
              <button className="btn secondary grow" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn grow" disabled={newName.trim().length < 2} onClick={async () => { const ex = await createCustomExercise(newName, newMuscle, newWeighted); setCreating(false); onPick(ex); onClose(); }}>Create & add</button>
            </div>
          </div>
        ) : (
          <button className="btn block ghost" onClick={() => { setNewName(q); setCreating(true); }}><Icon name="plus" />Create a new exercise{q ? ` “${q}”` : ""}</button>
        )
      )}
      <div className="list">
        {list.length === 0 && <div className="empty">No exercises found.</div>}
        {list.map((e) => (
          <button key={e.id} className="list-item" onClick={() => { onPick(e); onClose(); }}>
            <ExerciseThumb id={e.id} name={e.name} size={40} still />
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{e.name}</div>
              <div className="faint">{e.muscle} · {e.equipment}</div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
