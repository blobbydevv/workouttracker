import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Loading, NumberInput, Sheet, Toggle, fmt } from "../components/ui";
import { db } from "../db/db";
import type { FoodLogEntry, MealSlot } from "../db/types";
import { addDays, longDate, today } from "../domain/dates";
import { currentTarget } from "../domain/checkin";
import { SLOTS, SLOT_LABEL, bySlot, entryMacros, sumEntries } from "../domain/nutrition";
import { useProfile } from "../lib/hooks";
import { DIET_PLANS } from "../db/diets";

export default function Nutrition() {
  const profile = useProfile();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get("date") ?? today();
  const setDate = (d: string) => setParams({ date: d }, { replace: true });
  const [gear, setGear] = useState(false);
  const [edit, setEdit] = useState<FoodLogEntry | null>(null);
  const [servings, setServings] = useState<number | null>(1);
  const [copyFrom, setCopyFrom] = useState<MealSlot | null>(null);
  const [copyTo, setCopyTo] = useState<{ date: string; slot: MealSlot }>({ date: today(), slot: "breakfast" });

  const data = useLiveQuery(async () => ({
    entries: await db.foodLog.where("date").equals(date).toArray(),
    target: await currentTarget(date),
  }), [date]);
  if (!profile || !data) return <Loading />;
  const totals = sumEntries(data.entries);
  const slots = bySlot(data.entries);
  const t = data.target;
  const showCF = profile.showCarbsFats;

  const macroBar = (label: string, v: number, goal: number | undefined, color: string) => (
    <div>
      <div className="small"><strong>{fmt(v)}</strong><span className="faint"> / {goal ?? "–"} g</span></div>
      <div className="bar"><i style={{ width: `${goal ? Math.min(100, (v / goal) * 100) : 0}%`, background: color }} /></div>
      <div className="faint">{label}</div>
    </div>
  );

  return (
    <div className="screen">
      <header className="header">
        <h1>Food Log</h1>
        <Link className="icon-btn" to="/nutrition/plans" aria-label="Diet plans"><Icon name="book" /></Link>
        <Link className="icon-btn" to="/nutrition/checkin" aria-label="Nutrition Check-In"><Icon name="scale" /></Link>
        <button className="icon-btn" aria-label="Food Log settings" onClick={() => setGear(true)}><Icon name="gear" /></button>
      </header>

      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><Icon name="chevron" /></span></button>
        <strong>{date === today() ? "Today" : longDate(date)}</strong>
        <button className="icon-btn" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><Icon name="chevron" /></button>
      </div>

      <Link to="/nutrition/plans" className="card row" style={{ color: "inherit", textDecoration: "none", padding: "10px 14px" }}>
        <Icon name="book" />
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{profile.dietPlanId ? `Diet plan: ${DIET_PLANS.find((d) => d.id === profile.dietPlanId)?.name ?? "Custom"}` : "Choose a diet plan"}</div>
          <div className="faint">Lean bulk, cut, keto, high-protein and more</div>
        </div>
        <Icon name="chevron" size={18} />
      </Link>
      <section className="card" aria-label="Daily totals">
        <div className="row between">
          <div>
            <div className="big-number" data-testid="kcal-eaten">{fmt(totals.kcal)}</div>
            <div className="faint">of {t?.calories ?? "–"} kcal</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="big-number" data-testid="kcal-left">{t ? fmt(Math.max(0, t.calories - totals.kcal)) : "–"}</div>
            <div className="faint">remaining</div>
          </div>
        </div>
        <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${t ? Math.min(100, (totals.kcal / t.calories) * 100) : 0}%` }} /></div>
        <div className="macro-bars">
          {macroBar("Protein", totals.protein, t?.protein, "var(--protein)")}
          {macroBar("Carbs", totals.carbs, t?.carbs, "var(--carbs)")}
          {macroBar("Fat", totals.fat, t?.fat, "var(--fat)")}
        </div>
      </section>

      {SLOTS.map((slot) => {
        const list = slots[slot];
        const m = sumEntries(list);
        return (
          <section key={slot} className="card meal-card" aria-label={SLOT_LABEL[slot]}>
            <div className="row">
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{SLOT_LABEL[slot]}</div>
                <div className="faint" data-testid={`slot-${slot}-totals`}>
                  {fmt(m.kcal)} kcal · {fmt(m.protein)} g protein{showCF ? ` · ${fmt(m.carbs)} g carbs · ${fmt(m.fat)} g fat` : ""}
                </div>
              </div>
              {list.length > 0 && <button className="icon-btn" aria-label={`Copy ${SLOT_LABEL[slot]}`} onClick={() => { setCopyFrom(slot); setCopyTo({ date: addDays(date, 1), slot }); }}><Icon name="more" /></button>}
              <button className="add-circle" aria-label={`Add food to ${SLOT_LABEL[slot]}`} onClick={() => nav(`/nutrition/add/${date}/${slot}`)}><Icon name="plus" size={18} /></button>
            </div>
            {list.map((e) => {
              const em = entryMacros(e);
              return (
                <button key={e.id} className="entry" style={{ width: "100%", background: "none", border: 0, borderTop: "1px solid var(--line)", textAlign: "left" }} onClick={() => { setEdit(e); setServings(e.servings); }}>
                  <div className="grow">
                    <div className="ellipsis">{e.name}</div>
                    <div className="faint">{e.servings} × {e.servingLabel}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>{fmt(em.kcal)}</div>
                    <div className="faint">{fmt(em.protein)}p{showCF ? ` ${fmt(em.carbs)}c ${fmt(em.fat)}f` : ""}</div>
                  </div>
                </button>
              );
            })}
          </section>
        );
      })}

      <Sheet open={gear} onClose={() => setGear(false)} title="Food Log Settings">
        <label className="row between" style={{ padding: "8px 0" }}>
          <span>Show carbs and fats for each meal</span>
          <Toggle checked={showCF} onChange={(v) => db.profiles.update("me", { showCarbsFats: v })} />
        </label>
        <p className="faint">Exact label and layout of this setting in the reference app are unverified.</p>
      </Sheet>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name}>
        {edit && (
          <>
            <p className="faint">Per serving ({edit.servingLabel}): {fmt(edit.perServing.kcal)} kcal · {fmt(edit.perServing.protein, 1)} p · {fmt(edit.perServing.carbs, 1)} c · {fmt(edit.perServing.fat, 1)} f</p>
            <div className="field">
              <label>Servings</label>
              <div className="input" style={{ padding: 0 }}><NumberInput label="Servings" value={servings} onChange={setServings} /></div>
            </div>
            <div className="list" style={{ gap: 8 }}>
              <button className="btn block" disabled={!servings} onClick={async () => { await db.foodLog.update(edit.id!, { servings: servings! }); setEdit(null); }}>Save</button>
              <button className="btn block danger" onClick={async () => { await db.foodLog.delete(edit.id!); setEdit(null); }}>Delete</button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={!!copyFrom} onClose={() => setCopyFrom(null)} title={copyFrom ? `Copy ${SLOT_LABEL[copyFrom]}` : ""}>
        <div className="field">
          <label htmlFor="cdate">To date</label>
          <input id="cdate" className="input" type="date" value={copyTo.date} onChange={(e) => setCopyTo({ ...copyTo, date: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="cslot">Meal</label>
          <select id="cslot" className="input" value={copyTo.slot} onChange={(e) => setCopyTo({ ...copyTo, slot: e.target.value as MealSlot })}>
            {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
          </select>
        </div>
        <button
          className="btn block"
          onClick={async () => {
            const items = slots[copyFrom!].map(({ id: _id, ...rest }) => ({ ...rest, date: copyTo.date, slot: copyTo.slot, createdAt: Date.now() }));
            await db.foodLog.bulkAdd(items);
            setCopyFrom(null);
          }}
        >
          Copy
        </button>
      </Sheet>
    </div>
  );
}
