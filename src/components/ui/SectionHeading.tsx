interface SectionHeadingProps {
  title: string;
  subtitle?: string;
}

export default function SectionHeading({ title, subtitle }: SectionHeadingProps) {
  return (
    <div className="mb-5 border-b border-divider pb-4">
      <h2 className="font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-text/60">
          {subtitle}
        </p>
      )}
    </div>
  );
}
