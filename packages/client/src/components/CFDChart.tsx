import { useState } from 'react';
import { CFDPoint } from '../api/types';

const WIDTH = 480;
const HEIGHT = 240;
const PADDING = { top: 12, right: 16, bottom: 24, left: 32 };

// Only two brand colors are themeable (--color-primary / --color-accent), so
// the three stacked bands use: Done = primary (the "finished work" band,
// drawn at the bottom so its growth is the classic CFD read), In Progress =
// accent, and To Do = a neutral slate (no third brand color exists to use).
const BAND_COLOR = { done: 'var(--color-primary)', inProgress: 'var(--color-accent)', todo: '#cbd5e1' } as const;

/**
 * Hand-rolled inline SVG stacked-area chart (no charting library), styled
 * consistently with SprintBurndownChart/VelocityChart. A simple
 * nearest-point-on-mouse-move interaction draws a vertical guide line and a
 * small tooltip box with exact per-band counts for that day.
 */
export function CFDChart({ points }: { points: CFDPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length < 2) {
    return <p className="text-sm text-slate-500">Not enough history yet.</p>;
  }

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const totals = points.map((p) => p.todoCount + p.inProgressCount + p.doneCount);
  const maxY = Math.max(...totals, 1);

  const x = (i: number) => PADDING.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * innerWidth);
  const y = (value: number) => PADDING.top + innerHeight - (value / maxY) * innerHeight;

  // Stacked cumulative values per day, bottom-up: Done, then Done+InProgress, then the total.
  const doneTop = points.map((p) => p.doneCount);
  const inProgressTop = points.map((p, i) => doneTop[i] + p.inProgressCount);
  const todoTop = points.map((p, i) => inProgressTop[i] + p.todoCount);

  function areaPath(topValues: number[], baseValues: number[]): string {
    const topPts = topValues.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
    const basePts = baseValues
      .map((v, i) => `L ${x(baseValues.length - 1 - i)} ${y(baseValues[baseValues.length - 1 - i])}`)
      .join(' ');
    return `${topPts} ${basePts} Z`;
  }

  const zero = points.map(() => 0);

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const fraction = (relX - PADDING.left) / innerWidth;
    const index = Math.round(fraction * (points.length - 1));
    setHoverIndex(Math.min(points.length - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const tooltipX = hoverIndex != null ? x(hoverIndex) : 0;
  const tooltipOnRight = hoverIndex != null && hoverIndex > points.length / 2;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Cumulative flow diagram"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {[0, 0.5, 1].map((frac) => (
          <line
            key={frac}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={PADDING.top + innerHeight * (1 - frac)}
            y2={PADDING.top + innerHeight * (1 - frac)}
            stroke="currentColor"
            className="text-slate-200"
            strokeWidth={1}
          />
        ))}

        <path d={areaPath(doneTop, zero)} fill={BAND_COLOR.done} opacity={0.85} />
        <path d={areaPath(inProgressTop, doneTop)} fill={BAND_COLOR.inProgress} opacity={0.7} />
        <path d={areaPath(todoTop, inProgressTop)} fill={BAND_COLOR.todo} opacity={0.9} />

        {hovered && hoverIndex != null && (
          <>
            <line x1={tooltipX} x2={tooltipX} y1={PADDING.top} y2={PADDING.top + innerHeight} stroke="currentColor" className="text-slate-500" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={tooltipX} cy={y(doneTop[hoverIndex])} r={2.5} fill={BAND_COLOR.done} />
            <circle cx={tooltipX} cy={y(inProgressTop[hoverIndex])} r={2.5} fill={BAND_COLOR.inProgress} />
            <circle cx={tooltipX} cy={y(todoTop[hoverIndex])} r={2.5} fill="#64748b" />
          </>
        )}

        <text x={PADDING.left} y={HEIGHT - 6} className="fill-slate-400 text-[10px]">
          {points[0].date}
        </text>
        <text x={WIDTH - PADDING.right} y={HEIGHT - 6} textAnchor="end" className="fill-slate-400 text-[10px]">
          {points[points.length - 1].date}
        </text>
        <text x={PADDING.left - 4} y={PADDING.top + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
          {maxY}
        </text>
        <text x={PADDING.left - 4} y={PADDING.top + innerHeight} textAnchor="end" className="fill-slate-400 text-[10px]">
          0
        </text>

        {hovered && (
          <g transform={`translate(${tooltipOnRight ? tooltipX - 110 : tooltipX + 8}, ${PADDING.top + 4})`}>
            <rect width={100} height={58} rx={4} fill="white" stroke="currentColor" className="text-slate-300" strokeWidth={1} />
            <text x={8} y={14} className="fill-slate-600 text-[9px] font-medium">{hovered.date}</text>
            <text x={8} y={28} className="text-[9px]" fill={BAND_COLOR.done}>Done: {hovered.doneCount}</text>
            <text x={8} y={40} className="text-[9px]" fill={BAND_COLOR.inProgress}>In progress: {hovered.inProgressCount}</text>
            <text x={8} y={52} className="fill-slate-500 text-[9px]">To do: {hovered.todoCount}</text>
          </g>
        )}
      </svg>

      <div className="mt-1 flex items-center justify-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BAND_COLOR.done, opacity: 0.85 }} />
          Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BAND_COLOR.inProgress, opacity: 0.7 }} />
          In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BAND_COLOR.todo }} />
          To do
        </span>
      </div>
    </div>
  );
}
