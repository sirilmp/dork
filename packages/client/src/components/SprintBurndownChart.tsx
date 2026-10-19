import { BurndownPoint } from '../api/types';

const WIDTH = 480;
const HEIGHT = 200;
const PADDING = { top: 12, right: 16, bottom: 24, left: 32 };

/**
 * Hand-rolled inline SVG line chart (no charting library) so the burndown stays
 * on-brand: it reads `var(--color-primary)` / `var(--color-accent)`, the same
 * CSS custom properties ThemeProvider sets from admin branding, instead of
 * hardcoding colors.
 */
export function SprintBurndownChart({ points, totalPoints }: { points: BurndownPoint[]; totalPoints: number }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No burndown data yet.</p>;
  }

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maxY = Math.max(totalPoints, ...points.map((p) => p.remainingPoints), 1);

  const x = (i: number) => PADDING.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * innerWidth);
  const y = (value: number) => PADDING.top + innerHeight - (value / maxY) * innerHeight;

  const actualPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.remainingPoints)}`).join(' ');
  const idealPath = `M ${x(0)} ${y(totalPoints)} L ${x(points.length - 1)} ${y(0)}`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Sprint burndown chart">
      {/* Y-axis gridlines */}
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

      <path d={idealPath} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="4 4" />
      <path d={actualPath} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} />

      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.remainingPoints)} r={3} fill="var(--color-primary)" />
      ))}

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
    </svg>
  );
}
