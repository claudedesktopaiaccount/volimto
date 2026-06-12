"use client";

import { useMemo, useState } from "react";
import Panel from "@/components/ui/Panel";
import { PARTIES } from "@/lib/parties";
import { calculatePollAgeWeight } from "@/lib/poll-aggregate";
import { allocateSeats } from "@/lib/prediction/dhondt";
import { runSimulationWithOptions, type PartyInput } from "@/lib/prediction/monte-carlo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "#info", label: "Info" },
  { href: "#prieskumy", label: "Prieskumy" },
  { href: "#predikcia", label: "Predikcia" },
  { href: "#mandaty", label: "Mandáty" },
  { href: "#povolebne-plany", label: "Povolebné plány" },
  { href: "#kauzy", label: "Kauzy" },
  { href: "#zdroje-dat", label: "Zdroje dát" },
] as const;

const LAB_PARTY_IDS = [
  "ps",
  "smer-sd",
  "hlas-sd",
  "republika",
  "sas",
  "kdh",
  "sns",
  "slovensko",
  "demokrati",
] as const;

const INITIAL_PERCENTAGES: Record<string, number> = {
  ps: 24.8,
  "smer-sd": 22.3,
  "hlas-sd": 14.1,
  republika: 8.7,
  sas: 6.2,
  kdh: 5.9,
  sns: 5.1,
  slovensko: 4.8,
  demokrati: 3.5,
};

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function formatPct(value: number) {
  return `${value.toFixed(1)} %`;
}

