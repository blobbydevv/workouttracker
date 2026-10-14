import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { NumberInput, Unverified } from "../components/ui";
import type { Assessment, Units } from "../db/types";
import { completeOnboarding, provisionalTargets } from "../domain/onboarding";
import { fromDisplay } from "../lib/hooks";

// The advertised assessment covers fitness level, goals and lifestyle. The
// exact BWS questions, order and branching are UNVERIFIED; these steps cover
// the documented categories plus the inputs the provisional plan needs.
type Draft = Omit<Assessment, "id" | "createdAt">;

const MUSCLES = ["Chest", "Back", "Shoulders", "Arms", "Glutes", "Legs", "Abs"];

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [units, setUnits] = useState<Units>("kg");
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1);
  const [weightDisplay, setWeightDisplay] = useState<number | null>(null);
  const [d, setD] = useState<Draft>({
    goal: "build_muscle",
    experience: "beginner",
    location: "gym",
    daysPerWeek: 4,
    priorityMuscles: [],
    sex: "unspecified",
    age: 30,
    heightCm: 170,
    weightKg: 70,
    activity: "light",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const choice = <K extends keyof Draft>(k: K, opts: Array<[Draft[K], string, string?]>) => (
    <div className="list" style={{ gap: 10 }}>
      {opts.map(([v, label, sub]) => (
        <button key={String(v)} className="card row" style={{ border: d[k] === v ? "2px solid var(--accent)" : "2px solid transparent", textAlign: "left", margin: 0 }} aria-pressed={d[k] === v} onClick={() => set(k, v)}>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{label}</div>
            {sub && <div className="faint">{sub}</div>}
          </div>
          {d[k] === v && <Icon name="check" />}
        </button>
      ))}
    </div>
  );

  const steps: Array<{ title: string; body: React.ReactNode; valid?: boolean }> = [
    {
      title: "What's your main goal?",
      body: choice("goal", [
        ["lose_fat", "Lose fat"],
        ["build_muscle", "Build muscle"],
        ["recomp", "Lose fat and build muscle"],
        ["maintain", "Maintain"],
      ]),
    },
    {
      title: "What's your training experience?",
      body: choice("experience", [
        ["beginner", "Beginner", "Less than 1 year of consistent training"],
        ["intermediate", "Intermediate", "1–3 years"],
        ["advanced", "Advanced", "3+ years"],
      ]),
    },
    {
      title: "Where will you train?",
      body: choice("location", [
        ["gym", "Gym", "Full equipment"],
        ["home", "Home", "Dumbbells and bodyweight"],
      ]),
    },
    {
      title: "How many days per week?",
      body: (
        <div className="chips" role="radiogroup" aria-label="Days per week">
          {[2, 3, 4, 5, 6].map((n) => (
            <button key={n} className="chip" role="radio" aria-checked={d.daysPerWeek === n} aria-pressed={d.daysPerWeek === n} onClick={() => set("daysPerWeek", n)}>
              {n} days
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Any muscles to prioritise?",
      body: (
        <>
          <p className="muted small">Optional. Choose up to two.</p>
          <div className="chips">
            {MUSCLES.map((m) => {
              const on = d.priorityMuscles.includes(m);
              return (
                <button
                  key={m}
                  className="chip"
                  aria-pressed={on}
                  disabled={!on && d.priorityMuscles.length >= 2}
                  onClick={() => set("priorityMuscles", on ? d.priorityMuscles.filter((x) => x !== m) : [...d.priorityMuscles, m])}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <Unverified>Priority muscles are recorded but the provisional plan does not yet change volume for them — the BWS prioritisation logic is undisclosed.</Unverified>
        </>
      ),
    },
    {
      title: "About you",
      valid: (weightDisplay ?? 0) > 0 && d.age >= 13 && d.heightCm >= 100,
      body: (
        <>
          <div className="field">
            <label>Units</label>
            <div className="chips">
              {(["kg", "lb"] as Units[]).map((u) => (
                <button key={u} className="chip" aria-pressed={units === u} onClick={() => setUnits(u)}>{u}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="sex">Sex</label>
            <select id="sex" className="input" value={d.sex} onChange={(e) => set("sex", e.target.value as Draft["sex"])}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="unspecified">Prefer not to say</option>
            </select>
          </div>
          <div className="row">
            <div className="field grow">
              <label>Age</label>
              <div className="input" style={{ padding: 0 }}><NumberInput label="Age" inputMode="numeric" value={d.age} onChange={(v) => set("age", v ?? 0)} /></div>
            </div>
            <div className="field grow">
              <label>Height (cm)</label>
              <div className="input" style={{ padding: 0 }}><NumberInput label="Height in centimetres" value={d.heightCm} onChange={(v) => set("heightCm", v ?? 0)} /></div>
            </div>
          </div>
          <div className="field">
            <label>Current weight ({units})</label>
            <div className="input" style={{ padding: 0 }}><NumberInput label={`Current weight in ${units}`} value={weightDisplay} placeholder="0" onChange={(v) => setWeightDisplay(v)} /></div>
          </div>
        </>
      ),
    },
    {
      title: "How active are you outside workouts?",
      body: choice("activity", [
        ["sedentary", "Mostly sitting", "Desk job, few steps"],
        ["light", "Lightly active", "Some walking"],
        ["moderate", "Active", "On your feet most of the day"],
        ["very", "Very active", "Physical job"],
      ]),
    },
    {
      title: "Last details",
      valid: name.trim().length > 0,
      body: (
        <>
          <div className="field">
            <label htmlFor="name">First name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </div>
          <div className="field">
            <label>Week starts on</label>
            <div className="chips">
              <button className="chip" aria-pressed={weekStartsOn === 1} onClick={() => setWeekStartsOn(1)}>Monday</button>
              <button className="chip" aria-pressed={weekStartsOn === 0} onClick={() => setWeekStartsOn(0)}>Sunday</button>
            </div>
          </div>
        </>
      ),
    },
  ];

  const last = step === steps.length; // review
  const weightKg = fromDisplay(weightDisplay, units) ?? 0;
  const targets = provisionalTargets({ ...d, weightKg });

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding({ ...d, weightKg }, name.trim(), units, weekStartsOn);
      nav("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  const cur = steps[step];
  return (
    <div className="screen no-tabbar" style={{ paddingTop: 12 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        {step > 0 ? (
          <button className="icon-btn" aria-label="Back" onClick={() => setStep(step - 1)}><Icon name="back" /></button>
        ) : (
          <span style={{ width: 40 }} />
        )}
        <div className="grow bar" aria-label={`Step ${step + 1} of ${steps.length + 1}`}><i style={{ width: `${((step + 1) / (steps.length + 1)) * 100}%` }} /></div>
      </div>
      {!last ? (
        <>
          <h2 style={{ fontSize: 24, margin: "8px 0 16px" }}>{cur.title}</h2>
          {cur.body}
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 24, margin: "8px 0 16px" }}>Your starting plan</h2>
          <div className="card">
            <h2>Training</h2>
            <div>{d.daysPerWeek} days/week · {d.location === "gym" ? "Gym" : "Home"}</div>
          </div>
          <div className="card">
            <h2>Daily nutrition targets</h2>
            <div className="big-number">{targets.calories} kcal</div>
            <div className="muted">Protein {targets.protein} g · Carbs {targets.carbs} g · Fat {targets.fat} g</div>
          </div>
          <Unverified>
            Provisional: the program is a fixed split template chosen by days/week and location, and targets use the Mifflin-St Jeor estimate. Neither is the BWS generator or calorie algorithm, which are undisclosed. You can edit both later.
          </Unverified>
          {error && <div className="notice error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        </>
      )}
      <div className="bottom-bar">
        {last ? (
          <button className="btn block" disabled={busy} onClick={finish}>{busy ? <span className="spinner" /> : "Start my plan"}</button>
        ) : (
          <button className="btn block" disabled={cur.valid === false} onClick={() => setStep(step + 1)}>Continue</button>
        )}
      </div>
    </div>
  );
}
