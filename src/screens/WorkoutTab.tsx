import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Loading, Sheet, Unverified } from "../components/ui";
import { useWorkoutLauncher } from "../components/WorkoutLauncher";
import { db, uid } from "../db/db";
import type { WorkoutTemplate } from "../db/types";
import { dayNum, dayShort, today, weekDays, weekStartOf } from "../domain/dates";
import { PROGRAM_ID } from "../domain/onboarding";
import { hasBackToBack, moveSlot, saveLayoutFrom, versionForWeek, type Slot } from "../domain/schedule";
import { useProfile } from "../lib/hooks";
import { startQuickWorkout } from "../domain/plans";
import { activeSession } from "../domain/workout";

export default function WorkoutTab() {
  const profile = useProfile();
  const nav = useNavigate();
  const wso = profile?.weekStartsOn ?? 1;
  const weekStart = weekStartOf(today(), wso);
  const { launch, sheet: launcherSheet } = useWorkoutLauncher(wso);
  const [menu, setMenu] = useState<number | null>(null);
  const [weekMenu, setWeekMenu] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [pickFor, setPickFor] = useState<{ idx: number; mode: "add" | "swap" } | null>(null);
  const [renameIdx, setRenameIdx] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");
  const [moveFrom, setMoveFrom] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  const data = useLiveQuery(async () => {
    const v = await versionForWeek(PROGRAM_ID, weekStart);
    const slots: Slot[] = v?.slots ?? Array.from({ length: 7 }, () => ({ templateId: null }));
    const templates = await db.templates.toArray();
    const byId = new Map(templates.map((t) => [t.id, t]));
    const sessions = await db.sessions.where("weekStart").equals(weekStart).toArray();
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    const muscles = slots.map((s) => {
      const t = s.templateId ? byId.get(s.templateId) : undefined;
      return t ? new Set(t.items.map((i) => exercises.get(i.exerciseId)?.muscle ?? "")) : null;
    });
    const planName = (await db.programs.get(PROGRAM_ID))?.name;
    return { slots, templates, byId, sessions, conflicts: hasBackToBack(muscles), planName: planName === "My Program" ? null : planName };
  }, [weekStart]);

  if (!profile || !data) return <Loading />;
  const days = weekDays(weekStart);

  async function quickLog() {
    const active = await activeSession();
    if (active) return nav(`/session/${active.id}`);
    const s = await startQuickWorkout(wso);
    nav(`/session/${s.id}?add=1`);
  }

  const save = (slots: Slot[]) => saveLayoutFrom(PROGRAM_ID, weekStart, slots);
  const scheduledIds = new Set(data.slots.map((s) => s.templateId).filter(Boolean) as string[]);
  const candidates = data.templates.filter((t) => t.inLibrary || scheduledIds.has(t.id));

  async function deleteDay(idx: number, keep: boolean) {
    const id = data!.slots[idx].templateId!;
    const next = data!.slots.map((s, i) => (i === idx ? { templateId: null } : s));
    await save(next);
    if (keep) await db.templates.update(id, { inLibrary: true });
    else {
      // Permanent: remove unless history or another day still references it.
      const stillScheduled = next.some((s) => s.templateId === id);
      const versions = await db.programVersions.toArray();
      const referenced = versions.some((v) => v.slots.some((s) => s.templateId === id));
      if (!stillScheduled && !referenced) await db.templates.delete(id);
      else await db.templates.update(id, { inLibrary: false });
    }
  }

  async function assign(idx: number, tpl: WorkoutTemplate) {
    await save(data!.slots.map((s, i) => (i === idx ? { templateId: tpl.id, label: s.label } : s)));
  }

  async function newWorkout(idx: number) {
    const t: WorkoutTemplate = { id: uid(), name: "New Workout", items: [], inLibrary: false, createdAt: Date.now() };
    await db.templates.add(t);
    await assign(idx, t);
    nav(`/workout/template/${t.id}`);
  }

  // Pointer-driven drag on the handle; dropping on another day swaps them.
  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from: i, over: i });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-day-idx]");
    if (el) setDrag({ ...drag, over: Number(el.dataset.dayIdx) });
  };
  const onPointerUp = async () => {
    if (drag && drag.over !== drag.from) await save(moveSlot(data.slots, drag.from, drag.over));
    setDrag(null);
  };

  const menuSlot = menu != null ? data.slots[menu] : null;
  const menuTpl = menuSlot?.templateId ? data.byId.get(menuSlot.templateId) : undefined;

  return (
    <div className="screen">
      <header className="header">
        <h1>Workout</h1>
        <Link className="icon-btn" to="/workout/library" aria-label="Workout Library"><Icon name="library" /></Link>
      </header>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <Link to="/workout/plans" className="btn secondary grow" style={{ textDecoration: "none" }}><Icon name="book" />Workout plans</Link>
        <button className="btn grow" onClick={quickLog}><Icon name="plus" />Quick log</button>
      </div>
      {data.planName && <p className="faint" style={{ margin: "0 4px 6px" }}>Current plan: <strong>{data.planName}</strong></p>}
      <div className="row between" style={{ margin: "4px 4px 8px" }}>
        <strong>This Week's Schedule</strong>
        <button className="icon-btn" aria-label="Schedule options" onClick={() => setWeekMenu(true)}><Icon name="more" /></button>
      </div>
      <p className="faint" style={{ margin: "0 4px 10px" }}>Press and drag a day to move it. Changes apply to this and future weeks.</p>

      <div onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
        {data.slots.map((slot, i) => {
          const tpl = slot.templateId ? data.byId.get(slot.templateId) : undefined;
          const session = tpl ? data.sessions.find((s) => s.date === days[i] && s.templateId === tpl.id) : undefined;
          const isToday = days[i] === today();
          return (
            <div key={i} data-day-idx={i} data-date={days[i]} className={`day-row ${drag?.from === i ? "dragging" : ""} ${drag && drag.over === i && drag.from !== i ? "drop-target" : ""}`}>
              <button className="handle" aria-label={`Drag ${dayShort(days[i])}`} onPointerDown={onPointerDown(i)}><Icon name="grip" /></button>
              <div className="when">
                <span className="faint">{dayShort(days[i])}</span>
                <b style={isToday ? { color: "var(--accent)" } : undefined}>{dayNum(days[i])}</b>
              </div>
              <button
                className="grow"
                style={{ border: 0, background: "none", textAlign: "left", padding: 0 }}
                onClick={() => (tpl ? launch(days[i], tpl.id) : setPickFor({ idx: i, mode: "add" }))}
              >
                <div style={{ fontWeight: 600 }}>{slot.label ? `${slot.label} · ` : ""}{tpl ? tpl.name : "Rest"}</div>
                <div className="faint">
                  {tpl ? `${tpl.items.length} exercises` : "Tap to add a workout"}
                  {data.conflicts.includes(i) && <span className="badge warn" style={{ marginLeft: 6 }}>Similar muscles back-to-back</span>}
                </div>
              </button>
              {session && <span className={`badge ${session.status === "completed" ? "ok" : "accent"}`}>{session.status === "completed" ? "Done" : "In progress"}</span>}
              <button className="icon-btn" aria-label={`Options for ${dayShort(days[i])}`} onClick={() => setMenu(i)}><Icon name="more" /></button>
            </div>
          );
        })}
      </div>
      {data.conflicts.length > 0 && <Unverified>The back-to-back warning uses a provisional rule (two or more shared muscle groups on consecutive days); the reference app's exact rule is unverified.</Unverified>}

      <Sheet open={menu != null} onClose={() => setMenu(null)} title={menu != null ? `${dayShort(days[menu])} ${dayNum(days[menu])}` : ""}>
        {menu != null && menuTpl && (
          <>
            <button className="menu-item" onClick={() => { const i = menu; setMenu(null); launch(days[i], menuTpl.id); }}><Icon name="play" />Start Workout</button>
            <button className="menu-item" onClick={() => { setPickFor({ idx: menu, mode: "swap" }); setMenu(null); }}><Icon name="swap" />Swap Workout</button>
            <button className="menu-item" onClick={() => nav(`/workout/template/${menuTpl.id}`)}><Icon name="edit" />Edit Exercises</button>
            <button className="menu-item" onClick={() => { setMoveFrom(menu); setMenu(null); }}><Icon name="grip" />Move to another day</button>
            <button className="menu-item" onClick={() => { setRenameIdx(menu); setRenameText(menuSlot?.label ?? ""); setMenu(null); }}><Icon name="edit" />Rename Day</button>
            <button className="menu-item danger" onClick={() => { setDeleteIdx(menu); setMenu(null); }}><Icon name="trash" />Delete Workout</button>
          </>
        )}
        {menu != null && !menuTpl && (
          <>
            <button className="menu-item" onClick={() => { setPickFor({ idx: menu, mode: "add" }); setMenu(null); }}><Icon name="plus" />Add Workout</button>
            <button className="menu-item" onClick={() => { setMoveFrom(menu); setMenu(null); }}><Icon name="grip" />Move to another day</button>
          </>
        )}
      </Sheet>

      <Sheet open={deleteIdx != null} onClose={() => setDeleteIdx(null)} title="Delete Workout">
        <p className="muted">Remove this workout from your schedule. Saving it to your Workout Library lets you add it back later.</p>
        <div className="list" style={{ gap: 8 }}>
          <button className="btn block" onClick={async () => { await deleteDay(deleteIdx!, true); setDeleteIdx(null); }}>Save to Workout Library</button>
          <button className="btn block danger" style={{ border: "1px solid var(--danger)" }} onClick={async () => { await deleteDay(deleteIdx!, false); setDeleteIdx(null); }}>Delete Permanently</button>
          <button className="btn block secondary" onClick={() => setDeleteIdx(null)}>Cancel</button>
        </div>
      </Sheet>

      <Sheet open={pickFor != null} onClose={() => setPickFor(null)} title={pickFor?.mode === "swap" ? "Swap Workout" : "Add Workout"}>
        <div className="list">
          {candidates.filter((t) => t.id !== data.slots[pickFor?.idx ?? 0]?.templateId).map((t) => (
            <button key={t.id} className="list-item" onClick={async () => { await assign(pickFor!.idx, t); setPickFor(null); }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div className="faint">{t.items.length} exercises · {t.inLibrary ? "Workout Library" : "Program"}</div>
              </div>
            </button>
          ))}
          {pickFor?.mode === "add" && (
            <button className="list-item" onClick={() => { const i = pickFor.idx; setPickFor(null); newWorkout(i); }}>
              <Icon name="plus" /><div className="grow" style={{ fontWeight: 600 }}>Create new workout</div>
            </button>
          )}
        </div>
      </Sheet>

      <Sheet open={moveFrom != null} onClose={() => setMoveFrom(null)} title="Move to…">
        <div className="list">
          {days.map((d, i) => i !== moveFrom && (
            <button key={d} className="list-item" onClick={async () => { await save(moveSlot(data.slots, moveFrom!, i)); setMoveFrom(null); }}>
              <div className="grow">{dayShort(d)} {dayNum(d)} <span className="faint">· {data.slots[i].templateId ? data.byId.get(data.slots[i].templateId!)?.name : "Rest"}</span></div>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={renameIdx != null} onClose={() => setRenameIdx(null)} title="Rename Day">
        <input className="input" aria-label="Day name" value={renameText} onChange={(e) => setRenameText(e.target.value)} placeholder="e.g. Push Day" />
        <button className="btn block" style={{ marginTop: 12 }} onClick={async () => { await save(data.slots.map((s, i) => (i === renameIdx ? { ...s, label: renameText.trim() || undefined } : s))); setRenameIdx(null); }}>Save</button>
      </Sheet>

      <Sheet open={weekMenu} onClose={() => setWeekMenu(false)} title="This Week's Schedule">
        <button className="menu-item" onClick={() => nav("/workout/library")}><Icon name="library" />Workout Library</button>
        <button className="menu-item" onClick={() => { setWeekMenu(false); const i = data.slots.findIndex((s) => !s.templateId); if (i >= 0) setPickFor({ idx: i, mode: "add" }); }}><Icon name="plus" />Add Workout to first rest day</button>
      </Sheet>
      {launcherSheet}
    </div>
  );
}
