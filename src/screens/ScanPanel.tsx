import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { NumberInput, Segmented, Unverified, fmt, useOnline } from "../components/ui";
import { db } from "../db/db";
import type { Food, Macros, MealSlot } from "../db/types";
import { lookupBarcode } from "../lib/openfoodfacts";
import { estimateFood, type Estimate } from "../lib/api";
import { logEntry } from "./AddFood";

type Mode = "barcode" | "photo" | "describe";

export default function ScanPanel({ date, slot, onLogged }: { date: string; slot: MealSlot; onLogged: () => void }) {
  const [mode, setMode] = useState<Mode>("barcode");
  return (
    <>
      <Segmented label="Scan mode" value={mode} onChange={setMode} options={[["barcode", "Barcode"], ["photo", "Meal photo"], ["describe", "Describe"]]} />
      <div style={{ height: 12 }} />
      {mode === "barcode" && <BarcodeMode date={date} slot={slot} onLogged={onLogged} />}
      {mode === "photo" && <AiMode kind="photo" date={date} slot={slot} onLogged={onLogged} />}
      {mode === "describe" && <AiMode kind="text" date={date} slot={slot} onLogged={onLogged} />}
    </>
  );
}

function BarcodeMode({ date, slot, onLogged }: { date: string; slot: MealSlot; onLogged: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"idle" | "camera" | "looking" | "found" | "notfound" | "denied" | "unsupported" | "error">("idle");
  const [code, setCode] = useState("");
  const [food, setFood] = useState<Food | null>(null);
  const [servings, setServings] = useState<number | null>(1);
  const [err, setErr] = useState("");
  const streamRef = useRef<MediaStream | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stop, []);

  async function lookup(c: string) {
    setCode(c);
    setState("looking");
    try {
      const local = await db.foods.where("barcode").equals(c).first();
      if (local) {
        setFood(local);
        return setState("found");
      }
      if (!navigator.onLine) {
        setErr("You're offline. Barcode lookup needs a connection unless the product was scanned before.");
        return setState("error");
      }
      const f = await lookupBarcode(c);
      if (!f) return setState("notfound");
      await db.foods.put(f);
      setFood(f);
      setState("found");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lookup failed.");
      setState("error");
    }
  }

  async function startCamera() {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!BD || !navigator.mediaDevices?.getUserMedia) return setState("unsupported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setState("camera");
      requestAnimationFrame(async () => {
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const det = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        const tick = async () => {
          if (!streamRef.current) return;
          try {
            const r = await det.detect(v);
            if (r[0]) {
              stop();
              return lookup(r[0].rawValue);
            }
          } catch {
            /* frame not ready */
          }
          setTimeout(tick, 250);
        };
        tick();
      });
    } catch (e) {
      setState((e as DOMException)?.name === "NotAllowedError" ? "denied" : "error");
      setErr("Could not open the camera.");
    }
  }

  return (
    <div className="card">
      {state === "camera" && (
        <>
          <video ref={videoRef} className="scanner" playsInline muted aria-label="Camera preview" />
          <button className="btn block secondary" style={{ marginTop: 8 }} onClick={() => { stop(); setState("idle"); }}>Cancel</button>
        </>
      )}
      {state !== "camera" && (
        <>
          <button className="btn block" onClick={startCamera}><Icon name="barcode" />Scan barcode</button>
          {state === "unsupported" && <p className="faint">Live barcode scanning isn't supported in this browser. Enter the number instead.</p>}
          {state === "denied" && <div className="notice error" role="alert">Camera permission was denied. Allow camera access in your browser settings, or type the barcode.</div>}
          <div className="row" style={{ marginTop: 12 }}>
            <input className="input grow" inputMode="numeric" placeholder="Barcode number" aria-label="Barcode number" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button className="btn secondary" disabled={code.length < 8} onClick={() => lookup(code)}>Look up</button>
          </div>
        </>
      )}
      {state === "looking" && <p role="status"><span className="spinner" /> Looking up {code}…</p>}
      {state === "notfound" && <div className="notice" role="status" style={{ marginTop: 12 }}>No product found for {code}. Create it under Custom with this barcode.</div>}
      {state === "error" && (
        <div className="notice error" role="alert" style={{ marginTop: 12 }}>
          {err} <button className="btn ghost small" onClick={() => lookup(code)}>Retry</button>
        </div>
      )}
      {state === "found" && food && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700 }}>{food.name}</div>
          <div className="faint">{food.brand ? `${food.brand} · ` : ""}{food.servingLabel}: {fmt(food.kcal)} kcal · {fmt(food.protein, 1)} p · {fmt(food.carbs, 1)} c · {fmt(food.fat, 1)} f</div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Servings</label>
            <div className="input" style={{ padding: 0 }}><NumberInput label="Servings" value={servings} onChange={setServings} /></div>
          </div>
          <button className="btn block" disabled={!servings} onClick={async () => { await logEntry(date, slot, { kind: "food", refId: food.id, name: food.name, servings: servings!, servingLabel: food.servingLabel, perServing: food }); onLogged(); }}>Log</button>
        </div>
      )}
      <p className="faint" style={{ marginTop: 12 }}>Product data: Open Food Facts (not the BWS database).</p>
    </div>
  );
}

