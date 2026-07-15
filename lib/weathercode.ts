export interface WeatherInfo {
  label: string;
  icon: string;
}

// WMO weather codes, Open-Meteo convention. Icons are plain unicode glyphs so
// they sit alongside the monospace instrument-panel type without pulling in an
// icon library.
const TABLE: Record<number, WeatherInfo> = {
  0: { label: "Clear sky", icon: "☀" },
  1: { label: "Mainly clear", icon: "🌤" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁" },
  45: { label: "Fog", icon: "🌫" },
  48: { label: "Rime fog", icon: "🌫" },
  51: { label: "Light drizzle", icon: "🌦" },
  53: { label: "Drizzle", icon: "🌦" },
  55: { label: "Dense drizzle", icon: "🌦" },
  61: { label: "Light rain", icon: "🌧" },
  63: { label: "Rain", icon: "🌧" },
  65: { label: "Heavy rain", icon: "🌧" },
  71: { label: "Light snow", icon: "🌨" },
  73: { label: "Snow", icon: "🌨" },
  75: { label: "Heavy snow", icon: "❄" },
  80: { label: "Rain showers", icon: "🌦" },
  81: { label: "Rain showers", icon: "🌧" },
  82: { label: "Violent showers", icon: "⛈" },
  95: { label: "Thunderstorm", icon: "⛈" },
};

const UNKNOWN: WeatherInfo = { label: "Unknown", icon: "❔" };

export function weatherInfo(code: number | null | undefined): WeatherInfo {
  if (code == null) return UNKNOWN;
  return TABLE[code] ?? UNKNOWN;
}
