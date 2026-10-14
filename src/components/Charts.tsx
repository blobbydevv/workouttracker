export function LineChart({ points, label, unit }: { points: Array<{ x: string; y: number }>; label: string; unit: string }) {
  if (points.length === 0) return <div className="empty">No data yet.</div>;
  const W = 340, H = 160, P = 28;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const sx = (i: number) => P + (points.length === 1 ? (W - 2 * P) / 2 : (i / (points.length - 1)) * (W - 2 * P));
  const sy = (y: number) => H - P - ((y - min) / span) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${points.length} points, latest ${points.at(-1)!.y.toFixed(1)} ${unit}`}>
      <line className="axis" x1={P} x2={W - P} y1={H - P} y2={H - P} />
      <text x={2} y={sy(max) + 3}>{max.toFixed(1)}</text>
      <text x={2} y={sy(min) + 3}>{min.toFixed(1)}</text>
      <text x={P} y={H - 8}>{points[0].x.slice(5)}</text>
      <text x={W - P - 24} y={H - 8}>{points.at(-1)!.x.slice(5)}</text>
      <path className="line" d={d} />
      {points.map((p, i) => <circle key={i} className="pt" cx={sx(i)} cy={sy(p.y)} r={2.5} />)}
    </svg>
  );
}

export function BarChart({ bars, goal, label }: { bars: Array<{ x: string; y: number }>; goal?: number; label: string }) {
  const W = 340, H = 160, P = 22;
  const max = Math.max(goal ?? 0, ...bars.map((b) => b.y), 1);
  const bw = (W - 2 * P) / bars.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line className="axis" x1={P} x2={W - P} y1={H - P} y2={H - P} />
      {goal != null && <line x1={P} x2={W - P} y1={H - P - (goal / max) * (H - 2 * P)} y2={H - P - (goal / max) * (H - 2 * P)} stroke="var(--text-3)" strokeDasharray="4 4" />}
      {bars.map((b, i) => {
        const h = (b.y / max) * (H - 2 * P);
        return <rect key={b.x} x={P + i * bw + 2} y={H - P - h} width={bw - 4} height={h} rx={3} fill="var(--accent)" opacity={b.y ? 1 : 0.2} />;
      })}
      <text x={P} y={H - 6}>{bars[0]?.x.slice(5)}</text>
      <text x={W - P - 24} y={H - 6}>{bars.at(-1)?.x.slice(5)}</text>
    </svg>
  );
}
