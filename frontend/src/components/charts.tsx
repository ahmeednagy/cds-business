import { useId, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Box, useTheme } from "@mui/material";

interface Point {
  label: string;
  value: number;
}

const W = 620;
const H = 200;
const PAD = { top: 26, right: 16, bottom: 34, left: 36 };

/** Minimum horizontal gap between x-axis label centres — decimate instead of
 * shrinking text when there are too many points (minTickGap equivalent). */
const MIN_LABEL_GAP = 48;

function innerW() {
  return W - PAD.left - PAD.right;
}
function innerH() {
  return H - PAD.top - PAD.bottom;
}

/** Label cadence for `count` x points: render every `step`th label plus the
 * final one, so dense series stay readable and endpoints never clip. */
function labelStep(count: number): number {
  const maxLabels = Math.max(2, Math.floor(innerW() / MIN_LABEL_GAP) + 1);
  return Math.max(1, Math.ceil((count - 1) / (maxLabels - 1)));
}

const NICE_STEPS = [0.5, 1, 2, 2.5, 5, 10, 15, 20, 25, 50, 100];

/** Reference-style y-axis: 4–5 evenly spaced gridlines on a "nice" step so
 * the axis reads sensibly regardless of the data magnitude (0.5→50). */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const raw = max / 4;
  const step = NICE_STEPS.find((s) => s >= raw) ?? Math.ceil(raw / 100) * 100;
  const n = Math.max(4, Math.ceil(max / step));
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}

/** Localized digit formatting — Arabic UI uses Arabic-Indic numerals. */
function useNumberFmt() {
  const { i18n } = useTranslation();
  const lng = i18n.language.startsWith("ar")
    ? `${i18n.language}-u-nu-arab`
    : i18n.language;
  const int = new Intl.NumberFormat(lng, { maximumFractionDigits: 0 });
  const oneDec = new Intl.NumberFormat(lng, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return { int, oneDec };
}

/** Floating tooltip anchored to a point inside the chart's 0..1 coordinate
 * space. Rendered inside a `position: relative` chart wrapper. */
function ChartTooltip({
  x,
  y,
  label,
  value,
}: {
  x: number;
  y: number;
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        // Physical % coordinates: charts keep a fixed LTR drawing direction
        // even under RTL (time axes read left→right in both languages).
        left: `${Math.min(92, Math.max(8, (x / W) * 100))}%`,
        top: `${(y / H) * 100}%`,
        transform: "translate(-50%, calc(-100% - 10px))",
        pointerEvents: "none",
        zIndex: 2,
        px: 1.25,
        py: 0.75,
        borderRadius: 2,
        bgcolor: "background.paper",
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.shadows[3],
        whiteSpace: "nowrap",
        fontSize: "0.75rem",
        color: "text.secondary",
        textAlign: "center",
        lineHeight: 1.4,
        "& b": { color: theme.palette.text.primary, fontWeight: 700 },
      }}
    >
      {label}
      <br />
      <b>{value}</b>
    </Box>
  );
}

/** Map a pointer event to the svg-space x coordinate. */
function svgX(e: PointerEvent<SVGSVGElement>): number {
  const rect = e.currentTarget.getBoundingClientRect();
  return ((e.clientX - rect.left) / rect.width) * W;
}

/** CDS red area line chart: gradient fill, dot markers, hover crosshair +
 * tooltip, gray gridlines and localized axis labels. */
