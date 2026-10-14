import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header, NumberInput } from "../components/ui";
import { db, uid } from "../db/db";
import { kcalFromMacros } from "../domain/nutrition";

/** Documented: Custom > Create new food — macros and calories for a serving, optional barcode. */
export default function CustomFood() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState({ name: "", brand: "", servingLabel: "1 serving", barcode: "" });
  const [m, setM] = useState<{ kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }>({ kcal: null, protein: null, carbs: null, fat: null });
  const [err, setErr] = useState<string | null>(null);
  const implied = kcalFromMacros(m.protein ?? 0, m.carbs ?? 0, m.fat ?? 0);
  const mismatch = m.kcal != null && implied > 0 && Math.abs(implied - m.kcal) / Math.max(m.kcal, 1) > 0.2;

  async function save() {
    if (!f.name.trim()) return setErr("Enter a food name.");
    if (m.kcal == null) return setErr("Enter calories per serving.");
    if (f.barcode && (await db.foods.where("barcode").equals(f.barcode).count())) return setErr("A food with this barcode already exists.");
    await db.foods.add({
      id: uid(),
      name: f.name.trim(),
      brand: f.brand.trim() || undefined,
      servingLabel: f.servingLabel.trim() || "1 serving",
      barcode: f.barcode || undefined,
      kcal: m.kcal,
      protein: m.protein ?? 0,
      carbs: m.carbs ?? 0,
      fat: m.fat ?? 0,
      custom: true,
      source: "custom",
    });
    const date = params.get("date");
    if (date) nav(`/nutrition/add/${date}/${params.get("slot")}`, { replace: true });
    else nav(-1);
  }

  return (
    <div className="screen no-tabbar">
      <Header title="Create Food" back />
      {(["name", "brand", "servingLabel", "barcode"] as const).map((k) => (
        <div key={k} className="field">
          <label htmlFor={k}>{{ name: "Food name", brand: "Brand (optional)", servingLabel: "Serving size", barcode: "Barcode (optional)" }[k]}</label>
          <input id={k} className="input" inputMode={k === "barcode" ? "numeric" : undefined} value={f[k]} onChange={(e) => setF({ ...f, [k]: k === "barcode" ? e.target.value.replace(/\D/g, "") : e.target.value })} />
        </div>
      ))}
      <div className="row" style={{ flexWrap: "wrap" }}>
        {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
          <div key={k} className="field" style={{ flex: "1 1 40%" }}>
            <label>{k === "kcal" ? "Calories" : `${k[0].toUpperCase()}${k.slice(1)} (g)`}</label>
            <div className="input" style={{ padding: 0 }}><NumberInput label={k === "kcal" ? "Calories" : k} value={m[k]} onChange={(v) => setM({ ...m, [k]: v })} /></div>
          </div>
        ))}
      </div>
      {mismatch && <div className="notice">Calories don't match the macros (≈{Math.round(implied)} kcal). Double-check the label.</div>}
      {err && <div className="notice error" role="alert" style={{ marginTop: 8 }}>{err}</div>}
      <div className="bottom-bar"><button className="btn block" onClick={save}>Save Food</button></div>
    </div>
  );
}
