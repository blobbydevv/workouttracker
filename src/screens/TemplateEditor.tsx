import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ExercisePicker } from "../components/ExercisePicker";
import { ExerciseThumb } from "../components/ExerciseImage";
import { Icon } from "../components/Icon";
import { Header, Loading, NumberInput, Sheet } from "../components/ui";
import { db, uid } from "../db/db";
import type { TemplateItem } from "../db/types";
import { groupItems, removeFromSuperset, removeItem, replaceExercise, supersetWith } from "../domain/items";

/** Edits a workout day. Changes affect future sessions only; past sessions are snapshots. */
export default function TemplateEditor() {
  const { id } = useParams();
  const tpl = useLiveQuery(async () => (await db.templates.get(id!)) ?? null, [id]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const [menu, setMenu] = useState<TemplateItem | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; item: TemplateItem } | null>(null);
  const [pairFor, setPairFor] = useState<TemplateItem | null>(null);
  const [edit, setEdit] = useState<TemplateItem | null>(null);

  if (tpl === undefined || !exercises) return <Loading />;
  if (tpl === null) return <div className="screen"><Header title="Workout" back /><div className="empty">This workout no longer exists.</div></div>;
  const setItems = (items: TemplateItem[]) => db.templates.update(tpl.id, { items });
  const name = (i: TemplateItem) => exercises.get(i.exerciseId)?.name ?? "Unknown";

  return (
    <div className="screen no-tabbar">
      <Header title="Edit Workout" back />
      <div className="field">
        <label htmlFor="tname">Workout name</label>
        <input id="tname" className="input" defaultValue={tpl.name} onBlur={(e) => e.target.value.trim() && db.templates.update(tpl.id, { name: e.target.value.trim() })} />
      </div>
      {tpl.items.length === 0 && <div className="empty">No exercises yet.</div>}
      {groupItems(tpl.items).map((g, gi) => (
        <div key={gi} className={`ex-card ${g.supersetId && g.items.length > 1 ? "superset" : ""}`}>
          {g.supersetId && g.items.length > 1 && <div className="faint" style={{ padding: "8px 12px 0" }}>Superset</div>}
          {g.items.map((it) => (
            <div key={it.id} className="ex-head">
              <ExerciseThumb id={it.exerciseId} name={name(it)} size={44} />
              <div className="grow">
                <h4>{name(it)}</h4>
                <div className="faint">{it.sets} sets · {it.repMin}–{it.repMax} reps</div>
              </div>
              <button className="icon-btn" aria-label={`Options for ${name(it)}`} onClick={() => setMenu(it)}><Icon name="more" /></button>
            </div>
          ))}
        </div>
      ))}
      <button className="btn block secondary" onClick={() => setPicker({ mode: "add" })}><Icon name="plus" />Add Exercise</button>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu ? name(menu) : ""}>
        {menu && (
          <>
            <button className="menu-item" onClick={() => { setEdit(menu); setMenu(null); }}><Icon name="edit" />Edit sets & reps</button>
            <button className="menu-item" onClick={() => { setPicker({ mode: "swap", item: menu }); setMenu(null); }}><Icon name="swap" />Swap Exercise</button>
            <button className="menu-item" onClick={() => { setPairFor(menu); setMenu(null); }}><Icon name="link" />Superset With</button>
            {menu.supersetId && <button className="menu-item" onClick={() => { setItems(removeFromSuperset(tpl.items, menu.id)); setMenu(null); }}><Icon name="link" />Remove from Superset</button>}
            <button className="menu-item danger" onClick={() => { setItems(removeItem(tpl.items, menu.id)); setMenu(null); }}><Icon name="trash" />Remove Exercise</button>
          </>
        )}
      </Sheet>

      <Sheet open={!!pairFor} onClose={() => setPairFor(null)} title="Superset With">
        <div className="list">
          {pairFor && tpl.items.filter((i) => i.id !== pairFor.id && (!pairFor.supersetId || i.supersetId !== pairFor.supersetId)).map((i) => (
            <button key={i.id} className="list-item" onClick={() => { setItems(supersetWith(tpl.items, pairFor.id, i.id, uid)); setPairFor(null); }}>
              <div className="grow">{name(i)}</div>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Sets & reps">
        {edit && (
          <>
            <div className="row">
              {(["sets", "repMin", "repMax"] as const).map((k) => (
                <div key={k} className="field grow">
                  <label>{k === "sets" ? "Sets" : k === "repMin" ? "Min reps" : "Max reps"}</label>
                  <div className="input" style={{ padding: 0 }}>
                    <NumberInput label={k} inputMode="numeric" min={1} value={edit[k]} onChange={(v) => setEdit({ ...edit, [k]: Math.max(1, Math.round(v ?? 1)) })} />
                  </div>
                </div>
              ))}
            </div>
            {edit.repMin > edit.repMax && <div className="notice error">Min reps must not exceed max reps.</div>}
            <button className="btn block" disabled={edit.repMin > edit.repMax} onClick={() => { setItems(replaceExercise(tpl.items, edit.id, { sets: edit.sets, repMin: edit.repMin, repMax: edit.repMax })); setEdit(null); }}>Save</button>
          </>
        )}
      </Sheet>

      <ExercisePicker
        open={!!picker}
        onClose={() => setPicker(null)}
        title={picker?.mode === "swap" ? "Swap Exercise" : "Add Exercise"}
        forExerciseId={picker?.mode === "swap" ? picker.item.exerciseId : undefined}
        onPick={(e) => {
          if (picker?.mode === "swap") setItems(replaceExercise(tpl.items, picker.item.id, { exerciseId: e.id }));
          else setItems([...tpl.items, { id: uid(), exerciseId: e.id, sets: 3, repMin: 8, repMax: 12 }]);
        }}
      />
    </div>
  );
}
