import type { Metadata } from "next";
import SectionHeading from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "API Dokumentácia",
  description: "Dokumentácia VolímTo API pre novinárov, výskumníkov a vývojárov.",
};

export default function ApiDocsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SectionHeading title="API Dokumentácia" subtitle="REST API s osobným API kľúčom" />

      <div className="space-y-8 text-text">
        <section>
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Základná URL</h2>
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 border border-divider font-mono text-sm">
            https://volimto.sk/api/v1
          </div>
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Autentifikácia</h2>
          <p className="text-sm text-text/70 mb-3">
            Verejné API vyžaduje API kľúč. Kľúč si vytvoríte po prihlásení na stránke{" "}
            <a href="/api-pristup" className="text-ink underline underline-offset-2">API prístup</a>.
            Bezplatný limit je 100 požiadaviek denne.
          </p>
          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 border border-divider font-mono text-xs whitespace-pre">{`Authorization: Bearer vt_...`}</div>
          <p className="text-xs text-text/60 mt-2">
            Alternatívne je možné poslať kľúč ako query parameter <code>key</code>, odporúčaný je však HTTP header.
          </p>
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Endpointy</h2>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 font-mono">GET</span>
                <code className="text-sm font-mono">/api/v1/polls</code>
              </div>
              <p className="text-sm text-text/70 mb-2">
                Vráti zoznam volebných prieskumov s výsledkami strán.
              </p>
              <p className="text-xs text-text/60 mb-3">
                Parametre: <code>limit</code> 1-50, predvolene 10; <code>partyId</code> pre filtrovanie výsledkov konkrétnej strany.
              </p>
              <div className="bg-zinc-100 dark:bg-zinc-800 p-4 border border-divider font-mono text-xs whitespace-pre">{`{
  "polls": [
    {
      "id": 1,
      "agency": "AKO",
      "publishedDate": "2026-03-15",
      "results": {
        "ps": 23.4,
        "smer-sd": 21.1
      }
    }
  ],
  "generatedAt": "2026-06-09T10:00:00.000Z"
}`}</div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 font-mono">GET</span>
                <code className="text-sm font-mono">/api/v1/leaderboard</code>
              </div>
              <p className="text-sm text-text/70">Vráti rebríček tipovateľov s celkovým skóre.</p>
            </div>
          </div>
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Podmienky použitia</h2>
          <p className="text-sm">
            API je dostupné pre novinárov, výskumníkov a vývojárov. Prosíme o uvedenie zdroja{" "}
            <strong>volimto.sk</strong> pri publikovaní. Pre komerčné použitie nás kontaktujte na{" "}
            <a href="mailto:redakcia@volimto.sk" className="text-ink underline underline-offset-2">
              redakcia@volimto.sk
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
