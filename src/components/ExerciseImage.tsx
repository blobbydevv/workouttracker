import { useState } from "react";
import { Sheet } from "./ui";

// Demo photos from free-exercise-db (github.com/yuhonas/free-exercise-db),
// released into the public domain (Unlicense). Stored in public/exercises/.
const HAS_IMAGE = new Set(["bench-dip","bench","cable-curl","cable-fly","cable-lat-raise","cable-row","calf-raise","chest-row","crunch","db-bench","db-calf","db-curl","db-fly","db-rdl","db-rear-delt","db-row","glute-bridge","goblet-squat","hammer-curl","hip-thrust","incline-db","lat-raise","leg-curl","leg-ext","leg-press","lunge","machine-press","machine-shoulder","oh-ext","ohp","plank","pulldown","pullup","pushdown","pushup","rdl","rear-delt","split-squat","squat"]);

export const exerciseImageUrl = (id: string) => (HAS_IMAGE.has(id) ? `${import.meta.env.BASE_URL}exercises/${id}.jpg` : null);

/** Small thumbnail; tap to see it full size. Renders nothing for exercises without a photo. */
export function ExerciseThumb({ id, name, size = 52 }: { id: string; name: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const url = exerciseImageUrl(id);
  if (!url) return null;
  return (
    <>
      <button className="ex-thumb" style={{ width: size, height: size }} onClick={() => setOpen(true)} aria-label={`How to do ${name}`}>
        <img src={url} alt="" loading="lazy" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={name}>
        <img src={url} alt={`Example of ${name}`} style={{ width: "100%", borderRadius: 12 }} />
        <p className="faint">Example photo: free-exercise-db (public domain).</p>
      </Sheet>
    </>
  );
}

/** Full-width photo for an exercise's page. */
export function ExerciseHero({ id, name }: { id: string; name: string }) {
  const url = exerciseImageUrl(id);
  if (!url) return null;
  return <img src={url} alt={`Example of ${name}`} className="ex-hero" loading="lazy" />;
}
