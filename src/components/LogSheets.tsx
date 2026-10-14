import { useEffect, useState } from "react";
import { db } from "../db/db";
import type { ISODate, Units } from "../db/types";
import { longDate, today } from "../domain/dates";
import { fromDisplay, toDisplay } from "../lib/hooks";
import { NumberInput, Sheet } from "./ui";

export function WeighInSheet({ open, onClose, date, units }: { open: boolean; onClose: () => void; date: ISODate; units: Units }) {
  const [d, setD] = useState(date);
  const [v, setV] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setD(date);
    setErr(null);
    db.weighins.where("date").equals(date).last().then((w) => setV(toDisplay(w?.weightKg, units)));
  }, [open, date, units]);
  async function save() {
    const kg = fromDisplay(v, units);
    if (!kg || kg < 20 || kg > 400) return setErr("Enter a valid weight.");
    if (d > today()) return setErr("You can't log a future weigh-in.");
    // One weigh-in per day: replace that day's entry.
    await db.transaction("rw", db.weighins, async () => {
      await db.weighins.where("date").equals(d).delete();
      await db.weighins.add({ date: d, weightKg: kg, createdAt: Date.now() });
    });
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Log weight">
      <div className="field">
        <label htmlFor="wdate">Date</label>
        <input id="wdate" className="input" type="date" max={today()} value={d} onChange={(e) => setD(e.target.value)} />
      </div>
      <div className="field">
        <label>Weight ({units})</label>
        <div className="input" style={{ padding: 0 }}>
          <NumberInput label={`Weight in ${units}`} value={v} onChange={setV} placeholder="0.0" />
        </div>
      </div>
      {err && <div className="notice error" role="alert">{err}</div>}
      <button className="btn block" style={{ marginTop: 12 }} onClick={save}>Save</button>
    </Sheet>
  );
}

export function StepsSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: ISODate }) {
  const [v, setV] = useState<number | null>(null);
  useEffect(() => {
    if (open) db.steps.get(date).then((s) => setV(s?.steps ?? null));
  }, [open, date]);
  return (
    <Sheet open={open} onClose={onClose} title={`Steps · ${longDate(date)}`}>
      <p className="faint">Health app sync is not available in this web build; enter steps manually.</p>
      <div className="field">
        <label>Steps</label>
        <div className="input" style={{ padding: 0 }}>
          <NumberInput label="Steps" inputMode="numeric" value={v} onChange={setV} placeholder="0" />
        </div>
      </div>
      <button
        className="btn block"
        onClick={async () => {
          if (v == null) await db.steps.delete(date);
          else await db.steps.put({ date, steps: Math.round(v), source: "manual" });
          onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}
