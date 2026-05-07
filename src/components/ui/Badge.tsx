import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "success" | "danger" | "accent";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface text-muted border border-border",
  success: "bg-success-bg text-success border border-success-border",
  danger: "bg-danger-bg text-danger border border-danger-border",
  accent: "bg-accent-soft text-accent border border-accent-border",
};

export default function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-micro font-bold leading-none",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
