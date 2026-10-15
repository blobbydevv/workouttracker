import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExerciseThumb } from "../components/ExerciseImage";
import { Confirm, Header, Loading } from "../components/ui";
import { db } from "../db/db";
import { TAG_LABEL, WORKOUT_PLANS, type PlanTag, type WorkoutPlan } from "../db/programs";
import { applyWorkoutPlan } from "../domain/plans";
import { useProfile } from "../lib/hooks";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Intensity({ n }: { n: number }) {
  return (
    <span className="intensity" aria-label={`Intensity ${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? "on" : ""} />)}
    </span>
  );
}

function PlanMeta({ p }: { p: WorkoutPlan }) {
  return (
    <div className="plan-meta">
      <span>{p.daysPerWeek} days/wk</span>
      <span>{p.minutes}</span>
      <span>{p.level}</span>
      <span>{p.location}</span>
      <Intensity n={p.intensity} />
    </div>
  );
}

export default function WorkoutPlans() {
  const profile = useProfile();
  const [tag, setTag] = useState<PlanTag | "all">("all");
  if (!profile) return <Loading />;
  const list = WORKOUT_PLANS.filter((p) => tag === "all" || p.tags.includes(tag));
  return (
    <div className="screen">
      <Header title="Workout Plans" back="/workout" />
      <p className="muted" style={{ marginTop: 0 }}>Pick a plan and it replaces your weekly schedule from this week. Past workouts and progress are kept.</p>
      <div className="chips" style={{ flexWrap: "nowrap", overflowX: "auto", paddingBottom: 6, marginBottom: 8 }} role="group" aria-label="Filter plans">
        <button className="chip" aria-pressed={tag === "all"} onClick={() => setTag("all")}>All ({WORKOUT_PLANS.length})</button>
        {(Object.keys(TAG_LABEL) as PlanTag[]).map((t) => (
          <button key={t} className="chip" style={{ whiteSpace: "nowrap" }} aria-pressed={tag === t} onClick={() => setTag(t)}>{TAG_LABEL[t]}</button>
        ))}
      </div>
      {list.map((p) => (
        <Link key={p.id} to={`/workout/plans/${p.id}`} className="card plan-card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 17 }}>{p.name}</div>
              <div className="faint">{p.tagline}</div>
            </div>
            {profile.workoutPlanId === p.id ? <span className="badge ok">Current</span> : p.badge && <span className="badge accent">{p.badge}</span>}
          </div>
          <p style={{ margin: "8px 0" }}><strong>Best for:</strong> {p.bestFor}</p>
          <PlanMeta p={p} />
        </Link>
      ))}
    </div>
  );
}

export function WorkoutPlanDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const profile = useProfile();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const names = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e.name])), []);
  const p = WORKOUT_PLANS.find((x) => x.id === id);
  if (!profile || !names) return <Loading />;
  if (!p) return <div className="screen"><Header title="Plan" back="/workout/plans" /><div className="empty">Plan not found.</div></div>;
  const current = profile.workoutPlanId === p.id;
  return (
    <div className="screen no-tabbar">
      <Header title={p.name} back="/workout/plans" />
      {p.badge && <span className="badge accent">{p.badge}</span>}
      <p className="muted">{p.tagline}</p>
      <PlanMeta p={p} />
      <section className="card" style={{ marginTop: 12 }}>
        <h2>Best for</h2>
        <p style={{ marginTop: 0 }}>{p.bestFor}</p>
        <h2>About this plan</h2>
        <p style={{ marginTop: 0 }}>{p.description}</p>
        <h2>How it works</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>{p.howItWorks.map((h) => <li key={h} style={{ marginBottom: 4 }}>{h}</li>)}</ul>
      </section>
      <h2 className="section-title">Your week</h2>
      <div className="card">
        <div className="week-strip">
          {p.week.map((k, i) => (
            <div key={i} className={k ? "on" : ""}>
              <span>{DAY[i]}</span>
              <b>{k ? p.days[k].name.replace(/ \(.*\)$/, "") : "Rest"}</b>
            </div>
          ))}
        </div>
      </div>
      {Object.entries(p.days).map(([key, day]) => (
        <section key={key} className="card">
          <h2>{day.name}</h2>
          <div className="list">
            {day.items.map(([ex, sets, lo, hi, ss], i) => (
              <div key={i} className="list-item" style={{ padding: "8px 0" }}>
                <ExerciseThumb id={ex} name={names.get(ex) ?? ex} size={40} />
                <div className="grow">
                  <div>{names.get(ex) ?? ex}</div>
                  {ss && <div className="faint">Superset / circuit</div>}
                </div>
                <span className="faint">{sets} × {lo === hi ? lo : `${lo}–${hi}`}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="bottom-bar">
        <button className="btn block" disabled={busy} onClick={() => setConfirm(true)}>{current ? "Restart this plan" : "Start this plan"}</button>
      </div>
      <Confirm
        open={confirm}
        title={`Start ${p.name}?`}
        body="Your schedule changes from this week on. Workouts you've already done, your history and graphs are kept. Edited days in your current plan will be replaced."
        confirmLabel="Start plan"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          await applyWorkoutPlan(p.id, profile.weekStartsOn);
          nav("/workout", { replace: true });
        }}
      />
    </div>
  );
}
