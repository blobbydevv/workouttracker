import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Confirm, Header, Loading, NumberInput, Sheet, fmt } from "../components/ui";
import { db, uid } from "../db/db";
import type { MealIngredient } from "../db/types";
import { mealTotals } from "../domain/nutrition";

/** Documented flow: name the meal, add ingredients with serving sizes, see totals. */
export default function MealEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const isNew = id === "new";
  const [name, setName] = useState("");
  const [ings, setIngs] = useState<MealIngredient[]>([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const foods = await db.foods.toArray();
    return { foods, map: new Map(foods.map((f) => [f.id, f])), meal: isNew ? null : ((await db.meals.get(id!)) ?? null) };
  }, [id]);
  useEffect(() => {
    if (data?.meal) {
      setName(data.meal.name);
      setIngs(data.meal.ingredients);
    }
  }, [data?.meal?.id]);
  if (!data) return <Loading />;
  if (!isNew && !data.meal) return <div className="screen"><Header title="Meal" back /><div className="empty">Meal not found.</div></div>;

  const { total } = mealTotals({ id: "", name, ingredients: ings, createdAt: 0 }, data.map);
  const back = () => (params.get("date") ? nav(`/nutrition/add/${params.get("date")}/${params.get("slot")}`, { replace: true }) : nav(-1));

  async function save() {
    if (!name.trim()) return setErr("Give your meal a name.");
    if (ings.length === 0) return setErr("Add at least one ingredient.");
    await db.meals.put({ id: isNew ? uid() : id!, name: name.trim(), ingredients: ings, createdAt: data!.meal?.createdAt ?? Date.now() });
    back();
  }

  return (
    <div className="screen no-tabbar">
      <Header title={isNew ? "Create Meal" : "Edit Meal"} back />
      <div className="field">
        <label htmlFor="mname">Meal name</label>
        <input id="mname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Protein oats" />
      </div>
      <section className="card" aria-label="Meal totals">
        <div className="row between">
          <div><div className="big-number" data-testid="meal-kcal">{fmt(total.kcal)}</div><div className="faint">kcal</div></div>
          <div className="small" style={{ textAlign: "right" }}>
            <div>{fmt(total.protein)} g protein</div>
            <div>{fmt(total.carbs)} g carbs</div>
            <div>{fmt(total.fat)} g fat</div>
          </div>
        </div>
      </section>
      <h2 className="section-title">Ingredients</h2>
      <div className="card list">
        {ings.length === 0 && <div className="empty">No ingredients yet.</div>}
        {ings.map((ing, i) => {
          const f = data.map.get(ing.foodId);
          return (
            <div key={i} className="list-item">
              <div className="grow">
                <div className="ellipsis">{f?.name ?? "Missing food"}</div>
                <div className="faint">{f?.servingLabel} · {fmt((f?.kcal ?? 0) * ing.servings)} kcal</div>
              </div>
              <div style={{ width: 70 }} className="input">
                <NumberInput label={`Servings of ${f?.name}`} value={ing.servings} onChange={(v) => setIngs(ings.map((x, k) => (k === i ? { ...x, servings: v ?? 0 } : x)))} />
              </div>
              <button className="icon-btn" aria-label={`Remove ${f?.name}`} onClick={() => setIngs(ings.filter((_, k) => k !== i))}><Icon name="trash" /></button>
            </div>
          );
        })}
      </div>
      <button className="btn block secondary" onClick={() => setAdding(true)}><Icon name="plus" />Add Ingredient</button>
      {err && <div className="notice error" role="alert" style={{ marginTop: 12 }}>{err}</div>}
      {!isNew && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn secondary grow" onClick={async () => { const nid = uid(); await db.meals.put({ id: nid, name: `${name} (copy)`, ingredients: ings, createdAt: Date.now() }); nav(`/nutrition/meal/${nid}?${params}`, { replace: true }); }}>Duplicate</button>
          <button className="btn danger grow" onClick={() => setConfirmDel(true)}>Delete</button>
        </div>
      )}
      <div className="bottom-bar"><button className="btn block" onClick={save}>Save Meal</button></div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add Ingredient">
        <input className="input" placeholder="Search foods" aria-label="Search ingredients" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="list">
          {data.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).map((f) => (
            <button key={f.id} className="list-item" onClick={() => { setIngs([...ings, { foodId: f.id, servings: 1 }]); setAdding(false); setQ(""); }}>
              <div className="grow"><div>{f.name}</div><div className="faint">{f.servingLabel} · {fmt(f.kcal)} kcal</div></div>
            </button>
          ))}
        </div>
      </Sheet>
      <Confirm open={confirmDel} title="Delete meal?" body="Entries already logged keep their values." confirmLabel="Delete" danger onClose={() => setConfirmDel(false)} onConfirm={async () => { await db.meals.delete(id!); back(); }} />
    </div>
  );
}
