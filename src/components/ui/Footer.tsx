import Link from "next/link";
import NewsletterSignup from "@/components/NewsletterSignup";
import { getLastUpdate } from "@/lib/footer";

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "DÁTA",
    links: [
      { href: "/prieskumy", label: "Prieskumy" },
      { href: "/predikcia", label: "Predikcia" },
      { href: "/poslanci", label: "Poslanci" },
    ],
  },
  {
    heading: "NÁSTROJE",
    links: [
      { href: "/volebny-kalkulator", label: "Volebný kalkulator" },
      { href: "/koalicny-simulator", label: "Koaličný simulátor" },
      { href: "/tipovanie", label: "Tipovanie" },
    ],
  },
  {
    heading: "INFO",
    links: [
      { href: "/povolebne-plany", label: "Povolebné plány" },
      { href: "/metodika", label: "Metodika" },
      { href: "/metodika#zdroje-dat", label: "Zdroje dát" },
    ],
  },
  {
    heading: "PRÁVNE",
    links: [
      { href: "/sukromie", label: "Ochrana súkromia" },
      { href: "/podmienky", label: "Podmienky" },
      { href: "/impressum", label: "Impressum" },
    ],
  },
];

export default async function Footer() {
  const lastUpdate = await getLastUpdate();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 bg-footer">
      <div className="max-w-content mx-auto px-6 py-12">
        {/* Top: brand + newsletter */}
        <div className="grid gap-8 md:grid-cols-[1fr_minmax(0,420px)] md:items-start pb-8 border-b border-white/15">
          <div>
            <p className="text-xl font-bold text-white leading-none">VolímTo</p>
            <p className="mt-2 max-w-xs text-body-sm text-white/60">
              Slovenská politika v dátach.
            </p>
            <div className="flex gap-4 mt-4">
              <a
                href="#"
                aria-label="X (Twitter)"
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="GitHub"
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.97 3.22 9.18 7.69 10.67.56.1.77-.24.77-.54 0-.27-.01-.97-.02-1.9-3.13.68-3.79-1.51-3.79-1.51-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.55 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.97 0 0 .94-.3 3.09 1.15.9-.25 1.86-.37 2.82-.38.96.01 1.92.13 2.82.38 2.15-1.45 3.09-1.15 3.09-1.15.61 1.54.23 2.69.11 2.97.72.79 1.16 1.79 1.16 3.02 0 4.31-2.63 5.27-5.14 5.54.4.34.76 1.02.76 2.06 0 1.49-.01 2.69-.01 3.05 0 .3.2.65.78.54 4.47-1.49 7.69-5.7 7.69-10.67C23.25 5.48 18.27.5 12 .5z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="w-full">
            <p className="mb-3 text-label text-white/50">
              NEWSLETTER
            </p>
            <NewsletterSignup source="footer" compact inverted />
            <p className="mt-2 text-caption text-white/40">Týždenný prehľad. Bez spamu.</p>
          </div>
        </div>

        {/* Sitemap columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 py-8 border-b border-white/15">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="mb-4 text-label text-white/50">
                {col.heading}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-6">
          <p className="text-xs text-white/50">
            © {year} VolímTo
            {lastUpdate && (
              <>
                {" · "}
                <span>Posledná aktualizácia: {lastUpdate}</span>
              </>
            )}
          </p>
          <p className="text-caption text-white/40">
            Dáta z verejne dostupných prieskumov.
          </p>
        </div>
      </div>
    </footer>
  );
}