export default function MetodikaClient() {
  const [ageDays, setAgeDays] = useState(30);
  const [stdDev, setStdDev] = useState(2.2);
  const [percentages, setPercentages] = useState<Record<string, number>>(INITIAL_PERCENTAGES);

  const pollWeight = calculatePollAgeWeight(ageDays);

  const labInputs = useMemo<PartyInput[]>(
    () =>
      LAB_PARTY_IDS.map((partyId) => ({
        partyId,
        meanPct: percentages[partyId],
        stdDev,
      })),
    [percentages, stdDev]
  );

  const seatAllocation = useMemo(
    () =>
      allocateSeats(
        labInputs.map((party) => ({
          partyId: party.partyId,
          percentage: party.meanPct,
        }))
      ),
    [labInputs]
  );

  const simulation = useMemo(
    () =>
      runSimulationWithOptions(labInputs, {
        simulations: 900,
        rng: seededRandom(20260610),
      }),
    [labInputs]
  );

  const seatMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of seatAllocation) map[row.partyId] = row.seats;
    return map;
  }, [seatAllocation]);

  const simulationMap = useMemo(() => {
    const map: Record<string, (typeof simulation)[number]> = {};
    for (const row of simulation) map[row.partyId] = row;
    return map;
  }, [simulation]);

  const sortedLabParties = [...LAB_PARTY_IDS].sort(
    (a, b) => percentages[b] - percentages[a]
  );
  const totalSeats = seatAllocation.reduce((sum, row) => sum + row.seats, 0);

  function updatePartyPct(partyId: string, nextValue: number) {
    setPercentages((prev) => ({
      ...prev,
      [partyId]: Math.round(nextValue * 10) / 10,
    }));
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav
            aria-label="Sekcie metodiky"
            className="sticky top-[76px] rounded-lg bg-footer px-5 py-5 text-white"
          >
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
              Info
            </p>
            <div className="space-y-3">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block text-sm font-medium text-white/82 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        </aside>

        <main className="min-w-0">
          <section id="info" className="mb-10">
            <p className="text-label text-muted">Metodika VolímTo</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Ako z verejných dát skladáme čitateľný obraz slovenskej politiky
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-secondary">
              VolímTo kombinuje prieskumy, programy strán, otvorené dáta a verejne
              doložené zdroje. Cieľom nie je povedať, koho voliť, ani predpovedať
              budúcnosť s istotou. Cieľom je ukázať, z čoho výpočty vychádzajú,
              aké majú limity a kde sa dá výsledok overiť.
            </p>

            <div className="mt-6 grid gap-px overflow-hidden rounded-lg bg-border md:grid-cols-4">
              <Metric label="Prieskumy" value="365 dní" detail="pracovné okno modelu" />
              <Metric label="Váženie" value="30 dní" detail="približný polčas váhy" />
              <Metric label="Predikcia" value="10 000" detail="produkčných simulácií" />
              <Metric label="Mandáty" value="150" detail="kresiel cez D'Hondt" />
            </div>
          </section>

          <section id="prieskumy" className="mb-10">
            <SectionTitle
              eyebrow="Prieskumy"
              title="Najnovšie dáta majú väčšiu váhu ako staršie"
              text="Prieskumy načítavame z databázy, pri výpadku vieme padnúť späť na verejný scrape Wikipédie. Model berie posledných 365 dní, a keď také dáta nie sú, použije všetko dostupné namiesto prázdnej predikcie."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <ExplainerCard
                step="01"
                title="Zber"
                text="Každý riadok prieskumu obsahuje agentúru, dátum publikovania, vzorku a percentá strán."
              />
              <ExplainerCard
                step="02"
                title="Čistenie"
                text="Názvy strán mapujeme na interné ID, percentá normalizujeme a ignorujeme nečitateľné riadky."
              />
              <ExplainerCard
                step="03"
                title="Agregácia"
                text="Pre každú stranu počítame vážený priemer. Váha je exp(-0.023 * počet dní)."
              />
            </div>
          </section>

          <section id="predikcia" className="mb-10">
            <SectionTitle
              eyebrow="Dátový lab"
              title="Vyskúšajte, ako sa mení váha, neistota a rozdelenie mandátov"
              text="Tento lab je zjednodušené interaktívne vysvetlenie. Produkčná predikcia používa rovnaké pravidlá, ale beží s 10 000 simuláciami a aktuálnymi agregovanými dátami."
            />

            <Panel padding="lg" className="overflow-hidden">
              <div className="grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
                <div className="space-y-5">
                  <ControlBlock
                    label="Vek prieskumu"
                    value={`${ageDays} dní`}
                    help={`Aktuálna váha: ${(pollWeight * 100).toFixed(0)} %`}
                  >
                    <input
                      aria-label="Vek prieskumu v dňoch"
                      type="range"
                      min={0}
                      max={180}
                      step={1}
                      value={ageDays}
                      onChange={(event) => setAgeDays(Number(event.target.value))}
                      className="w-full accent-ink"
                    />
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-subtle">
                      <div
                        data-testid="poll-weight-bar"
                        className="h-full rounded-full bg-accent transition-[width]"
                        style={{ width: `${Math.max(2, pollWeight * 100)}%` }}
                      />
                    </div>
                  </ControlBlock>

                  <ControlBlock
                    label="Neistota simulácie"
                    value={`±${stdDev.toFixed(1)} bodu`}
                    help="Vyššia neistota rozširuje intervaly a mení šance na parlament."
                  >
                    <input
                      aria-label="Neistota modelu"
                      type="range"
                      min={1.5}
                      max={4}
                      step={0.1}
                      value={stdDev}
                      onChange={(event) => setStdDev(Number(event.target.value))}
                      className="w-full accent-ink"
                    />
                  </ControlBlock>

                  <div className="rounded-lg border border-border bg-subtle p-4">
                    <p className="text-label text-muted">Výstup</p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-ink">
                      {totalSeats}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-secondary">
                      mandátov je rozdelených stranám nad 5 %. Strany pod prahom
                      majú v D&apos;Hondt výpočte nula kresiel.
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-lg font-extrabold text-ink">Demo vstupy strán</h2>
                      <p className="text-xs text-muted">
                        Upravte percentá a sledujte mandáty, 5 % prah a simulované intervaly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPercentages(INITIAL_PERCENTAGES)}
                      className="self-start rounded-md border border-border bg-page px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-border-strong hover:text-ink"
                    >
                      Resetovať demo
                    </button>
                  </div>

                  <div className="space-y-2" data-testid="methodology-party-lab">
                    {sortedLabParties.map((partyId) => {
                      const party = PARTIES[partyId];
                      const pct = percentages[partyId];
                      const seats = seatMap[partyId] ?? 0;
                      const sim = simulationMap[partyId];
                      const underThreshold = pct < 5;
                      const barWidth = Math.min(100, (pct / 35) * 100);

                      return (
                        <div
                          key={partyId}
                          data-testid={`party-row-${partyId}`}
                          className={cn(
                            "rounded-lg border border-border bg-page p-3",
                            underThreshold && "opacity-65"
                          )}
                        >
                          <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_170px] md:items-center">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ background: party.color }}
                                />
                                <span className="truncate text-sm font-bold text-ink">
                                  {party.abbreviation}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-muted">
                                {underThreshold ? "pod prahom" : `${seats} mandátov`}
                              </p>
                            </div>

                            <div>
                              <label className="sr-only" htmlFor={`pct-${partyId}`}>
                                Percentá {party.abbreviation}
                              </label>
                              <input
                                id={`pct-${partyId}`}
                                aria-label={`Percentá ${party.abbreviation}`}
                                type="range"
                                min={0}
                                max={35}
                                step={0.1}
                                value={pct}
                                onChange={(event) =>
                                  updatePartyPct(partyId, Number(event.target.value))
                                }
                                className="w-full accent-ink"
                              />
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${barWidth}%`, background: party.color }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-right tabular-nums">
                              <LabValue label="%" value={formatPct(pct)} />
                              <LabValue label="m." value={seats ? String(seats) : "0"} />
                              <LabValue
                                label="parl."
                                value={`${(((sim?.parliamentProbability ?? 0) * 100)).toFixed(0)} %`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Panel>
          </section>

          <section id="mandaty" className="mb-10">
            <SectionTitle
              eyebrow="Mandáty"
              title="Percentá sa nemenia na kreslá priamou úmerou"
              text="Slovenské parlamentné voľby používajú D'Hondtovu metódu. Najprv odfiltrujeme strany pod 5 %, potom postupne rozdelíme 150 mandátov podľa deliteľov. Preto malé zmeny okolo prahu môžu výrazne pohnúť kreslami."
            />
            <Callout
              title="Čo čítať opatrne"
              text="Priemer simulovaných mandátov nie je sľub konkrétneho výsledku. Je to spôsob, ako ukázať typické rozdelenie pri aktuálnych dátach a zvolenej neistote."
            />
          </section>

          <section id="povolebne-plany" className="mb-10">
            <SectionTitle
              eyebrow="Povolebné plány"
              title="Programové body sú triedené podľa tém, nie podľa sympatií"
              text="Povolebné plány skladajú programové body strán do kategórií. Tam, kde máme databázové dáta, majú prednosť pred statickými fallbackmi. Statusy sú informačné a majú slúžiť na ďalšie overovanie."
            />
          </section>

          <section id="kauzy" className="mb-10">
            <SectionTitle
              eyebrow="Kauzy"
              title="Procesný stav nie je verdikt aplikácie"
              text="Pri kauzách rozlišujeme podozrenie, obžalobu, prebiehajúce konanie, rozhodnutie a uzavretý stav. Publikované tvrdenia musia byť opreté o trusted zdroje a text má zachovať prezumpciu neviny."
            />
            <Callout
              title="AI kontrola je pomocný editor"
              text="Automatická kontrola môže pomôcť štruktúrovať claimy, ale server znova filtruje zdroje a citlivé veci ostávajú predmetom ručnej kontroly."
            />
          </section>

          <section id="zdroje-dat" className="mb-10">
            <SectionTitle
              eyebrow="Zdroje dát"
              title="Každá vrstva má iný pôvod a inú mieru istoty"
              text="Metodika je otvorená v tom, čo vieme povedať presne a čo je iba modelové zjednodušenie."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <SourceCard title="Prieskumy" text="Uložené databázové riadky a fallback scrape verejnej tabuľky z Wikipédie." />
              <SourceCard title="Predikcia" text="Vážený priemer, empirická neistota agentúr, Monte Carlo a D'Hondt." />
              <SourceCard title="Programy strán" text="Databázové importy a statické fallbacky programových bodov podľa kategórií." />
              <SourceCard title="Opendata" text="CRZ zmluvy verejne zobrazujeme len vtedy, keď sú naviazané na overené prepojenie politika a firmy. Širší zber slúži iba na neskoršie párovanie, nie ako politický zoznam." />
              <SourceCard title="Kauzy" text="Len povolené zdroje pri danej kauze; text rozlišuje tvrdenie a procesný stav." />
              <SourceCard title="Volebný kalkulátor" text="Otázky a váhy strán z databázy, s fallbackom na statické otázky." />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-extrabold text-ink">Limity metodiky</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-secondary">
              <li>Predikcia nie je výsledok volieb a nezachytí náhle politické udalosti.</li>
              <li>Prieskumy majú metodické rozdiely medzi agentúrami a môžu sa systematicky mýliť.</li>
              <li>Kalkulačka zhody nie je odporúčanie koho voliť, iba skóre podľa zvolených váh.</li>
              <li>Kauzy sú právne citlivé informácie a treba ich čítať cez zdroje a procesný stav.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-card p-4">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs text-secondary">{detail}</p>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="mb-5 border-b border-divider pb-4">
      <p className="text-label text-muted">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{text}</p>
    </div>
  );
}

function ExplainerCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <Panel padding="md">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">{step}</p>
      <h3 className="mt-2 text-base font-extrabold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-secondary">{text}</p>
    </Panel>
  );
}

function ControlBlock({
  label,
  value,
  help,
  children,
}: {
  label: string;
  value: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-label text-muted">{label}</p>
          <p className="mt-1 text-xs text-secondary">{help}</p>
        </div>
        <p className="shrink-0 text-sm font-black tabular-nums text-ink">{value}</p>
      </div>
      {children}
    </div>
  );
}

function LabValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-ink">{value}</p>
    </div>
  );
}

function Callout({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-accent-border bg-accent-soft p-4">
      <h3 className="text-sm font-extrabold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-secondary">{text}</p>
    </div>
  );
}

function SourceCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-extrabold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-secondary">{text}</p>
    </div>
  );
}
