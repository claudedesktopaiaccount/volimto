import { cn } from "@/lib/utils";

export default function PageHeader({
  title,
  eyebrow,
  description,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      {eyebrow && (
        <p className="mb-1 text-label text-muted">
          {eyebrow}
        </p>
      )}
      <h1 className="text-page-title font-extrabold text-ink">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-secondary">
          {description}
        </p>
      )}
    </div>
  );
}
