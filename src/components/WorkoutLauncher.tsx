import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ISODate, WorkoutSession } from "../db/types";
import { longDate, today, weekStartOf } from "../domain/dates";
import { canLogWeek, weekStatus } from "../domain/schedule";
import { activeSession, discardSession, findSession, startOrResume } from "../domain/workout";
import { Sheet } from "./ui";

/**
 * Starting a workout from the dashboard calendar/checklist or the Workout tab.
 * Documented: an existing session offers "Resume Workout"; current and past
 * weeks can be completed, future weeks cannot.
 */
export function useWorkoutLauncher(weekStartsOn: 0 | 1) {
  const nav = useNavigate();
  const [prompt, setPrompt] = useState<
    | { kind: "existing"; session: WorkoutSession }
    | { kind: "future"; date: ISODate }
    | { kind: "other-active"; active: WorkoutSession; date: ISODate; templateId: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  async function launch(date: ISODate, templateId: string) {
    const status = weekStatus(weekStartOf(date, weekStartsOn), weekStartOf(today(), weekStartsOn));
    const existing = await findSession(date, templateId);
    if (existing) return setPrompt({ kind: "existing", session: existing });
    if (!canLogWeek(status)) return setPrompt({ kind: "future", date });
    const active = await activeSession();
    if (active) return setPrompt({ kind: "other-active", active, date, templateId });
    try {
      const s = await startOrResume(date, templateId, weekStartsOn);
      nav(`/session/${s.id}`);
    } catch (e) {
      setPrompt({ kind: "error", message: e instanceof Error ? e.message : "Could not start workout." });
    }
  }

  const sheet = (
    <Sheet open={!!prompt} onClose={() => setPrompt(null)} title={prompt?.kind === "existing" ? prompt.session.name : prompt?.kind === "future" ? "Not available yet" : prompt?.kind === "error" ? "Something went wrong" : "Workout in progress"}>
      {prompt?.kind === "existing" && (
        <div className="list" style={{ gap: 8 }}>
          <p className="muted" style={{ margin: 0 }}>
            {prompt.session.status === "completed" ? `Completed ${longDate(prompt.session.date)}.` : `Started ${longDate(prompt.session.date)} — not finished.`}
          </p>
          <button className="btn block" onClick={() => nav(`/session/${prompt.session.id}`)}>
            {prompt.session.status === "completed" ? "View / Edit Workout" : "Resume Workout"}
          </button>
          <button className="btn block secondary" onClick={() => setPrompt(null)}>Cancel</button>
        </div>
      )}
      {prompt?.kind === "future" && <p className="muted">Workouts in future weeks can't be completed yet. You can log workouts for the current and previous weeks.</p>}
      {prompt?.kind === "error" && <div className="notice error" role="alert">{prompt.message}</div>}
      {prompt?.kind === "other-active" && (
        <div className="list" style={{ gap: 8 }}>
          <p className="muted" style={{ margin: 0 }}>“{prompt.active.name}” is still in progress.</p>
          <button className="btn block" onClick={() => nav(`/session/${prompt.active.id}`)}>Resume Workout</button>
          <button
            className="btn block danger"
            onClick={async () => {
              await discardSession(prompt.active.id);
              const s = await startOrResume(prompt.date, prompt.templateId, weekStartsOn);
              nav(`/session/${s.id}`);
            }}
          >
            Discard it and start this workout
          </button>
        </div>
      )}
    </Sheet>
  );
  return { launch, sheet };
}
