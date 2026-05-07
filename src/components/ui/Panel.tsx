import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type PanelPadding = "none" | "sm" | "md" | "lg";
type PanelVariant = "default" | "subtle";

const paddingClasses: Record<PanelPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

const variantClasses: Record<PanelVariant, string> = {
  default: "bg-card border border-border",
  subtle: "bg-subtle border border-border",
};

export default function Panel({
  variant = "default",
  padding = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: PanelVariant;
  padding?: PanelPadding;
}) {
  return (
    <div
      className={cn("rounded-panel", variantClasses[variant], paddingClasses[padding], className)}
      {...props}
    />
  );
}
