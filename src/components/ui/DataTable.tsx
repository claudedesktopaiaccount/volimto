import type { TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function DataTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function DataTh({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("py-2 px-2 text-xs font-semibold uppercase tracking-wide text-ink", className)}
      {...props}
    />
  );
}

export function DataTd({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("py-2 px-2 text-xs text-text", className)} {...props} />;
}
