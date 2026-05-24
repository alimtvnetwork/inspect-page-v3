/**
 * Appearance tab inside the extension Settings popover.
 *
 * v2.7.10 — preset switcher restored. Users can pick between Dark Mint and
 * Riseup Asia, plus a free custom accent. Reset returns to Dark Mint.
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
      <div className="lpe-appearance-label">Theme</div>
      <div className="lpe-appearance-presets" role="radiogroup" aria-label="Theme preset">
        {EXT_THEME_PRESETS.map((p) => {
          const active = p.id === value.presetId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={"lpe-appearance-preset" + (active ? " is-active" : "")}
              onClick={() => setPreset(p.id)}
            >
              <span aria-hidden className="lpe-appearance-swatch" style={{ background: p.swatch }} />
              <span className="lpe-appearance-name">{p.name}</span>
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
        Pick any custom accent color — it overrides the preset accent.
        Reset returns to Dark Mint.
      </p>
    </div>
  );
}