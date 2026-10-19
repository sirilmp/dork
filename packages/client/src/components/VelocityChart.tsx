import { VelocityPoint } from '../api/types';

const WIDTH = 480;
const HEIGHT = 220;
const PADDING = { top: 12, right: 16, bottom: 32, left: 32 };

/** How many of the most recent sprints the average-velocity line is computed over. */
const AVERAGE_WINDOW = 5;

/**
 * Hand-rolled inline SVG grouped bar chart (no charting library), matching
 * SprintBurndownChart's branding-aware styling: completed points use
 * `var(--color-primary)` at full opacity, committed points the same color at
 * reduced opacity, so the pair reads as "two shades of the same series"
 * rather than two unrelated colors, and both stay on-brand for any admin
 * theme.
 */
export function VelocityChart({ points }: { points: VelocityPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">Complete at least one sprint to see velocity.</p>;
  }

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maxY = Math.max(...points.map((p) => Math.max(p.committedPoints, p.completedPoints)), 1);

  const recent = points.slice(-AVERAGE_WINDOW);
  const average = recent.reduce((sum, p) => sum + p.completedPoints, 0) / recent.length;

  const groupWidth = innerWidth / points.length;
  const barWidth = Math.min(28, groupWidth * 0.32);
  const y = (value: number) => PADDING.top + innerHeight - (value / maxY) * innerHeight;
  const averageY = y(average);

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Velocity chart">
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

        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={averageY}
          y2={averageY}
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text x={WIDTH - PADDING.right} y={averageY - 4} textAnchor="end" className="fill-slate-500 text-[10px]">
          avg {Math.round(average * 10) / 10}
        </text>

        {points.map((p, i) => {
          const groupX = PADDING.left + i * groupWidth + groupWidth / 2;
          const committedX = groupX - barWidth * 0.6;
          const completedX = groupX + barWidth * 0.6 - barWidth;
          return (
            <g key={p.sprintId}>
              <rect
                x={committedX}
                y={y(p.committedPoints)}
                width={barWidth}
                height={innerHeight - (y(p.committedPoints) - PADDING.top)}
                fill="var(--color-primary)"
                opacity={0.35}
                rx={2}
              />
              <rect
                x={completedX}
                y={y(p.completedPoints)}
                width={barWidth}
                height={innerHeight - (y(p.completedPoints) - PADDING.top)}
                fill="var(--color-primary)"
                rx={2}
              />
              <text
                x={groupX}
                y={HEIGHT - PADDING.bottom + 14}
                textAnchor="middle"
                className="fill-slate-400 text-[9px]"
              >
                {p.sprintName.length > 10 ? `${p.sprintName.slice(0, 9)}…` : p.sprintName}
              </text>
            </g>
          );
        })}

        <text x={PADDING.left - 4} y={PADDING.top + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
          {maxY}
        </text>
        <text x={PADDING.left - 4} y={PADDING.top + innerHeight} textAnchor="end" className="fill-slate-400 text-[10px]">
          0
        </text>
      </svg>

      <div className="mt-1 flex items-center justify-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-primary)', opacity: 0.35 }} />
          Committed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-primary)' }} />
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3" style={{ backgroundColor: 'var(--color-accent)' }} />
          Average velocity (last {Math.min(AVERAGE_WINDOW, points.length)})
        </span>
      </div>
    </div>
  );
}
