/**
 * Extension theme presets for the popup + floating panel.
 *
 * Default preset (`dark-mint`) preserves the locked dark-mint look. Other
 * presets override the `--lpe-*` design tokens and the popup/floating
 * background gradient via a `data-lpe-preset` attribute on `.lpe-root`.
 *
 * Persistence: `chrome.storage.local` (falls back to `localStorage`) so the
 * choice survives popup close and syncs with the floating panel on the same
 * profile.
 */

export interface ExtensionThemePreset {
  id: string;
  name: string;
  swatch: string;
  vars: Record<string, string>;
  /** Optional background override for [data-lpe-surface="popup"|"floating"]. */
  background: string;
}

export const EXT_THEME_PRESETS: ExtensionThemePreset[] = [
  {
    id: "dark-mint",
    name: "Dark Mint (default)",
    swatch: "#2DD4A8",
    vars: {
      "--lpe-bg": "#0B0F0E",
      "--lpe-fg": "#F5FFFA",
      "--lpe-muted": "#94A3B8",
      "--lpe-surface": "#111715",
      "--lpe-surface-2": "#161E1B",
      "--lpe-border": "rgba(255, 255, 255, 0.06)",
      "--lpe-accent": "#2DD4A8",
      "--lpe-accent-hover": "#73FFB8",
      "--lpe-accent-fg": "#06241C",
    },
    background:
      "radial-gradient(120% 80% at 20% 0%, rgba(45,212,168,0.10) 0%, transparent 55%)," +
      "radial-gradient(120% 80% at 100% 100%, rgba(92,225,230,0.08) 0%, transparent 55%)," +
      "#0B0F0E",
  },
  {
    id: "riseup-asia",
    name: "Riseup Asia",
    swatch: "#F59E0B",
    vars: {
      "--lpe-bg": "#0A0A0A",
      "--lpe-fg": "#FAF7F0",
      "--lpe-muted": "#A8A29E",
      "--lpe-surface": "#121212",
      "--lpe-surface-2": "#1A1A1A",
      "--lpe-border": "rgba(245, 158, 11, 0.18)",
      "--lpe-accent": "#F59E0B",
      "--lpe-accent-hover": "#FBBF24",
      "--lpe-accent-fg": "#1A1206",
    },
    background:
      "radial-gradient(120% 80% at 20% 0%, rgba(245,158,11,0.12) 0%, transparent 55%)," +
      "radial-gradient(120% 80% at 100% 100%, rgba(251,191,36,0.06) 0%, transparent 55%)," +
      "#0A0A0A",
  },
  {
    id: "midnight-indigo",
    name: "Midnight Indigo",
    swatch: "#818CF8",
    vars: {
      "--lpe-bg": "#0B0F1F",
      "--lpe-fg": "#EEF0FF",
      "--lpe-muted": "#94A3B8",
      "--lpe-surface": "#121633",
      "--lpe-surface-2": "#171C40",
      "--lpe-border": "rgba(129, 140, 248, 0.18)",
      "--lpe-accent": "#818CF8",
      "--lpe-accent-hover": "#A5B4FC",
      "--lpe-accent-fg": "#0B0F1F",
    },
    background:
      "radial-gradient(120% 80% at 20% 0%, rgba(129,140,248,0.14) 0%, transparent 55%)," +
      "radial-gradient(120% 80% at 100% 100%, rgba(99,102,241,0.08) 0%, transparent 55%)," +
      "#0B0F1F",
  },
  {
    id: "emerald",
    name: "Emerald Light",
    swatch: "#10B981",
    vars: {
      "--lpe-bg": "#F8FBF9",
      "--lpe-fg": "#0F2419",
      "--lpe-muted": "#4B6358",
      "--lpe-surface": "#FFFFFF",
      "--lpe-surface-2": "#EEF7F1",
      "--lpe-border": "rgba(16, 185, 129, 0.18)",
      "--lpe-accent": "#10B981",
      "--lpe-accent-hover": "#34D399",
      "--lpe-accent-fg": "#FFFFFF",
    },
    background:
      "radial-gradient(120% 80% at 20% 0%, rgba(16,185,129,0.10) 0%, transparent 55%)," +
      "radial-gradient(120% 80% at 100% 100%, rgba(110,231,183,0.10) 0%, transparent 55%)," +
      "#F8FBF9",
  },
];

export const DEFAULT_EXT_PRESET_ID = "dark-mint";
const STORAGE_KEY = "inspect-page.ext-theme";

export interface StoredExtTheme {
  presetId: string;
  /** Optional custom accent HEX that overrides the preset's accent. */
  customAccent?: string;
}

export function getPreset(id: string): ExtensionThemePreset {
  return (
    EXT_THEME_PRESETS.find((p) => p.id === id) ?? EXT_THEME_PRESETS[0]
  );
}

/** Apply a preset (+ optional custom accent) to one extension panel root. */
export function applyExtensionThemeToElement(root: HTMLElement, stored: StoredExtTheme): void {
  const preset = getPreset(stored.presetId);
  root.setAttribute("data-lpe-preset", preset.id);
  for (const [name, value] of Object.entries(preset.vars)) {
    root.style.setProperty(name, value);
  }
  root.style.setProperty("--lpe-panel-bg", preset.background);
  if (stored.customAccent) {
    root.style.setProperty("--lpe-accent", stored.customAccent);
    root.style.setProperty("--lpe-accent-hover", stored.customAccent);
    root.style.setProperty("--lpe-panel-bg", preset.background.replaceAll(preset.swatch, stored.customAccent));
  }
  root.style.background = "var(--lpe-panel-bg)";
}

/**
 * Apply a preset (+ optional custom accent) to every `.lpe-root` mounted in
 * the current document, including the open Shadow DOM floating panel.
 */
export function applyExtensionTheme(stored: StoredExtTheme): void {
  if (typeof document === "undefined") return;
  const roots = Array.from(document.querySelectorAll<HTMLElement>(".lpe-root"));
  const floatingHost = document.getElementById("inspect-page-panel-host");
  floatingHost?.shadowRoot
    ?.querySelectorAll<HTMLElement>(".lpe-root")
    .forEach((root) => roots.push(root));
  roots.forEach((root) => applyExtensionThemeToElement(root, stored));
}

export async function loadStoredExtTheme(): Promise<StoredExtTheme> {
  const fallback: StoredExtTheme = { presetId: DEFAULT_EXT_PRESET_ID };
  try {
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      const out = await chrome.storage.local.get(STORAGE_KEY);
      const v = out?.[STORAGE_KEY] as StoredExtTheme | undefined;
      if (v?.presetId) return v;
    }
  } catch {
    // ignore
  }
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredExtTheme;
      if (parsed?.presetId) return parsed;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export async function saveStoredExtTheme(value: StoredExtTheme): Promise<void> {
  try {
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: value });
    }
  } catch {
    // ignore
  }
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** Listen for theme changes from other surfaces (popup ↔ floating). */
export function subscribeExtTheme(cb: (v: StoredExtTheme) => void): () => void {
  if (typeof chrome === "undefined" || !chrome?.storage?.onChanged) {
    return () => {};
  }
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== "local") return;
    const c = changes[STORAGE_KEY];
    if (!c) return;
    const v = c.newValue as StoredExtTheme | undefined;
    if (v?.presetId) cb(v);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}