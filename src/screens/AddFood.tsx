import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Header, Loading, NumberInput, Segmented, Sheet, fmt } from "../components/ui";
import { db } from "../db/db";
import type { Food, Macros, Meal, MealSlot } from "../db/types";
import { SLOT_LABEL, mealTotals } from "../domain/nutrition";
import ScanPanel from "./ScanPanel";

type Tab = "foods" | "meals" | "custom" | "quick" | "scan";

export async function logEntry(date: string, slot: MealSlot, e: { kind: "food" | "meal" | "quick"; refId?: string; name: string; servings: number; servingLabel: string; perServing: Macros }) {
  await db.foodLog.add({ date, slot, ...e, createdAt: Date.now() });
}

export default function AddFood() {
  const { date, slot } = useParams() as { date: string; slot: MealSlot };
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("foods");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<{ food?: Food; meal?: Meal; macros: Macros; name: string; servingLabel: string } | null>(null);
  const [servings, setServings] = useState<number | null>(1);
  const [quick, setQuick] = useState<{ name: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }>({ name: "", kcal: null, protein: null, carbs: null, fat: null });

  const data = useLiveQuery(async () => {
    const foods = await db.foods.toArray();
    const meals = await db.meals.toArray();
    return { foods, meals, map: new Map(foods.map((f) => [f.id, f])) };
  }, []);
  if (!data) return <Loading />;

  const done = () => nav(`/nutrition?date=${date}`, { replace: true });
  const foodList = (custom: boolean) => data.foods.filter((f) => f.custom === custom && f.name.toLowerCase().includes(q.toLowerCase()));

  const foodRow = (f: Food) => (
    <button key={f.id} className="list-item" onClick={() => { setPick({ food: f, macros: f, name: f.name, servingLabel: f.servingLabel }); setServings(1); }}>
      <div className="grow">
        <div style={{ fontWeight: 600 }} className="ellipsis">{f.name}</div>
        <div className="faint">{f.brand ? `${f.brand} · ` : ""}{f.servingLabel} · {fmt(f.kcal)} kcal · {fmt(f.protein, 1)} g protein</div>
      </div>
      <Icon name="plus" />
    </button>
  );

  return (
    <div className="screen no-tabbar">
      <Header title={`Add to ${SLOT_LABEL[slot] ?? "meal"}`} back={`/nutrition?date=${date}`} />
      <Segmented label="Add food source" value={tab} onChange={setTab} options={[["foods", "Foods"], ["meals", "Meals"], ["custom", "Custom"], ["quick", "Quick Add"], ["scan", "Scan"]]} />
      <div style={{ height: 12 }} />

      {(tab === "foods" || tab === "custom") && <input className="input" placeholder="Search foods" aria-label="Search foods" value={q} onChange={(e) => setQ(e.target.value)} />}

      {tab === "foods" && (
        <div className="card list" style={{ marginTop: 12 }}>
          {foodList(false).length === 0 ? <div className="empty">No matching foods. Try Custom or Quick Add.</div> : foodList(false).map(foodRow)}
        </div>
      )}

      {tab === "custom" && (
        <>
          <Link to={`/nutrition/food/new?date=${date}&slot=${slot}`} className="btn block secondary" style={{ marginTop: 12, textDecoration: "none" }}><Icon name="plus" />Create new food</Link>
          <div className="card list" style={{ marginTop: 12 }}>
            {foodList(true).length === 0 ? <div className="empty">No custom foods yet.</div> : foodList(true).map(foodRow)}
          </div>
        </>
      )}

      {tab === "meals" && (
        <>
          <Link to={`/nutrition/meal/new?date=${date}&slot=${slot}`} className="btn block secondary" style={{ textDecoration: "none" }}><Icon name="plus" />Create Meal</Link>
          <div className="card list" style={{ marginTop: 12 }}>
            {data.meals.length === 0 && <div className="empty">No saved meals yet.</div>}
            {data.meals.map((m) => {
              const { total, missing } = mealTotals(m, data.map);
              return (
                <div key={m.id} className="list-item">
                  <button className="grow" style={{ border: 0, background: "none", textAlign: "left", padding: 0 }} onClick={() => { setPick({ meal: m, macros: total, name: m.name, servingLabel: "1 meal" }); setServings(1); }}>
                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                    <div className="faint">{m.ingredients.length} ingredients · {fmt(total.kcal)} kcal · {fmt(total.protein)} g protein{missing.length ? " · some ingredients missing" : ""}</div>
                  </button>
                  <Link className="icon-btn" to={`/nutrition/meal/${m.id}?date=${date}&slot=${slot}`} aria-label={`Edit ${m.name}`}><Icon name="edit" /></Link>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "quick" && (
        <div className="card">
          <div className="field">
            <label htmlFor="qname">Description (optional)</label>
            <input id="qname" className="input" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
              <div key={k} className="field" style={{ flex: "1 1 40%" }}>
                <label>{k === "kcal" ? "Calories" : `${k[0].toUpperCase()}${k.slice(1)} (g)`}</label>
                <div className="input" style={{ padding: 0 }}><NumberInput label={k} value={quick[k]} onChange={(v) => setQuick({ ...quick, [k]: v })} /></div>
              </div>
            ))}
          </div>
          <button
            className="btn block"
            disabled={!quick.kcal && !quick.protein && !quick.carbs && !quick.fat}
            onClick={async () => {
              const p = quick.protein ?? 0, c = quick.carbs ?? 0, f = quick.fat ?? 0;
              await logEntry(date, slot, { kind: "quick", name: quick.name.trim() || "Quick add", servings: 1, servingLabel: "entry", perServing: { kcal: quick.kcal ?? p * 4 + c * 4 + f * 9, protein: p, carbs: c, fat: f } });
              done();
            }}
          >
            Log
          </button>
        </div>
      )}

      {tab === "scan" && <ScanPanel date={date} slot={slot} onLogged={done} />}

      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick?.name}>
        {pick && (
          <>
            <p className="faint">Per {pick.servingLabel}: {fmt(pick.macros.kcal)} kcal · {fmt(pick.macros.protein, 1)} g protein · {fmt(pick.macros.carbs, 1)} g carbs · {fmt(pick.macros.fat, 1)} g fat</p>
            <div className="field">
              <label>Servings</label>
              <div className="input" style={{ padding: 0 }}><NumberInput label="Servings" value={servings} onChange={setServings} /></div>
            </div>
            <p><strong>{fmt(pick.macros.kcal * (servings ?? 0))} kcal</strong> <span className="muted">· {fmt(pick.macros.protein * (servings ?? 0))} g protein</span></p>
            <button
              className="btn block"
              disabled={!servings}
              onClick={async () => {
                const { kcal, protein, carbs, fat } = pick.macros;
                await logEntry(date, slot, { kind: pick.meal ? "meal" : "food", refId: pick.meal?.id ?? pick.food?.id, name: pick.name, servings: servings!, servingLabel: pick.servingLabel, perServing: { kcal, protein, carbs, fat } });
                done();
              }}
            >
              Log to {SLOT_LABEL[slot]}
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}
