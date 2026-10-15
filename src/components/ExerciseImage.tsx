import { useState } from "react";
import { Sheet } from "./ui";

// Demo photos from free-exercise-db (github.com/yuhonas/free-exercise-db),
// released into the public domain (Unlicense). Stored in public/exercises/.
const HAS_IMAGE = new Set(["ab-wheel","arnold-press","barbell-lunge","barbell-ohp","barbell-row","bench-dip","bench","box-jump","bw-squat","cable-curl","cable-fly","cable-kickback","cable-lat-raise","cable-row","calf-raise","chest-dip","chest-row","chinup","close-bench","close-pushup","concentration-curl","crunch","db-bench","db-calf","db-curl","db-floor-press","db-fly","db-rdl","db-rear-delt","db-row","db-shrug","deadlift","decline-bench","face-pull","farmer-walk","front-squat","glute-bridge","goblet-squat","good-morning","hack-squat","hammer-curl","handstand-pushup","hanging-leg-raise","hip-abduction","hip-thrust","incline-bench","incline-db","inverted-row","jump-squat","kb-high-pull","kb-swing","lat-raise","leg-curl","leg-ext","leg-press","lunge","lying-leg-curl","machine-press","machine-shoulder","mountain-climber","oh-ext","ohp","plank","plyo-pushup","power-clean","preacher-curl","pulldown","pullup","push-press","pushdown","pushup","rdl","rear-delt","rower","russian-twist","seated-calf","shrug","side-plank","skullcrusher","sl-glute-bridge","sled-push","split-squat","squat","star-jump","step-up","sumo-deadlift","tbar-row","tri-dip"]);

export const exerciseImageUrl = (id: string) => (HAS_IMAGE.has(id) ? `${import.meta.env.BASE_URL}exercises/${id}.jpg` : null);

/** Small thumbnail; tap to see it full size. Renders nothing for exercises without a photo. */
export function ExerciseThumb({ id, name, size = 52, still }: { id: string; name: string; size?: number; still?: boolean }) {
  const [open, setOpen] = useState(false);
  const url = exerciseImageUrl(id);
  if (!url) return null;
  // Inside another button (e.g. a picker row) render a plain picture.
  if (still) return <span className="ex-thumb" style={{ width: size, height: size }}><img src={url} alt="" loading="lazy" /></span>;
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
