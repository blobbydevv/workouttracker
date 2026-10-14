import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "../db/db";
import type { ExerciseDef } from "../db/types";
import { Segmented, Sheet } from "./ui";

/** Documented: swapping offers alternatives or browsing the library. */
export function ExercisePicker({ open, onClose, onPick, forExerciseId, title }: { open: boolean; onClose: () => void; onPick: (e: ExerciseDef) => void; forExerciseId?: string; title: string }) {
  const [tab, setTab] = useState<"alt" | "browse">(forExerciseId ? "alt" : "browse");
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string>("All");
  useEffect(() => {
    if (open) {
      setTab(forExerciseId ? "alt" : "browse");
      setQ("");
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
      <div className="list">
        {list.length === 0 && <div className="empty">No exercises found.</div>}
        {list.map((e) => (
          <button key={e.id} className="list-item" onClick={() => { onPick(e); onClose(); }}>
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
