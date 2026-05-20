import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_PRESET_ID,
  THEME_PRESETS,
  derivedVars,
  getPreset,
} from "./themes";
import { hexToHsl, hslToCssTriplet, type Hsl } from "./colorUtils";

const STORAGE_KEY = "inspect-page.landing-theme";

interface StoredTheme {
  presetId: string;
  customAccent?: Hsl;
}

interface ThemeContextValue {
  presetId: string;
  customAccent: Hsl | null;
  setPreset: (id: string) => void;
  setCustomAccentHex: (hex: string) => void;
  clearCustomAccent: () => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): StoredTheme {
  if (typeof window === "undefined") return { presetId: DEFAULT_PRESET_ID };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { presetId: DEFAULT_PRESET_ID };
    const parsed = JSON.parse(raw) as StoredTheme;
    if (!parsed.presetId) return { presetId: DEFAULT_PRESET_ID };
    return parsed;
  } catch {
    return { presetId: DEFAULT_PRESET_ID };
  }
}

function writeStored(value: StoredTheme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore quota / privacy mode errors.
  }
}

function applyTheme(presetId: string, customAccent: Hsl | null): void {
  const preset = getPreset(presetId);
  const root = document.documentElement;
  for (const [name, value] of Object.entries(preset.vars)) {
    root.style.setProperty(name, value);
  }
  const primary = customAccent
    ? hslToCssTriplet(customAccent)
    : preset.vars["--primary"];
  const glow = customAccent
    ? hslToCssTriplet({ ...customAccent, l: Math.min(95, customAccent.l + 10) })
    : preset.vars["--primary-glow"];
  if (customAccent) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-glow", glow);
    root.style.setProperty("--ring", primary);
  }
  for (const [name, value] of Object.entries(derivedVars(primary, glow))) {
    root.style.setProperty(name, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID);
  const [customAccent, setCustomAccent] = useState<Hsl | null>(null);

  // Initial hydrate from localStorage.
  useEffect(() => {
    const stored = readStored();
    setPresetId(stored.presetId);
    setCustomAccent(stored.customAccent ?? null);
  }, []);

  // Re-apply on any change.
  useEffect(() => {
    applyTheme(presetId, customAccent);
  }, [presetId, customAccent]);

  const setPreset = useCallback((id: string) => {
    setPresetId(id);
    setCustomAccent(null);
    writeStored({ presetId: id });
  }, []);

  const setCustomAccentHex = useCallback(
    (hex: string) => {
      const hsl = hexToHsl(hex);
      setCustomAccent(hsl);
      writeStored({ presetId, customAccent: hsl });
    },
    [presetId],
  );

  const clearCustomAccent = useCallback(() => {
    setCustomAccent(null);
    writeStored({ presetId });
  }, [presetId]);

  const resetToDefault = useCallback(() => {
    setPresetId(DEFAULT_PRESET_ID);
    setCustomAccent(null);
    writeStored({ presetId: DEFAULT_PRESET_ID });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      presetId,
      customAccent,
      setPreset,
      setCustomAccentHex,
      clearCustomAccent,
      resetToDefault,
    }),
    [presetId, customAccent, setPreset, setCustomAccentHex, clearCustomAccent, resetToDefault],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}

export { THEME_PRESETS };