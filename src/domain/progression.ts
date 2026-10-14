// Progression cues, implementing ONLY the documented rules from the
// "How does progressive overload work in the BWS+ app?" support article:
//   - previous performance reaches the rep-range ceiling -> increase weight, reduce reps
//   - within range but below ceiling                     -> keep weight, add reps
//   - below the minimum                                  -> reduce weight, add reps
//   - cues use previous-week performance
//   - bodyweight movements receive no cues
//
// UNVERIFIED (parity gaps, see docs/PARITY.md): weight increments, rounding,
// how multiple sets are aggregated, and how many missed days suppress a cue.
// We therefore emit a direction only, never a number, and the set aggregation
// below is a stated assumption that can be swapped once specified.

export type Cue =
  | { kind: "increase"; label: string }
  | { kind: "add_reps"; label: string }
  | { kind: "decrease"; label: string }
  | { kind: "none"; reason: "bodyweight" | "no_previous_week" | "incomplete_data" };

export interface PrevSet {
  weight: number | null;
  reps: number | null;
  done: boolean;
}

export const CUE_LABELS = {
  increase: "Increase weight, reduce reps",
  add_reps: "Keep weight, aim for more reps",
  decrease: "Reduce weight, aim for more reps",
} as const;

/**
 * ASSUMPTION (unverified aggregation): evaluate completed working sets.
 * Ceiling reached = every completed set hit repMax. Below minimum = any
 * completed set fell under repMin. Otherwise within range.
 */
export function progressionCue(opts: {
  weighted: boolean;
  repMin: number;
  repMax: number;
  previousWeekSets: PrevSet[] | null;
}): Cue {
  if (!opts.weighted) return { kind: "none", reason: "bodyweight" };
  if (!opts.previousWeekSets) return { kind: "none", reason: "no_previous_week" };
  const done = opts.previousWeekSets.filter((s) => s.done && s.reps != null && s.weight != null);
  if (done.length === 0) return { kind: "none", reason: "incomplete_data" };
  if (done.some((s) => (s.reps as number) < opts.repMin)) return { kind: "decrease", label: CUE_LABELS.decrease };
  if (done.every((s) => (s.reps as number) >= opts.repMax)) return { kind: "increase", label: CUE_LABELS.increase };
  return { kind: "add_reps", label: CUE_LABELS.add_reps };
}
