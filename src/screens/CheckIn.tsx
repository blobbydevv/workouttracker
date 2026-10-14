import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header, Loading, NumberInput, Unverified, fmt } from "../components/ui";
import { db } from "../db/db";
import { longDate, today } from "../domain/dates";
import { PACE_TOLERANCE, checkinAvailability, currentTarget, summarize } from "../domain/checkin";
import { submitCheckIn } from "../domain/checkin";
import { toDisplay, useProfile } from "../lib/hooks";

const PACE_TEXT = { too_fast: "Faster than your Weight Pacer", too_slow: "Slower than your Weight Pacer", on_track: "On track with your Weight Pacer" };

export default function CheckIn() {
  const profile = useProfile();
  const nav = useNavigate();
  const d = today();
  const data = useLiveQuery(async () => {
    if (!profile) return null;
    return {
      summary: await summarize(d, profile.weightPacerPctPerWeek),
      avail: await checkinAvailability(d),
      target: await currentTarget(d),
      history: await db.checkins.orderBy("date").reverse().limit(5).toArray(),
    };
  }, [profile?.weightPacerPctPerWeek]);
  const [cal, setCal] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (data?.target && cal == null) setCal(data.target.calories);
  }, [data?.target?.calories]);
  if (!profile || !data) return <Loading />;
  const s = data.summary;
  const u = profile.units;

  return (
    <div className="screen no-tabbar">
      <Header title="Nutrition Check-In" back />
      {!data.avail.available ? (
        <div className="card">
          <strong>Check-in complete</strong>
          <p className="muted">Your next check-in opens {longDate(data.avail.nextDate!)}. Check-ins can't be reopened for 7 days.</p>
        </div>
      ) : (
        <>
          <section className="card" aria-label="This week">
            <h2>Your week</h2>
            <div className="row between"><span>Average weight</span><strong>{s.avgWeightKg != null ? `${fmt(toDisplay(s.avgWeightKg, u), 1)} ${u}` : "Not enough weigh-ins"}</strong></div>
            <div className="row between"><span>Previous week</span><span>{s.prevAvgWeightKg != null ? `${fmt(toDisplay(s.prevAvgWeightKg, u), 1)} ${u}` : "–"}</span></div>
            <div className="row between"><span>Rate of change</span><span data-testid="rate">{s.ratePctPerWeek != null ? `${s.ratePctPerWeek > 0 ? "+" : ""}${fmt(s.ratePctPerWeek, 2)}% / week` : "–"}</span></div>
            <div className="row between"><span>Weight Pacer</span><span>{fmt(profile.weightPacerPctPerWeek, 2)}% / week</span></div>
            {s.pace && <div className={`badge ${s.pace === "on_track" ? "ok" : "warn"}`} style={{ display: "inline-block", marginTop: 8 }}>{PACE_TEXT[s.pace]}</div>}
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "12px 0" }} />
            <div className="row between"><span>Average daily calories</span><strong>{s.avgCalories != null ? `${fmt(s.avgCalories)} kcal` : "No food logged"}</strong></div>
            <div className="row between"><span>Days logged</span><span>{s.daysLogged} / 7</span></div>
          </section>

          <section className="card" aria-label="New target">
            <h2>Calorie target</h2>
            <p className="faint">Current: {data.target?.calories ?? "–"} kcal</p>
            <div className="field">
              <label>New daily calories</label>
              <div className="input" style={{ padding: 0 }}><NumberInput label="New daily calories" inputMode="numeric" value={cal} onChange={setCal} /></div>
            </div>
            <Unverified>
              BWS's check-in algorithm (90-day weighting, confidence level, automatic adjustment) is undisclosed, so this build does not recommend a number — you choose the target. The pace label uses a provisional ±{PACE_TOLERANCE}%/week band. Protein and fat grams are kept; carbs absorb the change.
            </Unverified>
            {err && <div className="notice error" role="alert" style={{ marginTop: 8 }}>{err}</div>}
            <button
              className="btn block"
              style={{ marginTop: 12 }}
              disabled={!cal || cal < 800}
              onClick={async () => {
                try {
                  await submitCheckIn(d, profile.weightPacerPctPerWeek, Math.round(cal!));
                  nav("/nutrition", { replace: true });
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Check-in failed.");
                }
              }}
            >
              Complete Check-In
            </button>
          </section>
        </>
      )}
      {data.history.length > 0 && (
        <>
          <h2 className="section-title">Past check-ins</h2>
          <div className="card list">
            {data.history.map((c) => (
              <div key={c.id} className="list-item">
                <div className="grow">{longDate(c.date)}</div>
                <div className="faint">{c.previousCalories} → <strong>{c.newCalories}</strong> kcal</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
