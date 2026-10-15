import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Confirm, Header, Loading } from "../components/ui";
import { DIET_PLANS, dietTargets } from "../db/diets";
import { applyDietPlan, currentBody } from "../domain/plans";
import { useProfile } from "../lib/hooks";

const GOAL = { gain: "Gain", maintain: "Maintain / recomp", lose: "Lose fat" } as const;

export default function DietPlans() {
  const profile = useProfile();
  const body = useLiveQuery(() => currentBody(), []);
  const [goal, setGoal] = useState<"all" | keyof typeof GOAL>("all");
  if (!profile || body === undefined) return <Loading />;
  const list = DIET_PLANS.filter((d) => goal === "all" || d.goal === goal);
  return (
    <div className="screen">
      <Header title="Diet Plans" back="/nutrition" />
      <p className="muted" style={{ marginTop: 0 }}>Choosing a plan sets your daily calorie and macro targets from today (numbers below are calculated for you).</p>
      <div className="chips" style={{ marginBottom: 8 }} role="group" aria-label="Filter diet plans">
        <button className="chip" aria-pressed={goal === "all"} onClick={() => setGoal("all")}>All ({DIET_PLANS.length})</button>
        {(Object.keys(GOAL) as Array<keyof typeof GOAL>).map((g) => (
          <button key={g} className="chip" aria-pressed={goal === g} onClick={() => setGoal(g)}>{GOAL[g]}</button>
        ))}
      </div>
      {list.map((d) => {
        const t = body ? dietTargets(d, body) : null;
        return (
          <Link key={d.id} to={`/nutrition/plans/${d.id}`} className="card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
            <div className="row between" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <div style={{ fontWeight: 700, fontSize: 17 }}>{d.name}</div>
                <div className="faint">{d.tagline}</div>
              </div>
              {profile.dietPlanId === d.id ? <span className="badge ok">Current</span> : d.badge && <span className="badge accent">{d.badge}</span>}
            </div>
            <p style={{ margin: "8px 0" }}><strong>Best for:</strong> {d.bestFor}</p>
            {t && <div className="plan-meta"><span><b>{t.calories}</b> kcal</span><span>P {t.protein} g</span><span>C {t.carbs} g</span><span>F {t.fat} g</span></div>}
          </Link>
        );
      })}
    </div>
  );
}

export function DietPlanDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const profile = useProfile();
  const body = useLiveQuery(() => currentBody(), []);
  const [confirm, setConfirm] = useState(false);
  const d = DIET_PLANS.find((x) => x.id === id);
  if (!profile || body === undefined) return <Loading />;
  if (!d) return <div className="screen"><Header title="Diet plan" back="/nutrition/plans" /><div className="empty">Plan not found.</div></div>;
  const t = body ? dietTargets(d, body) : null;
  return (
    <div className="screen no-tabbar">
      <Header title={d.name} back="/nutrition/plans" />
      {d.badge && <span className="badge accent">{d.badge}</span>}
      <p className="muted">{d.tagline}</p>
      {t && (
        <section className="card" aria-label="Your targets">
          <h2>Your daily targets</h2>
          <div className="stat-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div><span className="faint">Calories</span><b>{t.calories}</b></div>
            <div><span className="faint">Protein</span><b>{t.protein} g</b></div>
            <div><span className="faint">Carbs</span><b>{t.carbs} g</b></div>
            <div><span className="faint">Fat</span><b>{t.fat} g</b></div>
          </div>
          <p className="faint" style={{ marginBottom: 0 }}>
            Estimated maintenance ≈ {t.maintenance} kcal ({d.calorieDelta === 0 ? "eating at maintenance" : `${d.calorieDelta > 0 ? "+" : ""}${Math.round(d.calorieDelta * 100)}%`}). Target rate: {d.pacer > 0 ? "+" : ""}{d.pacer}% body weight per week.
            {t.flooredAt && ` Raised to a safe minimum of ${t.flooredAt} kcal.`}
          </p>
        </section>
      )}
      <section className="card">
        <h2>Best for</h2>
        <p style={{ marginTop: 0 }}>{d.bestFor}</p>
        <h2>About this plan</h2>
        <p style={{ marginTop: 0 }}>{d.description}</p>
        <h2>How to follow it</h2>
        <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>{d.howTo.map((h) => <li key={h} style={{ marginBottom: 4 }}>{h}</li>)}</ul>
        <h2>Example day</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>{d.sampleDay.map((h) => <li key={h} style={{ marginBottom: 4 }}>{h}</li>)}</ul>
        {d.caution && <div className="notice" style={{ marginTop: 12 }}>⚠️ {d.caution}</div>}
      </section>
      <p className="faint">Estimates only — not medical advice. Your weekly Nutrition Check-In helps fine-tune the numbers.</p>
      <div className="bottom-bar">
        <button className="btn block" disabled={!t} onClick={() => setConfirm(true)}>{profile.dietPlanId === d.id ? "Recalculate my targets" : "Use this plan"}</button>
      </div>
      <Confirm
        open={confirm}
        title={`Use ${d.name}?`}
        body={t ? `Your targets become ${t.calories} kcal · ${t.protein} g protein · ${t.carbs} g carbs · ${t.fat} g fat from today. Past days keep their old targets.` : ""}
        confirmLabel="Use this plan"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await applyDietPlan(d.id);
          nav("/nutrition", { replace: true });
        }}
      />
    </div>
  );
}
