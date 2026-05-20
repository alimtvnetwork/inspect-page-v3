import { useState } from "react";
import { Palette, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { THEME_PRESETS, useTheme } from "@/theme/ThemeProvider";
import { hslToHex } from "@/theme/colorUtils";

/**
 * Floating theme-color switcher for the landing site.
 * Lets visitors pick from preset themes or a fully custom accent color.
 */
export function ThemeSwitcher(): JSX.Element {
  const {
    presetId,
    customAccent,
    setPreset,
    setCustomAccentHex,
    resetToDefault,
  } = useTheme();
  const [open, setOpen] = useState(false);

  const currentHex = customAccent
    ? hslToHex(customAccent)
    : THEME_PRESETS.find((p) => p.id === presetId)?.swatch ?? "#2D6BFF";

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            aria-label="Change theme color"
            className="h-12 w-12 rounded-full shadow-lg"
            style={{
              background: "var(--gradient-primary)",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            <Palette className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          className="w-72 p-4"
          sideOffset={12}
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground">
                Pick a preset or set a custom accent color.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Theme presets"
              className="grid grid-cols-2 gap-2"
            >
              {THEME_PRESETS.map((preset) => {
                const selected = preset.id === presetId && !customAccent;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPreset(preset.id)}
                    className={`flex items-center gap-2 rounded-md border p-2 text-left text-xs transition hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring ${
                      selected ? "border-primary bg-accent/40" : "border-border"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-5 w-5 rounded-full border border-border/60"
                      style={{ background: preset.swatch }}
                    />
                    <span className="flex-1 font-medium text-foreground">
                      {preset.name}
                    </span>
                    {selected ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5 border-t border-border pt-3">
              <label
                htmlFor="theme-custom-accent"
                className="text-xs font-medium text-foreground"
              >
                Custom accent color
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="theme-custom-accent"
                  type="color"
                  value={currentHex}
                  onChange={(e) => setCustomAccentHex(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0"
                  aria-label="Custom accent color picker"
                />
                <span className="font-mono text-xs uppercase text-muted-foreground">
                  {currentHex}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Overrides the preset's primary color.
              </p>
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={resetToDefault}
                className="h-8 text-xs"
              >
                <RotateCcw className="mr-1.5 h-3 w-3" />
                Reset to default
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}