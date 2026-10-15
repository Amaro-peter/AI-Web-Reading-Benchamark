'use client';

import type { ScientificMetrics } from '@/lib/types';

interface MetricRadarChartProps {
  metrics: ScientificMetrics;
}

interface Axis {
  label: string;
  sublabel: string;
  value: number;
  angle: number;
}

export function MetricRadarChart({ metrics }: MetricRadarChartProps) {
  const size = 320;
  const center = size / 2;
  const radius = center - 50;

  const axes: Axis[] = [
    { label: 'SID', sublabel: 'Semantic Density', value: metrics.sid ?? 0, angle: 0 },
    { label: 'HPCI', sublabel: 'Heading Monotonicity', value: metrics.hpci ?? 0, angle: 72 },
    { label: 'AAC', sublabel: 'Affordance Completeness', value: metrics.aac ?? 0, angle: 144 },
    { label: 'DCE', sublabel: 'DOM Entropy', value: metrics.dce ?? 80, angle: 216 },
    { label: 'MEG', sublabel: 'Multimodal Grounding', value: metrics.meg ?? 70, angle: 288 },
  ];

  // Helper to convert polar to cartesian coordinates
  function polarToCartesian(angleDegrees: number, r: number) {
    const angleRadians = ((angleDegrees - 90) * Math.PI) / 180.0;
    return {
      x: center + r * Math.cos(angleRadians),
      y: center + r * Math.sin(angleRadians),
    };
  }

  // Generate polygon points for a given percentage level
  function generateGridPolygon(percentage: number) {
    const r = (percentage / 100) * radius;
    return axes
      .map((axis) => {
        const { x, y } = polarToCartesian(axis.angle, r);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  // Data polygon points
  const dataPoints = axes.map((axis) => {
    const r = (Math.max(10, Math.min(100, axis.value)) / 100) * radius;
    return polarToCartesian(axis.angle, r);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[340px] overflow-visible"
        aria-label="Scientific metrics radar visualization"
      >
        {/* Background web circles / polygons */}
        {[25, 50, 75, 100].map((level) => (
          <polygon
            key={level}
            points={generateGridPolygon(level)}
            className="fill-none stroke-slate-200 dark:stroke-slate-800"
            strokeWidth={1}
            strokeDasharray={level < 100 ? '2 2' : undefined}
          />
        ))}

        {/* Radial axes */}
        {axes.map((axis) => {
          const outer = polarToCartesian(axis.angle, radius);
          return (
            <line
              key={axis.label}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth={1}
            />
          );
        })}

        {/* Data area */}
        <polygon
          points={dataPolygon}
          className="fill-sky-500/20 stroke-sky-600 dark:fill-sky-400/25 dark:stroke-sky-400"
          strokeWidth={2.5}
        />

        {/* Data points */}
        {dataPoints.map((point, i) => (
          <circle
            key={axes[i]?.label}
            cx={point.x}
            cy={point.y}
            r={4.5}
            className="fill-sky-600 stroke-white dark:fill-sky-400 dark:stroke-slate-900"
            strokeWidth={2}
          />
        ))}

        {/* Axis labels */}
        {axes.map((axis) => {
          const labelPos = polarToCartesian(axis.angle, radius + 26);
          const isTop = axis.angle === 0;
          const isRight = axis.angle > 0 && axis.angle < 180;
          const isLeft = axis.angle > 180;

          const textAnchor = isTop ? 'middle' : isRight ? 'start' : isLeft ? 'end' : 'middle';

          return (
            <g key={axis.label} transform={`translate(${labelPos.x}, ${labelPos.y})`}>
              <text
                textAnchor={textAnchor}
                className="fill-slate-900 text-[11px] font-bold dark:fill-slate-100"
                dy="-2"
              >
                {axis.label} ({axis.value}%)
              </text>
              <text
                textAnchor={textAnchor}
                className="fill-slate-500 text-[9px] dark:fill-slate-400"
                dy="9"
              >
                {axis.sublabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
