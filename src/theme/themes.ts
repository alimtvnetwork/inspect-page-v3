/**
 * Landing-site theme presets. Each preset is a flat map of CSS variable name →
 * value, applied to `document.documentElement` by the ThemeProvider.
 *
 * Only the marketing landing site uses these tokens. The Chrome extension
 * popup + floating panel keep their locked dark-mint theme.
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** Single representative swatch used by the switcher UI. */
  swatch: string;
  /** Bare HSL triplet strings, e.g. "221 100% 59%". */
  vars: Record<string, string>;
}

const blueprintVars: Record<string, string> = {
  "--background": "0 0% 98%",
  "--foreground": "222 15% 12%",
  "--card": "0 0% 100%",
  "--card-foreground": "222 15% 12%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "222 15% 12%",
  "--primary": "221 100% 59%",
  "--primary-foreground": "0 0% 100%",
  "--primary-glow": "221 100% 70%",
  "--primary-soft": "221 100% 92%",
  "--secondary": "220 30% 96%",
  "--secondary-foreground": "222 15% 12%",
  "--muted": "220 30% 96%",
  "--muted-foreground": "222 10% 40%",
  "--accent": "221 100% 92%",
  "--accent-foreground": "221 80% 30%",
  "--border": "220 20% 90%",
  "--input": "220 20% 90%",
  "--ring": "221 100% 59%",
};

const riseupAsiaVars: Record<string, string> = {
  "--background": "0 0% 4%",
  "--foreground": "40 30% 96%",
  "--card": "0 0% 7%",
  "--card-foreground": "40 30% 96%",
  "--popover": "0 0% 7%",
  "--popover-foreground": "40 30% 96%",
  "--primary": "38 92% 50%",
  "--primary-foreground": "0 0% 6%",
  "--primary-glow": "38 95% 60%",
  "--primary-soft": "38 60% 14%",
  "--secondary": "0 0% 12%",
  "--secondary-foreground": "40 30% 96%",
  "--muted": "0 0% 12%",
  "--muted-foreground": "40 10% 70%",
  "--accent": "38 60% 14%",
  "--accent-foreground": "38 95% 70%",
  "--border": "0 0% 16%",
  "--input": "0 0% 16%",
  "--ring": "38 92% 50%",
};

const midnightIndigoVars: Record<string, string> = {
  "--background": "240 30% 7%",
  "--foreground": "230 30% 96%",
  "--card": "240 30% 11%",
  "--card-foreground": "230 30% 96%",
  "--popover": "240 30% 11%",
  "--popover-foreground": "230 30% 96%",
  "--primary": "243 75% 65%",
  "--primary-foreground": "0 0% 100%",
  "--primary-glow": "250 90% 75%",
  "--primary-soft": "243 40% 20%",
  "--secondary": "240 25% 15%",
  "--secondary-foreground": "230 30% 96%",
  "--muted": "240 25% 15%",
  "--muted-foreground": "230 15% 70%",
  "--accent": "243 40% 22%",
  "--accent-foreground": "243 90% 85%",
  "--border": "240 25% 18%",
  "--input": "240 25% 18%",
  "--ring": "243 75% 65%",
};

const emeraldVars: Record<string, string> = {
  "--background": "150 20% 98%",
  "--foreground": "160 25% 12%",
  "--card": "0 0% 100%",
  "--card-foreground": "160 25% 12%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "160 25% 12%",
  "--primary": "160 70% 38%",
  "--primary-foreground": "0 0% 100%",
  "--primary-glow": "160 70% 50%",
  "--primary-soft": "160 60% 90%",
  "--secondary": "150 25% 95%",
  "--secondary-foreground": "160 25% 12%",
  "--muted": "150 25% 95%",
  "--muted-foreground": "160 10% 40%",
  "--accent": "160 60% 90%",
  "--accent-foreground": "160 70% 25%",
  "--border": "150 20% 88%",
  "--input": "150 20% 88%",
  "--ring": "160 70% 38%",
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "blueprint",
    name: "Blueprint",
    description: "Bright royal blue on white. The default.",
    swatch: "#2D6BFF",
    vars: blueprintVars,
  },
  {
    id: "riseup-asia",
    name: "Riseup Asia",
    description: "Dark canvas with amber accents (matches present-v3).",
    swatch: "#F59E0B",
    vars: riseupAsiaVars,
  },
  {
    id: "midnight-indigo",
    name: "Midnight Indigo",
    description: "Deep navy with electric indigo.",
    swatch: "#6366F1",
    vars: midnightIndigoVars,
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Crisp white with emerald accents.",
    swatch: "#10B981",
    vars: emeraldVars,
  },
];

export const DEFAULT_PRESET_ID = "blueprint";

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

/**
 * Build the derived gradient + shadow strings for a given primary HSL triplet
 * (e.g. "221 100% 59%") and glow triplet. Kept here so the provider stays thin.
 */
export function derivedVars(primary: string, glow: string): Record<string, string> {
  return {
    "--gradient-blueprint": `linear-gradient(135deg, hsl(${primary}), hsl(${glow}))`,
    "--gradient-primary": `linear-gradient(135deg, hsl(${primary}), hsl(${glow}))`,
    "--shadow-blueprint": `0 18px 40px -20px hsl(${primary} / 0.35)`,
    "--shadow-glow": `0 18px 40px -20px hsl(${primary} / 0.35)`,
  };
}