export function LineChart({
  points,
  formatValue,
}: {
  points: Point[];
  formatValue?: (v: number) => string;
}) {
  const theme = useTheme();
  const { oneDec } = useNumberFmt();
  const fmt = formatValue ?? ((v: number) => oneDec.format(v));
  // useId() emits colons which are invalid inside url(#…) in some contexts.
  const gradientId = `chart-grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value), 1);
  const ys = ticks(max);
  const yMax = ys[ys.length - 1];
  const x = (i: number) =>
    PAD.left +
    (points.length > 1 ? (i / (points.length - 1)) * innerW() : innerW() / 2);
  const y = (v: number) => PAD.top + innerH() - (v / yMax) * innerH();

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const area = points.length
    ? `${PAD.left},${y(0)} ${line} ${x(points.length - 1)},${y(0)}`
    : "";
  const step = labelStep(points.length);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const px = svgX(e);
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    }
    setHover(best);
  };

  return (
    <Box sx={{ position: "relative", direction: "ltr" }}>
      {hover !== null && points[hover] ? (
        <ChartTooltip
          x={x(hover)}
          y={y(points[hover].value)}
          label={points[hover].label}
          value={fmt(points[hover].value)}
        />
      ) : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        style={{ display: "block" }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={theme.palette.primary.main}
              stopOpacity="0.26"
            />
            <stop
              offset="100%"
              stopColor={theme.palette.primary.main}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        {ys.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke={theme.palette.divider}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 10}
              y={y(v) + 4}
              textAnchor="end"
              fontSize="11"
              fill={theme.palette.text.secondary}
            >
              {oneDec.format(v)}
            </text>
          </g>
        ))}
        {/* Baseline axis */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
          stroke={theme.palette.text.secondary}
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        {points.length ? (
          <>
            <polygon points={area} fill={`url(#${gradientId})`} />
            <polyline
              points={line}
              fill="none"
              stroke={theme.palette.primary.main}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {hover !== null && points[hover] ? (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={y(0)}
                stroke={theme.palette.primary.main}
                strokeOpacity="0.35"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ) : null}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={hover === i ? 8.5 : 6.5}
                fill={
                  hover === i
                    ? theme.palette.primary.main
                    : theme.palette.background.paper
                }
                stroke={theme.palette.primary.main}
                strokeWidth="2.5"
                style={{ transition: "r 120ms ease" }}
              />
            ))}
            {points.map((p, i) =>
              i % step === 0 || i === points.length - 1 ? (
                <text
                  key={i}
                  x={x(i)}
                  y={H - 14}
                  textAnchor="middle"
                  fontSize="12"
                  fill={theme.palette.text.secondary}
                >
                  {p.label}
                </text>
              ) : null,
            )}
          </>
        ) : null}
      </svg>
    </Box>
  );
}

/** CDS red/pink bar chart: rank-faded red bars, value labels, gridlines,
 * rotated x labels when space is tight, hover tooltip. */
export function BarChart({
  bars,
  formatValue,
}: {
  bars: Point[];
  formatValue?: (v: number) => string;
}) {
  const theme = useTheme();
  const { int } = useNumberFmt();
  const fmt = formatValue ?? ((v: number) => int.format(v));
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...bars.map((b) => b.value), 1);
  const ys = ticks(max);
  const yMax = ys[ys.length - 1];
  const slot = innerW() / Math.max(bars.length, 1);
  const barW = Math.min(74, slot * 0.5);
  const step = labelStep(bars.length);
  const y = (v: number) => PAD.top + innerH() - (v / yMax) * innerH();
  // Rotate labels once slots get tight rather than truncating readable names.
  const rotate = slot < 78;
  // Truncation budget scales with the actual slot width — labels are only cut
  // when their slot genuinely cannot fit them (~6.5px per 11.5px char).
  const maxLabelChars = Math.max(6, Math.floor((slot * 0.92) / 6.5));

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!bars.length) return;
    const px = svgX(e);
    const i = Math.floor((px - PAD.left) / slot);
    setHover(i >= 0 && i < bars.length ? i : null);
  };

  return (
    <Box sx={{ position: "relative", direction: "ltr" }}>
      {hover !== null && bars[hover] ? (
        <ChartTooltip
          x={PAD.left + slot * hover + slot / 2}
          y={y(bars[hover].value)}
          label={bars[hover].label}
          value={fmt(bars[hover].value)}
        />
      ) : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        style={{ display: "block" }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ys.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke={theme.palette.divider}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 10}
              y={y(v) + 4}
              textAnchor="end"
              fontSize="11"
              fill={theme.palette.text.secondary}
            >
              {int.format(v)}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
          stroke={theme.palette.text.secondary}
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        {bars.map((b, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          // Rank-fade: first bars full CDS red, trailing bars fade to pink.
          const opacity = Math.max(0.42, 1 - i * 0.16);
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
              {/* Zero counts render no bar at all — a stub sliver would read
                  as a tiny non-zero value. */}
              {b.value > 0 ? (
                <rect
                  x={cx - barW / 2}
                  y={y(b.value)}
                  width={barW}
                  height={y(0) - y(b.value)}
                  rx="7"
                  fill={theme.palette.primary.main}
                  opacity={opacity}
                  style={{ transition: "opacity 120ms ease" }}
                />
              ) : null}
              <text
                x={cx}
                y={y(b.value) - 9}
                textAnchor="middle"
                fontSize="12.5"
                fontWeight="700"
                fill={
                  b.value > 0
                    ? theme.palette.text.primary
                    : theme.palette.text.secondary
                }
              >
                {int.format(b.value)}
              </text>
              {i % step === 0 || i === bars.length - 1 ? (
                <text
                  x={cx}
                  y={rotate ? H - 22 : H - 14}
                  textAnchor={rotate ? "end" : "middle"}
                  fontSize="11.5"
                  fill={theme.palette.text.secondary}
                  transform={rotate ? `rotate(-28 ${cx} ${H - 22})` : undefined}
                >
                  {b.label.length > maxLabelChars
                    ? `${b.label.slice(0, maxLabelChars - 1)}…`
                    : b.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
