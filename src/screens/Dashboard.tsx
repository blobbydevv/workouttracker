import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { StepsSheet, WeighInSheet } from "../components/LogSheets";
import { Loading, fmt } from "../components/ui";
import { useWorkoutLauncher } from "../components/WorkoutLauncher";
import { db } from "../db/db";
import type { ISODate } from "../db/types";
import { dayNum, dayShort, fromISO, longDate, monthGrid, monthLabel, toISO, today, weekDays, weekStartOf } from "../domain/dates";
import { checkinAvailability, currentTarget } from "../domain/checkin";
import { sumEntries } from "../domain/nutrition";
import { PROGRAM_ID } from "../domain/onboarding";
import { weekPlan } from "../domain/schedule";
import { toDisplay, useProfile } from "../lib/hooks";

export default function Dashboard() {
  const profile = useProfile();
  const nav = useNavigate();
  const [selected, setSelected] = useState<ISODate>(today());
  const [expanded, setExpanded] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState<ISODate>(today());
  const [sheet, setSheet] = useState<"weight" | "steps" | null>(null);
  const [dragY, setDragY] = useState<number | null>(null);
  const wso = profile?.weekStartsOn ?? 1;
  const { launch, sheet: launcherSheet } = useWorkoutLauncher(wso);

  const rows = expanded ? monthGrid(monthAnchor, wso) : [weekDays(weekStartOf(selected, wso))];

  const data = useLiveQuery(async () => {
    const plans = await Promise.all(rows.map((r) => weekPlan(PROGRAM_ID, r[0])));
    const from = rows[0][0];
    const to = rows.at(-1)![6];
    const sessions = await db.sessions.where("date").between(from, to, true, true).toArray();
    const dayPlan = plans.flat();
    const sel = dayPlan.find((p) => p.date === selected) ?? (await weekPlan(PROGRAM_ID, weekStartOf(selected, wso))).find((p) => p.date === selected);
    const tpl = sel?.templateId ? await db.templates.get(sel.templateId) : undefined;
    const selSession = tpl ? sessions.find((s) => s.date === selected && s.templateId === tpl.id) : undefined;
    const entries = await db.foodLog.where("date").equals(selected).toArray();
    const weigh = await db.weighins.where("date").equals(selected).last();
    const steps = await db.steps.get(selected);
    const target = await currentTarget(selected);
    const checkin = await checkinAvailability(today());
    return { dayPlan, sessions, tpl, selSession, entries, weigh, steps, target, checkin };
  }, [selected, expanded, monthAnchor, wso, rows[0][0]]);

  if (!profile || !data) return <Loading />;
  const totals = sumEntries(data.entries);
  const isFutureDay = selected > today();

  const dotFor = (d: ISODate) => {
    const plan = data.dayPlan.find((p) => p.date === d);
    if (!plan?.templateId) return "none";
    return data.sessions.some((s) => s.date === d && s.templateId === plan.templateId && s.status === "completed") ? "done" : "planned";
  };

  const checklist = [
    data.tpl && {
      key: "workout",
      label: data.tpl.name,
      sub: data.selSession?.status === "completed" ? "Completed" : data.selSession ? "In progress — tap to resume" : `${data.tpl.items.length} exercises`,
      done: data.selSession?.status === "completed",
      onClick: () => launch(selected, data.tpl!.id),
    },
    {
      key: "food",
      label: "Log your food",
      sub: data.entries.length ? `${fmt(totals.kcal)} kcal logged` : "Nothing logged yet",
      done: data.entries.length > 0,
      onClick: () => nav(`/nutrition?date=${selected}`),
      disabled: isFutureDay,
    },
    {
      key: "weight",
      label: "Weigh in",
      sub: data.weigh ? `${fmt(toDisplay(data.weigh.weightKg, profile.units), 1)} ${profile.units}` : "Not logged",
      done: !!data.weigh,
      onClick: () => setSheet("weight"),
      disabled: isFutureDay,
    },
    {
      key: "steps",
      label: "Steps",
      sub: data.steps ? `${data.steps.steps.toLocaleString()} / ${profile.stepGoal.toLocaleString()}` : `Goal ${profile.stepGoal.toLocaleString()}`,
      done: !!data.steps && data.steps.steps >= profile.stepGoal,
      onClick: () => setSheet("steps"),
      disabled: isFutureDay,
    },
  ].filter(Boolean) as Array<{ key: string; label: string; sub: string; done: boolean; onClick: () => void; disabled?: boolean }>;

  return (
    <div className="screen">
      <header className="header">
        <h1>Hi, {profile.name}</h1>
        <Link className="icon-btn" to="/coach" aria-label="AI coach"><Icon name="chat" /></Link>
        <Link className="icon-btn" to="/profile" aria-label="Profile and settings"><Icon name="user" /></Link>
      </header>

      <section
        className="card"
        aria-label="Calendar"
        onTouchStart={(e) => setDragY(e.touches[0].clientY)}
        onTouchEnd={(e) => {
          if (dragY == null) return;
          const dy = e.changedTouches[0].clientY - dragY;
          if (dy > 40 && !expanded) {
            setMonthAnchor(selected);
            setExpanded(true);
          } else if (dy < -40 && expanded) setExpanded(false);
          setDragY(null);
        }}
      >
        <div className="row between" style={{ marginBottom: 6 }}>
          <strong>{monthLabel(expanded ? monthAnchor : selected)}</strong>
          {expanded && (
            <div className="row" style={{ gap: 0 }}>
              <button className="icon-btn" aria-label="Previous month" onClick={() => { const d = fromISO(monthAnchor); setMonthAnchor(toISO(new Date(d.getFullYear(), d.getMonth() - 1, 1))); }}>
                <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><Icon name="chevron" /></span>
              </button>
              <button className="icon-btn" aria-label="Next month" onClick={() => { const d = fromISO(monthAnchor); setMonthAnchor(toISO(new Date(d.getFullYear(), d.getMonth() + 1, 1))); }}>
                <Icon name="chevron" />
              </button>
            </div>
          )}
        </div>
        {rows.map((r, i) => (
          <div key={r[0]} className="week" style={{ marginTop: i ? 2 : 0 }}>
            {r.map((d) => (
              <button
                key={d}
                className={`day ${d === today() ? "today" : ""} ${expanded && fromISO(d).getMonth() !== fromISO(monthAnchor).getMonth() ? "out" : ""}`}
                aria-pressed={d === selected}
                aria-label={longDate(d)}
                onClick={() => setSelected(d)}
              >
                {i === 0 && <span>{dayShort(d).slice(0, 1)}</span>}
                <span className="num">{dayNum(d)}</span>
                <span className={`dot ${dotFor(d)}`} />
              </button>
            ))}
          </div>
        ))}
        <button
          className="grabber"
          aria-label={expanded ? "Collapse to week view" : "Expand to calendar view"}
          aria-expanded={expanded}
          onClick={() => {
            setMonthAnchor(selected);
            setExpanded(!expanded);
          }}
        />
      </section>

      <h2 className="section-title">{selected === today() ? "Today" : longDate(selected)}</h2>
      <section className="card" aria-label="Daily checklist">
        <div className="list">
          {!data.tpl && (
            <div className="list-item">
              <span className="check on" style={{ background: "var(--surface-2)", borderColor: "var(--surface-2)", color: "var(--text-3)" }}>–</span>
              <div className="grow"><div style={{ fontWeight: 600 }}>Rest day</div></div>
            </div>
          )}
          {checklist.map((c) => (
            <button key={c.key} className="list-item" onClick={c.onClick} disabled={c.disabled} style={c.disabled ? { opacity: 0.5 } : undefined}>
              <span className={`check ${c.done ? "on" : ""}`} aria-label={c.done ? "Done" : "Not done"}>{c.done && <Icon name="check" size={16} />}</span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{c.label}</div>
                <div className="faint">{c.sub}</div>
              </div>
              <Icon name="chevron" size={18} />
            </button>
          ))}
        </div>
      </section>

      {data.target && (
        <Link to={`/nutrition?date=${selected}`} className="card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          <h2>Nutrition</h2>
          <div className="row between">
            <div>
              <div className="big-number">{fmt(Math.max(0, data.target.calories - totals.kcal))}</div>
              <div className="faint">kcal remaining</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div><strong>{fmt(totals.protein)}</strong> / {data.target.protein} g</div>
              <div className="faint">protein</div>
            </div>
          </div>
        </Link>
      )}

      {data.checkin.available && (
        <Link to="/nutrition/checkin" className="card row" style={{ color: "inherit", textDecoration: "none" }}>
          <Icon name="scale" />
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Nutrition Check-In available</div>
            <div className="faint">Review your week and update your calorie target</div>
          </div>
          <Icon name="chevron" size={18} />
        </Link>
      )}

      <Link to="/lessons" className="card row" style={{ color: "inherit", textDecoration: "none" }}>
        <Icon name="book" />
        <div className="grow">
          <div style={{ fontWeight: 600 }}>Lessons</div>
          <div className="faint">Short educational lessons</div>
        </div>
        <Icon name="chevron" size={18} />
      </Link>

      <WeighInSheet open={sheet === "weight"} onClose={() => setSheet(null)} date={selected} units={profile.units} />
      <StepsSheet open={sheet === "steps"} onClose={() => setSheet(null)} date={selected} />
      {launcherSheet}
    </div>
  );
}
