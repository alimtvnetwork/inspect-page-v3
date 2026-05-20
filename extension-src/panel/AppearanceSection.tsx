/**
 * Appearance tab inside the extension Settings popover. Lets the user pick a
 * theme preset (Dark Mint, Riseup Asia, Midnight Indigo, Emerald) or set a
 * fully custom accent color. Persisted to `chrome.storage.local`.
 */
import { useCallback } from "react";
import {
  DEFAULT_EXT_PRESET_ID,
  EXT_THEME_PRESETS,
  type StoredExtTheme,
} from "./extensionThemes";

interface AppearanceSectionProps {
  value: StoredExtTheme;
  onChange: (next: StoredExtTheme) => void;
}

export function AppearanceSection({
  value,
  onChange,
}: AppearanceSectionProps): JSX.Element {
  const setPreset = useCallback(
    (id: string) => onChange({ presetId: id }),
    [onChange],
  );
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
      <div className="lpe-appearance-label">Theme preset</div>
      <div className="lpe-appearance-grid" role="radiogroup" aria-label="Theme preset">
        {EXT_THEME_PRESETS.map((preset) => {
          const selected = preset.id === value.presetId && !value.customAccent;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className="lpe-appearance-card"
              data-selected={selected ? "true" : "false"}
              onClick={() => setPreset(preset.id)}
            >
              <span
                aria-hidden
                className="lpe-appearance-swatch"
                style={{ background: preset.swatch }}
              />
              <span className="lpe-appearance-name">{preset.name}</span>
              {selected ? <span className="lpe-appearance-check">✓</span> : null}
            </button>
          );
        })}
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
        Overrides the preset's accent. Reset returns to Dark Mint.
      </p>
    </div>
  );
}