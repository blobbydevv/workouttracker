import { useEffect, useMemo, useRef, useState } from "react";

export interface ProgressPoint {
  date: string; // YYYY-MM-DD
  value: number;
  /** Extra line shown in the readout, e.g. "60 kg × 10". */
  detail?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const t = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const shortDate = (d: string) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}`;
const fmtNum = (n: number) => (Math.round(n * 10) / 10).toString();

/** "Nice" axis ticks (1, 2, 2.5, 5 × 10^k) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/**
 * Single-series line chart over time: recessive grid, 2px line, 8px markers,
 * the latest value labelled directly, and a crosshair readout on hover, tap
 * or arrow keys.
 */
export function ProgressChart({ title, unit, points, height = 190 }: { title: string; unit: string; points: ProgressPoint[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(Math.max(240, Math.round(entries[0].contentRect.width)));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const geo = useMemo(() => {
    if (!points.length) return null;
    const pad = { l: 40, r: 44, t: 14, b: 26 };
    const ys = points.map((p) => p.value);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const tx = points.map((p) => t(p.date));
    const x0 = Math.min(...tx);
    const x1 = Math.max(...tx);
    const iw = width - pad.l - pad.r;
    const ih = height - pad.t - pad.b;
    const sx = (v: number) => (x1 === x0 ? pad.l + iw / 2 : pad.l + ((v - x0) / (x1 - x0)) * iw);
    const sy = (v: number) => pad.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
    const xy = points.map((p, i) => ({ x: sx(tx[i]), y: sy(p.value) }));
    // Up to 4 date labels, evenly spread across the points.
    const n = points.length;
    const xIdx = n <= 4 ? points.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1];
    return { pad, ticks, sy, xy, xIdx: [...new Set(xIdx)], iw, ih };
  }, [points, width, height]);

  const n = points.length;
  const latest = points[n - 1];
  const summary = n ? `${title}: ${n} workout${n === 1 ? "" : "s"}, latest ${fmtNum(latest.value)} ${unit} on ${shortDate(latest.date)}` : `${title}: no data`;

  const nearest = (clientX: number) => {
    if (!geo || !wrap.current) return null;
    const x = clientX - wrap.current.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < geo.xy.length; i++) if (Math.abs(geo.xy[i].x - x) < Math.abs(geo.xy[best].x - x)) best = i;
    return best;
  };

  const a = active != null && geo ? { p: points[active], xy: geo.xy[active] } : null;

  return (
    <figure className="pchart" style={{ margin: 0 }}>
      <figcaption className="pchart-title">
        <span>{title}</span>
        {latest && (
          <span className="pchart-latest">
            <strong>{fmtNum(latest.value)}</strong> {unit}
          </span>
        )}
      </figcaption>
      <div
        ref={wrap}
        className="pchart-plot"
        tabIndex={n ? 0 : -1}
        role="img"
        aria-label={summary}
        onPointerMove={(e) => setActive(nearest(e.clientX))}
        onPointerDown={(e) => setActive(nearest(e.clientX))}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (!n) return;
          if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? n) - 1));
          else if (e.key === "ArrowRight") setActive((i) => Math.min(n - 1, (i ?? -1) + 1));
          else if (e.key === "Escape") setActive(null);
          else return;
          e.preventDefault();
        }}
      >
        {!geo ? (
          <div className="empty" style={{ padding: "40px 0" }}>No sets logged in this range.</div>
        ) : (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            {geo.ticks.map((v) => (
              <g key={v}>
                <line className="pc-grid" x1={geo.pad.l} x2={width - geo.pad.r} y1={geo.sy(v)} y2={geo.sy(v)} />
                <text className="pc-axis" x={geo.pad.l - 8} y={geo.sy(v)} dy="0.32em" textAnchor="end">{fmtNum(v)}</text>
              </g>
            ))}
            {geo.xIdx.map((i) => (
              <text key={i} className="pc-axis" x={geo.xy[i].x} y={height - 6} textAnchor={geo.xIdx.length > 1 && i === 0 ? "start" : i === n - 1 && geo.xIdx.length > 1 ? "end" : "middle"}>
                {shortDate(points[i].date)}
              </text>
            ))}
            {a && <line className="pc-cross" x1={a.xy.x} x2={a.xy.x} y1={geo.pad.t} y2={geo.pad.t + geo.ih} />}
            {n > 1 && <path className="pc-line" d={geo.xy.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("")} />}
            {geo.xy.map((p, i) => (
              <circle key={i} className={`pc-dot ${active === i ? "on" : ""}`} cx={p.x} cy={p.y} r={active === i ? 5.5 : 4} />
            ))}
            {/* Direct label on the latest point. */}
            {active == null && (
              <text className="pc-label" x={geo.xy[n - 1].x + 8} y={geo.xy[n - 1].y} dy="0.32em">{fmtNum(latest.value)}</text>
            )}
          </svg>
        )}
        {a && (
          <div className="pc-tip" role="status" style={{ left: Math.min(Math.max(a.xy.x, 70), width - 70), top: 0 }}>
            <strong>{fmtNum(a.p.value)} {unit}</strong>
            <span>{shortDate(a.p.date)}{a.p.detail ? ` · ${a.p.detail}` : ""}</span>
          </div>
        )}
      </div>
      {n === 1 && <p className="faint" style={{ margin: "4px 0 0" }}>Log this exercise again to see a trend line.</p>}
    </figure>
  );
}
