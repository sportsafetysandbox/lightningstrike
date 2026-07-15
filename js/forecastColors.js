// Maps NEA's 2-hr Nowcast forecast text to a display colour and coarse category.
// NEA's vocabulary mixes sky-condition terms (Fair, Partly Cloudy, Cloudy, Hazy,
// Windy, Mist, Fog) with precipitation terms (Rain, Showers, Thundery Showers) —
// a "Cloudy" area is not necessarily a "Rain" area, which is the whole point of
// layering this on top of the lightning/rain data. Order matters below: check the
// more specific/severe terms first.
const RULES = [
  { test: /thundery/i, category: "rain", color: "#7c3aed", label: "Thundery" },
  { test: /heavy (rain|showers?)/i, category: "rain", color: "#1d4ed8", label: "Heavy Rain" },
  { test: /(rain|showers?)/i, category: "rain", color: "#3b82f6", label: "Rain" },
  { test: /overcast|^cloudy/i, category: "cloud", color: "#475569", label: "Cloudy" },
  { test: /partly cloudy/i, category: "cloud", color: "#94a3b8", label: "Partly Cloudy" },
  { test: /hazy/i, category: "cloud", color: "#a3a380", label: "Hazy" },
  { test: /mist|fog/i, category: "cloud", color: "#cbd5e1", label: "Mist / Fog" },
  { test: /windy/i, category: "cloud", color: "#7dd3fc", label: "Windy" },
  { test: /fair/i, category: "clear", color: "#facc15", label: "Fair" },
];

const FALLBACK = { category: "unknown", color: "#64748b", label: "Unknown" };

export function classifyForecast(text) {
  if (!text) return { ...FALLBACK, text: text ?? "" };
  const rule = RULES.find((r) => r.test.test(text));
  return { ...(rule ?? FALLBACK), text };
}

export const FORECAST_LEGEND = [
  { label: "Fair", color: "#facc15" },
  { label: "Partly Cloudy", color: "#94a3b8" },
  { label: "Cloudy", color: "#475569" },
  { label: "Hazy / Mist", color: "#a3a380" },
  { label: "Rain / Showers", color: "#3b82f6" },
  { label: "Thundery Showers", color: "#7c3aed" },
];
