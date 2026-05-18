import { cn } from "@/lib/utils";

/**
 * Decorative floating blue circles that mirror the Blueprint reference art.
 * Pure presentational; absolutely positioned, pointer-events-none, behind content.
 * Drop inside a `relative` parent.
 */
export function BlueprintBackdrop({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "hero" | "subtle";
}): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      {variant !== "subtle" && (
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/80 blur-[2px] opacity-90" />
      )}
      <div className="absolute left-1/3 -top-10 h-20 w-20 rounded-full bg-primary opacity-95" />
      <div className="absolute left-20 top-72 h-10 w-10 rounded-full bg-primary/70" />
      {variant === "hero" && (
        <div className="absolute right-10 top-40 h-14 w-14 rounded-full bg-primary/70" />
      )}
      <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-primary opacity-95" />
      <div className="absolute right-1/3 bottom-20 h-8 w-8 rounded-full bg-primary/60" />
    </div>
  );
}