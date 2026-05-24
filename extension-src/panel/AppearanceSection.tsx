/**
 * Appearance tab inside the extension Settings popover.
 *
 * v2.7.6 — the extension theme is **locked to Dark Mint** (memory:
 * `mem://design/extension-theme`). The preset switcher has been removed; the
 * only knob exposed to the user is an optional custom accent in the cool
 * (green / teal / blue) range. Reset returns to the locked Dark Mint accent.
 */
import { useCallback } from "react";
import {
  DEFAULT_EXT_PRESET_ID,
  EXT_THEME_PRESETS,
  type StoredExtTheme,
} from "./extension-themes";

interface AppearanceSectionProps {
  value: StoredExtTheme;
  onChange: (next: StoredExtTheme) => void;
}

export function AppearanceSection({
  value,
  onChange,
}: AppearanceSectionProps): JSX.Element {
  const setCustomAccent = useCallback(
    (hex: string) => onChange({ presetId: value.presetId, customAccent: hex }),
    [onChange, value.presetId],
  );
  const reset = useCallback(
    () => onChange({ presetId: DEFAULT_EXT_PRESET_ID }),
    [onChange],
  );

  const accent =
    value.customAccent ??
    EXT_THEME_PRESETS.find((p) => p.id === value.presetId)?.swatch ??
    "#2DD4A8";

  return (
    <div className="lpe-appearance">
      <div className="lpe-appearance-label">Theme</div>
      <div className="lpe-appearance-locked">
        <span aria-hidden className="lpe-appearance-swatch" style={{ background: "#2DD4A8" }} />
        <span className="lpe-appearance-name">Dark Mint</span>
        <span className="lpe-appearance-locked-tag">Locked</span>
      </div>

      <div className="lpe-appearance-label" style={{ marginTop: 14 }}>
        Custom accent color
      </div>
      <div className="lpe-appearance-color">
        <input
          type="color"
          value={accent}
          onChange={(e) => setCustomAccent(e.target.value)}
          aria-label="Custom accent color"
        />
        <span className="lpe-appearance-hex">{accent.toUpperCase()}</span>
        <button
          type="button"
          className="lpe-appearance-reset"
          onClick={reset}
        >
          Reset
        </button>
      </div>
      <p className="lpe-appearance-hint">
        Pick a custom accent in the cool (green / teal / blue) range. Warm
        accents are rejected so the panel stays on-brand. Reset returns to
        the locked Dark Mint accent.
      </p>
    </div>
  );
}