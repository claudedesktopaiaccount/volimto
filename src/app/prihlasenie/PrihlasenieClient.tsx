"use client";

interface Props {
  nextPath?: string;
}

export default function PrihlasenieClient({ nextPath }: Props) {
  const googleHref = `/api/auth/google/start?next=${encodeURIComponent(nextPath ?? "/profil")}`;

  return (
    <div className="min-h-[70vh] flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-2xl font-semibold text-ink mb-1">Prihlásenie</h1>
        <p className="text-sm text-text mb-8">Vstup do VolímTo je dostupný iba cez Google účet.</p>

        <a
          href={googleHref}
          className="flex w-full items-center justify-center border border-divider bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-hover"
        >
          Pokračovať cez Google
        </a>
      </div>
    </div>
  );
}