function AiMode({ kind, date, slot, onLogged }: { kind: "photo" | "text"; date: string; slot: MealSlot; onLogged: () => void }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const [items, setItems] = useState<Estimate["items"]>([]);
  const [note, setNote] = useState("");
  const online = useOnline();

  async function onFile(f: File) {
    const img = await createImageBitmap(f);
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.85);
    setImage({ data: url.split(",")[1], mediaType: "image/jpeg", preview: url });
  }

  async function run() {
    setState("loading");
    setErr("");
    try {
      const r = await estimateFood(kind === "photo" ? { image: { data: image!.data, mediaType: image!.mediaType } } : { text });
      setItems(r.items);
      setNote(r.note ?? "");
      setState("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Estimate failed.");
      setState("error");
    }
  }

  const total = items.reduce<Macros>((a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  return (
    <div className="card">
      {kind === "photo" ? (
        <>
          <label className="btn block secondary" style={{ cursor: "pointer" }}>
            <Icon name="camera" />{image ? "Choose another photo" : "Take or upload a photo"}
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {image && <img src={image.preview} alt="Meal to analyse" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />}
        </>
      ) : (
        <textarea className="input" aria-label="Describe what you ate" placeholder="e.g. Two scrambled eggs on wholemeal toast with butter" value={text} onChange={(e) => setText(e.target.value)} />
      )}
      {!online && <div className="notice" style={{ marginTop: 10 }}>AI estimates need a connection.</div>}
      <button className="btn block" style={{ marginTop: 10 }} disabled={!online || state === "loading" || (kind === "photo" ? !image : text.trim().length < 3)} onClick={run}>
        {state === "loading" ? <span className="spinner" /> : "Estimate nutrition"}
      </button>
      {state === "error" && (
        <div className="notice error" role="alert" style={{ marginTop: 10 }}>
          {err} <button className="btn ghost small" onClick={run}>Retry</button>
        </div>
      )}
      {state === "done" && (
        <div style={{ marginTop: 12 }}>
          {items.length === 0 && <p className="muted">No food recognised.</p>}
          {items.map((it, i) => (
            <div key={i} className="list-item" style={{ flexWrap: "wrap" }}>
              <input className="input grow" aria-label={`Item ${i + 1} name`} value={it.name} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <div className="row" style={{ width: "100%" }}>
                {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
                  <div key={k} className="grow">
                    <div className="faint">{k}</div>
                    <div className="input" style={{ padding: 0, minHeight: 38 }}><NumberInput label={`${it.name} ${k}`} value={it[k]} onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v ?? 0 } : x)))} /></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {note && <p className="faint">{note}</p>}
          {items.length > 0 && (
            <button
              className="btn block"
              onClick={async () => {
                for (const it of items) {
                  const f: Food = { id: "", name: it.name, servingLabel: it.servingLabel || "1 portion", kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, custom: true, source: "ai-estimate" };
                  await logEntry(date, slot, { kind: "food", name: f.name, servings: 1, servingLabel: f.servingLabel, perServing: f });
                }
                onLogged();
              }}
            >
              Log {items.length} item{items.length > 1 ? "s" : ""} · {fmt(total.kcal)} kcal
            </button>
          )}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <Unverified>AI estimates come from Claude via this app's server, not BWS's meal-analysis model. Review values before logging.</Unverified>
      </div>
    </div>
  );
}
