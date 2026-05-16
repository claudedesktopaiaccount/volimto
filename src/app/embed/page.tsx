import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vložiť widget | VolímTo",
  description: "Vložte interaktívny graf volebných prieskumov na vašu stránku.",
  robots: { index: false, follow: false },
};

const SNIPPET_BASIC = `<script
  src="https://volimto.sk/embed.js"
  data-chart="polls"
  data-theme="light"
></script>`;

const SNIPPET_DARK = `<script
  src="https://volimto.sk/embed.js"
  data-chart="polls"
  data-theme="dark"
  data-height="500"
></script>`;

const SNIPPET_FILTERED = `<script
  src="https://volimto.sk/embed.js"
  data-chart="polls"
  data-theme="light"
  data-parties="ps,smer-sd,hlas-sd"
></script>`;

const SNIPPET_IFRAME = `<iframe
  src="https://volimto.sk/embed/polls?theme=light&height=400"
  style="border:none;width:100%;height:432px;display:block;"
  loading="lazy"
  title="VolímTo — volebné prieskumy"
></iframe>`;

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-surface border border-divider overflow-x-auto p-4 text-xs font-mono text-ink leading-relaxed">
      <code>{code}</code>
    </pre>
  );
}

export default function EmbedDocsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-serif text-3xl font-bold text-ink mb-2">
        Vložiť widget VolímTo
      </h1>
      <p className="text-text/70 mb-10 text-sm leading-relaxed">
        Pridajte interaktívny graf volebných prieskumov na vašu webovú stránku
        pomocou jednoduchého kódu. Graf sa automaticky aktualizuje s novými dátami.
      </p>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-bold text-ink mb-1">Základné vloženie</h2>
        <p className="text-sm text-text/60 mb-3">
          Vložte tento kód na ľubovoľné miesto na stránke:
        </p>
        <CodeBlock code={SNIPPET_BASIC} />
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-bold text-ink mb-1">Tmavý motív</h2>
        <p className="text-sm text-text/60 mb-3">
          Pre tmavé stránky použite <code className="font-mono text-xs bg-surface px-1">data-theme=&quot;dark&quot;</code>.
          Môžete tiež nastaviť výšku grafu pomocou <code className="font-mono text-xs bg-surface px-1">data-height</code>:
        </p>
        <CodeBlock code={SNIPPET_DARK} />
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-bold text-ink mb-1">Filtrovanie strán</h2>
        <p className="text-sm text-text/60 mb-3">
          Zobrazíte len vybrané strany pomocou{" "}
          <code className="font-mono text-xs bg-surface px-1">data-parties</code>{" "}
          (zoznam ID strán oddelených čiarkou):
        </p>
        <CodeBlock code={SNIPPET_FILTERED} />
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-bold text-ink mb-1">Priame vloženie cez iframe</h2>
        <p className="text-sm text-text/60 mb-3">
          Ak preferujete priame vloženie bez skriptu:
        </p>
        <CodeBlock code={SNIPPET_IFRAME} />
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-bold text-ink mb-3">Parametre</h2>
        <div className="border border-divider overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="text-left py-2 px-3 font-semibold text-ink text-xs uppercase tracking-wider">Parameter</th>
                <th className="text-left py-2 px-3 font-semibold text-ink text-xs uppercase tracking-wider">Hodnoty</th>
                <th className="text-left py-2 px-3 font-semibold text-ink text-xs uppercase tracking-wider">Predvolená</th>
              </tr>
            </thead>
            <tbody>
              {[
                { param: "data-chart", values: "polls", def: "polls" },
                { param: "data-theme", values: "light | dark", def: "light" },
                { param: "data-height", values: "200 – 800 (px)", def: "400" },
                { param: "data-parties", values: "ps, smer-sd, hlas-sd, …", def: "(všetky)" },
              ].map((row) => (
                <tr key={row.param} className="border-b border-divider">
                  <td className="py-2 px-3 font-mono text-xs text-ink">{row.param}</td>
                  <td className="py-2 px-3 text-xs text-text">{row.values}</td>
                  <td className="py-2 px-3 text-xs text-text/60">{row.def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl font-bold text-ink mb-1">Verejné API</h2>
        <p className="text-sm text-text/60 mb-3">
          Dáta sú dostupné aj cez JSON API:
        </p>
        <CodeBlock code="GET https://volimto.sk/api/v1/polls?limit=10" />
        <p className="text-xs text-text/40 mt-2">
          Odpoveď: <code className="font-mono">{"{ polls, parties, generatedAt }"}</code>.
          Voliteľné parametre: <code className="font-mono">limit</code> (max 50),{" "}
          <code className="font-mono">partyId</code>.
        </p>
      </section>
    </div>
  );
}
