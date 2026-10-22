import tokens from "../../../../packages/design-tokens/tokens.json";

// Renkler web panelinin koyu temasıyla aynı dosyadan gelir (packages/design-tokens).
type TokenName = keyof typeof tokens.color.dark;

const rgb = (name: TokenName) => tokens.color.dark[name].split(" ").map(Number);

const hex = (name: TokenName) =>
  "#" + rgb(name).map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();

/** Belirteç rengini saydamlıkla verir: tint(Colors.success, 0.15). */
export const tint = (color: string, alpha: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const accent = hex("accent");
const evidence = hex("evidence");
const warn = hex("warn");
const critical = hex("critical");
const line = hex("line");

export const Colors = {
  background: hex("bg"),
  surface: hex("surface"),
  surfaceElevated: hex("surface-2"),
  surfaceGlass: "rgba(255, 255, 255, 0.04)",
  surfaceGlassActive: "rgba(255, 255, 255, 0.08)",

  border: line,
  borderSubtle: tint(line, 0.6),
  borderFocus: accent,

  // Metin için yalnızca ink ve muted var; faint gövde metninde 4,5:1 sınırını geçmiyor.
  textPrimary: hex("ink"),
  textSecondary: hex("muted"),
  textMuted: hex("muted"),
  textInverse: hex("bg"),

  // primary metin, ikon ve çerçeve içindir; düz buton zemini primaryFill (beyaz yazıyla 5,8:1).
  primary: accent,
  primaryFill: hex("accent-fill"),
  primaryGradientStart: hex("accent-fill"),
  primaryGradientEnd: hex("accent-hover"),
  accent: hex("accent-ink"),

  success: evidence,
  successSurface: hex("evidence-soft"),
  successBorder: tint(evidence, 0.35),

  warning: warn,
  warningSurface: hex("warn-soft"),
  warningBorder: tint(warn, 0.35),

  danger: critical,
  dangerSurface: hex("critical-soft"),
  dangerBorder: tint(critical, 0.35),
  error: critical,
  errorSurface: hex("critical-soft"),
  errorBorder: tint(critical, 0.35),

  info: accent,
  infoSurface: hex("accent-soft"),
  infoBorder: tint(accent, 0.35),
};
