export type KauzaStatus =
  | "prebieha"
  | "vysetruje_sa"
  | "uzavreta_bez_vysledku"
  | "odsudeny"
  | "oslobodeny"
  | "disciplinarne_potrestany"
  | "zastavene";

export type KauzaCategory =
  | "korupcia"
  | "klientelizmus"
  | "plagiatorstvo"
  | "zneuzitie_moci"
  | "konflikt_zaujmov"
  | "hanlivy_vyrok"
  | "nepotizmus"
  | "podvod"
  | "porusenie_ustavy"
  | "ine";

export interface KauzaSource {
  id?: number;
  title: string;
  outlet: string;
  url: string;
  date: string;
  primary?: boolean;
}

export interface KauzaActor {
  name: string;
  role: string;
  party?: string;
  slug?: string;
  relation: string;
  activePublicRole?: string;
}

export interface KauzaTimelineEvent {
  date: string;
  title: string;
  body: string;
}

export interface KauzaConnection {
  target: string;
  type: "politician" | "institution" | "company" | "person";
  label: string;
  weight: number;
}

export interface KauzaClaim {
  id?: number;
  subjectName: string;
  statement: string;
  processStatus: string;
  responsibilityKind: string;
  claimKind: string;
  counterpoint?: string;
  sources: KauzaSource[];
}

export interface Kauza {
  id: string;
  title: string;
  shortTitle: string;
  category: KauzaCategory;
  status: KauzaStatus;
  statusLabel: string;
  courtPriority: number;
  severity: 1 | 2 | 3 | 4 | 5;
  startedAt: string;
  updatedAt: string;
  oneLine: string;
  summary: string;
  legalNote: string;
  court: {
    institution: string;
    phase: string;
    nextStep?: string;
  };
  actors: KauzaActor[];
  connections: KauzaConnection[];
  claims: KauzaClaim[];
  timeline: KauzaTimelineEvent[];
  sources: KauzaSource[];
}

export interface ScandalForUi {
  id: number;
  slug: string;
  titleSk: string;
  summarySk: string;
  startDate: string;
  endDate: string | null;
  status: string;
  category: string;
  institutionInvestigating: string | null;
  verdictUrl: string | null;
  severity: number;
  isEditorialOpinion: boolean;
  actors: {
    mpId: number;
    nameDisplay: string;
    nameFull: string;
    slug: string;
    role: string;
    roleInScandal: string;
    partyAbbr: string | null;
  }[];
  sources: {
    id?: number;
    url: string;
    outletName: string;
    publishedDate: string | null;
    isPrimary: boolean;
  }[];
  claims?: {
    id: number;
    mpId: number | null;
    targetLabel: string;
    claimKind: string;
    processStatus: string;
    responsibilityKind: string;
    statementSk: string;
    counterpointSk: string | null;
    sortOrder: number;
    sourceIds: number[];
  }[];
}

export const KAUZA_STATUS_LABELS: Record<KauzaStatus, string> = {
  prebieha: "Prebieha",
  vysetruje_sa: "Vyšetruje sa",
  uzavreta_bez_vysledku: "Uzavreté bez výsledku",
  odsudeny: "Odsúdený",
  oslobodeny: "Oslobodený",
  disciplinarne_potrestany: "Disciplinárne / priestupkovo",
  zastavene: "Zastavené",
};

export const KAUZA_CATEGORY_LABELS: Record<KauzaCategory, string> = {
  korupcia: "Korupcia",
  klientelizmus: "Klientelizmus",
  plagiatorstvo: "Plagiátorstvo",
  zneuzitie_moci: "Zneužitie moci",
  konflikt_zaujmov: "Konflikt záujmov",
  hanlivy_vyrok: "Hanlivý výrok",
  nepotizmus: "Nepotizmus",
  podvod: "Podvod",
  porusenie_ustavy: "Porušenie ústavy",
  ine: "Iné",
};

const SCANDAL_TITLE_OVERRIDES: Record<string, string> = {
  "zk-europrokuratura-riesi-pre-penziony-uz-zamestnancov-statnej-ppa": "Penziónové dotácie PPA",
  "zk-koalicni-politici-maju-110-mimovladok-viacere-porusuju-zakon": "Mimovládky koaličných politikov",
  "zk-bodorovmu-agrobaronovi-z-fafokanu-schvalila-ppa-dalsiu-dotaciu-zmluvu-za-stat-podpisoval-jeho-znamy":
    "Dotácia PPA pre Fafokan",
  "zk-preco-obvinili-matecnu-povodnu-advokatku-skrtla-novym-dala-18-miliona-za-2-ukony":
    "Obvinenie Gabriely Matečnej",
  "zk-takacov-rezort-pustil-agrodotacie-aj-obvinenym-pomaha-to-projektom-ako-fafokan":
    "Agrodotácie pre obvinených žiadateľov",
  "zk-u-kalinaka-odklepli-145-milionov-eur-firme-s-nedoplatkami-hlasia-sa-k-nej-kvietikovci":
    "Zákazka rezortu obrany za 145 miliónov eur",
  "zk-milionove-granty-z-ministerstva-prace-ziskali-mimovladky-blizke-hlasu":
    "Granty ministerstva práce pre mimovládky blízke Hlasu",
  "zk-6749": "Nákup drahých strojov od dlžníka štátu",
  "zk-odmeny-za-fica-obzalovany-kuruc-dostal-35-tisic-mimoriadne-priplatky-aj-v-ppa":
    "Mimoriadne odmeny v PPA",
  "zk-simeckovu-vysetruje-urad-ktory-riesi-mafiu-stat-jej-faktury-taji":
    "Vyšetrovanie faktúr Šimečkovej nadácie",
  "zk-policia-v-kauze-penziony-uz-pred-rokmi-obvinila-4-ludi-ppa-to-doteraz-ignoruje":
    "Kauza penziónových dotácií",
  "zk-uplatky-za-dotacie-na-penziony-opisuje-kauza-dobytkar": "Kauza Dobytkár",
  "zk-zakazky-od-statu-ma-para-aj-pravnici-spajani-s-brhelom": "Štátne zákazky pre právnikov",
  "zk-po-dobytkarovi-ma-statna-agroagentura-dalsi-skandal": "Ďalší škandál v agroagentúre",
  "zk-mal-podplacat-exministra-pred-sud-nepojde-novela-uz-vysekala-najmenej-1324-osob":
    "Zastavená korupčná vec po novele",
  "zk-policia-zanedbala-pripad-za-ktory-mal-kovacik-dostat-uplatok-ako-od-sicilskej-mafie":
    "Prípad údajného úplatku pre Kováčika",
  "zk-rusenie-naka-je-viac-politicky-ako-profesionalny-krok": "Zrušenie NAKA",
  "zk-nemocnicu-zariadil-predrazene-teraz-ma-pre-kalinaka-stavat-novu-v-presove":
    "Nemocničné zákazky v Prešove",
  "zk-sefky-u-daniarov-odchadzaju-nahle-pocas-kontrol-it-firiem-a-dovery":
    "Kontroly IT firiem u daniarov",
  "zk-statna-agentura-nevie-ukoncit-kontrolu-u-rodiny-svojej-funkcionarky":
    "Kontrola u rodiny funkcionárky PPA",
  "zk-osem-rokov-odkladala-obzalobu-teraz-sefuje-prokurature": "Odkladaná obžaloba na prokuratúre",
  "zk-cistky-v-policii-vysetrovali-korupciu-na-naka-teraz-sedia-doma-alebo-na-okrese":
    "Personálne zmeny v polícii",
  "zk-eu-nechce-korupcnikov-vo-verejnych-funkciach-slovenskej-vlade-sa-to-nepaci":
    "Pravidlá EÚ o korupcii vo verejných funkciách",
  "zk-na-simeckovu-mali-u-daniarov-spis-smotanka-nasli-aj-prevody-s-lidrom-ps":
    "Spis Smotánka u daniarov",
  "zk-statni-kontrolori-preverili-myto-stalo-este-viac-ako-nadacia-varovala":
    "Kontrola mýtneho systému",
  "zk-penzionu-fafokan-dal-stat-dalsie-statisice-eur-aj-ked-vedel-ze-ho-oklamali":
    "Ďalšia dotácia pre penzión Fafokan",
  "zk-dalsi-bartekov-asistent-stoji-za-zdruzenim-ktore-dostalo-dotaciu-od-suska":
    "Dotácia pre združenie Bartekovho asistenta",
  "zk-rasiho-zmeny-v-statnych-zakazkach-po-roku-viac-priamych-nakupov-hrozi-plytvanie":
    "Priame nákupy v štátnych zákazkách",
  "zk-it-nakupy-u-migala-okopirovane-casti-v-zakazkach-a-manazer-od-hlavneho-dodavatela":
    "IT nákupy na úrade Samuela Migaľa",
  "zk-kauza-predrazeneho-lietadla-sef-lps-nedostal-padaka-ale-odmenu-42-tisic-eur":
    "Kauza predraženého lietadla",
  "zk-kauza-penziony-funkcionarke-dali-odmeny-11-tisic-jej-skandal-upratali": "Kauza penzióny",
  "zk-kauza-falosnych-penzionov-zmapovali-sme-siet-penzijnych-dotacii-okolo-obzalovaneho-bodora":
    "Kauza falošných penziónov",
  "zk-policia-odmietla-trestne-oznamenie-estok-priznal-ze-si-formulu-1-neplatil":
    "Eštokova cesta na Formulu 1",
  "zk-stat-porusil-pri-expo-osaka-zakon-ked-zrusil-sutaz": "Zrušená súťaž pre EXPO Osaka",
  "zk-dobytkar-2-nadacia-odhalila-schemu-milionovych-agrodotacii-rovnake-osoby-datumy-aj-prepojenie-na-funkcionarku-ppa":
    "Dobytkár 2",
  "zk-v-bzanovej-kauze-sa-objavila-cudna-pozicka-pre-odmeny-advokatom-stihaju-aj-ficovho-sefa-uradu":
    "Bžánova kauza",
  "zk-zrusenie-naka-usporu-v-riadeni-neprinieslo-sefov-pribudlo": "Zrušenie NAKA",
  "zk-markizu-aj-skytoll-ovlada-rovnaky-majitel-kym-v-markize-robil-poriadky-stat-mu-prihral-nove-zmluvy":
    "Štátne zmluvy pre SkyToll",
  "zk-sud-dal-za-pravdu-oznamovatelke-z-kosickej-zachranky":
    "Košická záchranka a oznamovateľka",
  "zk-kauza-v-rezorte-kultury-jeden-pozemok-dva-posudky-a-rozdiel-15-miliona-eur":
    "Pozemok v rezorte kultúry",
  "zk-kauza-falosne-penziony-ppa-klame-aby-ochranila-funkcionarku": "Kauza falošné penzióny",
  "zk-dezinfoweby-porusuju-zakon-riesit-by-ich-mala-simkovicova":
    "Dezinfoweby a zákonné povinnosti",
  "zk-vila-amonra-z-kauzy-penzionov-moze-obchadzat-zakon-nadacia-podava-podnet":
    "Vila Amonra v kauze penziónov",
  "zk-nielen-sud-ale-ani-daniari-neuverili-brhelovi-firmu-mu-dodanili-13-milionom-eur":
    "Daňové konanie firmy spájanej s Brhelom",
  "zk-uvo-doprial-hostom-nevidany-luxus-na-konferenciu-minul-90-tisic-eur-na-osobu-1300":
    "Konferencia ÚVO",
  "zk-setrenie-u-daniarov-na-odmenach-si-rozdelili-rekordnu-sumu-14-miliona": "Odmeny u daniarov",
  "zk-historia-sa-opakuje-stat-mozno-opat-prerobi-miliony-na-myte": "Mýtny systém",
  "zk-okresny-urad-odignoroval-prokuraturu-v-pripade-estokovho-priestupku-mimovladky-ocakavaju-ze-prokuratura-sa-odvola":
    "Eštokov priestupok",
  "zk-kiska-vs-budamar-obaja-opravili-danove-priznanie-len-jedneho-odsudili": "Kiska vs. Budamar",
  "zk-ministerka-simkovicova-riadila-divadlo-aj-ked-nemala-podavame-podnet":
    "Podnet na ministerku Šimkovičovú",
  "zk-zrusenie-naka-moze-byt-nezakonne": "Zrušenie NAKA",
  "zk-s-prepojeniami-na-bodorovcov-mala-riadit-milionove-statne-nakupy":
    "Miliónové nákupy u daniarov",
  "zk-ideme-na-sud-s-tomasom-ktoreho-sikanuju-pre-pravdu": "Súdny spor oznamovateľa",
  "zk-nadacia-zastavme-korupciu-podava-pre-jachtarske-preteky-podnet-na-simkovicovu-a-kotlara":
    "Jachtárske preteky Šimkovičovej a Kotlára",
  "zk-cistky-u-ministra-tarabu-50-odidenych-odbornikov": "Personálne odchody u ministra Tarabu",
  "zk-interny-prikaz-policie-naka-uz-nebude-riesit-korupciu-ani-organizovany-zlocin":
    "Interný príkaz polície k NAKA",
};

const ACTIVE_STATUSES = new Set<KauzaStatus>(["prebieha", "vysetruje_sa"]);
const CLOSED_STATUSES = new Set<KauzaStatus>([
  "uzavreta_bez_vysledku",
  "odsudeny",
  "oslobodeny",
  "disciplinarne_potrestany",
  "zastavene",
]);

export function normalizeStatus(status: string): KauzaStatus {
  const normalized = normalizeKey(status);
  if (normalized === "uzavreta_bez_vysledku") return "uzavreta_bez_vysledku";
  if (normalized === "odsudeny") return "odsudeny";
  if (normalized === "oslobodeny") return "oslobodeny";
  if (normalized === "disciplinarne_potrestany") return "disciplinarne_potrestany";
  if (normalized === "zastavene") return "zastavene";
  if (normalized === "prebieha") return "prebieha";
  return "vysetruje_sa";
}

export function normalizeCategory(category: string): KauzaCategory {
  const normalized = normalizeKey(category);
  if (normalized === "korupcia") return "korupcia";
  if (normalized === "klientelizmus") return "klientelizmus";
  if (normalized === "plagiatorstvo") return "plagiatorstvo";
  if (normalized === "zneuzitie_moci") return "zneuzitie_moci";
  if (normalized === "konflikt_zaujmov") return "konflikt_zaujmov";
  if (normalized === "hanlivy_vyrok") return "hanlivy_vyrok";
  if (normalized === "nepotizmus") return "nepotizmus";
  if (normalized === "podvod") return "podvod";
  if (normalized === "porusenie_ustavy") return "porusenie_ustavy";
  return "ine";
}

export function mapScandalToKauza(scandal: ScandalForUi): Kauza {
  const status = normalizeStatus(scandal.status);
  const category = normalizeCategory(scandal.category);
  const severity = clampSeverity(scandal.severity);
  const statusLabel = KAUZA_STATUS_LABELS[status];
  const institution = scandal.institutionInvestigating || defaultInstitution(status);
  const actorNames = scandal.actors.map((actor) => actor.nameDisplay);
  const title = displayTitle(scandal);
  const summary = cleanScandalSummary(scandal.summarySk);
  const oneLine = buildOneLine(summary, actorNames);

  const actors = scandal.actors.map((actor) => ({
    name: actor.nameDisplay,
    role: actor.role,
    party: actor.partyAbbr ?? undefined,
    slug: actor.slug,
    relation: humanizeRole(actor.roleInScandal),
    activePublicRole: actor.role && actor.role !== "poslanec" ? actor.role : undefined,
  }));

  const sources: KauzaSource[] = scandal.sources.map((source) => ({
    id: source.id,
    title: source.outletName,
    outlet: source.outletName,
    url: source.url,
    date: source.publishedDate ?? scandal.startDate,
    primary: source.isPrimary,
  }));
  const claims = buildClaims(scandal, sources, status, title);

  const connections: KauzaConnection[] = [
    ...(institution
      ? [{ target: institution, type: "institution" as const, label: statusLabel, weight: severity }]
      : []),
    ...unique(
      scandal.actors
        .map((actor) => actor.partyAbbr)
        .filter((party): party is string => Boolean(party))
    ).map((party) => ({
      target: party,
      type: "institution" as const,
      label: "politická väzba",
      weight: Math.max(2, severity - 1),
    })),
  ];

  return {
    id: scandal.slug,
    title,
    shortTitle: shortTitle(title),
    category,
    status,
    statusLabel,
    courtPriority: statusPriority(status),
    severity,
    startedAt: scandal.startDate,
    updatedAt: scandal.endDate ?? scandal.startDate,
    oneLine,
    summary,
    legalNote: legalNote(status),
    court: {
      institution,
      phase: phaseText(status, scandal.endDate),
      nextStep: ACTIVE_STATUSES.has(status) ? "Sledovať ďalší verejný procesný vývoj a nové zdroje." : undefined,
    },
    actors,
    connections,
    claims,
    timeline: buildTimeline(scandal),
    sources,
  };
}

export function getActiveCourtKauzy(kauzy: Kauza[]) {
  return [...kauzy]
    .filter((kauza) => ACTIVE_STATUSES.has(kauza.status))
    .sort((a, b) => a.courtPriority - b.courtPriority || b.severity - a.severity)
    .slice(0, 4);
}

export function getKauzaStats(kauzy: Kauza[]) {
  return {
    total: kauzy.length,
    activeCourt: kauzy.filter((kauza) => ACTIVE_STATUSES.has(kauza.status)).length,
    appeal: kauzy.filter((kauza) => kauza.status === "prebieha").length,
    actors: new Set(kauzy.flatMap((kauza) => kauza.actors.map((actor) => actor.name))).size,
    sources: kauzy.reduce((sum, kauza) => sum + kauza.sources.length, 0),
  };
}

export function isClosedStatus(status: KauzaStatus) {
  return CLOSED_STATUSES.has(status);
}

function buildTimeline(scandal: ScandalForUi): KauzaTimelineEvent[] {
  const events: KauzaTimelineEvent[] = [
    {
      date: scandal.startDate,
      title: "Začiatok verejne evidovanej kauzy",
      body: "Dátum vychádza z verejne dostupných zdrojov alebo z prvého doloženého významného vývoja.",
    },
  ];

  if (scandal.endDate) {
    events.push({
      date: scandal.endDate,
      title: "Evidovaný koniec alebo posledný procesný výsledok",
      body: phaseText(normalizeStatus(scandal.status), scandal.endDate),
    });
  }

  return events;
}

function buildClaims(
  scandal: ScandalForUi,
  sources: KauzaSource[],
  status: KauzaStatus,
  title: string
): KauzaClaim[] {
  const sourceById = new Map(
    sources
      .filter((source) => source.id != null)
      .map((source) => [source.id as number, source])
  );
  const structured = scandal.claims ?? [];

  if (structured.length > 0) {
    return structured
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((claim) => {
        const claimSources = claim.sourceIds
          .map((sourceId) => sourceById.get(sourceId))
          .filter((source): source is KauzaSource => Boolean(source));

        return {
          id: claim.id,
          subjectName: claim.targetLabel,
          statement: claim.statementSk,
          processStatus: claim.processStatus,
          responsibilityKind: claim.responsibilityKind,
          claimKind: claim.claimKind,
          counterpoint: claim.counterpointSk ?? undefined,
          sources: claimSources.length > 0 ? claimSources : sources.slice(0, 2),
        };
      });
  }

  if (scandal.actors.length === 0) {
    return [
      {
        subjectName: title,
        statement:
          "Záznam opisuje verejne uvádzané tvrdenia z priložených zdrojov; aplikácia z nich nerobí vlastný verdikt.",
        processStatus: processStatusText(status),
        responsibilityKind: "verejne uvádzané tvrdenie",
        claimKind: "kontext",
        counterpoint: legalNote(status),
        sources: sources.slice(0, 2),
      },
    ];
  }

  return scandal.actors.map((actor, index) => ({
    subjectName: actor.nameDisplay,
    statement: `Podľa priložených zdrojov je ${actor.nameDisplay} v zázname uvedený ako ${humanizeRole(actor.roleInScandal)}.`,
    processStatus: processStatusText(status),
    responsibilityKind: "verejne uvádzané tvrdenie",
    claimKind: "prepojenie aktéra",
    counterpoint: legalNote(status),
    sources: sources.slice(index, index + 2).length > 0 ? sources.slice(index, index + 2) : sources.slice(0, 2),
  }));
}

function processStatusText(status: KauzaStatus) {
  if (status === "vysetruje_sa") return "podozrenie / vyšetrovanie";
  if (status === "prebieha") return "prebiehajúce konanie";
  if (status === "odsudeny") return "právoplatný výsledok";
  if (status === "oslobodeny") return "oslobodený";
  if (status === "zastavene") return "zastavené";
  if (status === "uzavreta_bez_vysledku") return "uzavreté bez výsledku";
  return "disciplinárny alebo priestupkový výsledok";
}

function buildOneLine(summary: string, actorNames: string[]) {
  const compact = summary.replace(/\s+/g, " ").trim();
  const firstSentence = compact.split(/(?<=[.!?])\s+/)[0] ?? compact;
  const actors = actorNames.length > 0 ? ` Prepojení aktéri: ${actorNames.join(", ")}.` : "";
  return `${firstSentence}${actors}`.slice(0, 320);
}

function cleanScandalSummary(summary: string) {
  const compact = summary.replace(/\s+/g, " ").trim();
  if (!compact) return fallbackScandalSummary(null);
  if (!compact.includes("Z dostupného textu:")) return compact;

  return fallbackScandalSummary(extractImportedActorSentence(compact));
}

function fallbackScandalSummary(actorSentence: string | null) {
  return [
    "Záznam vychádza z archívu Nadácie Zastavme korupciu a priložených verejných zdrojov.",
    actorSentence,
    "Záznam nepredstavuje vlastný právny záver aplikácie.",
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function extractImportedActorSentence(summary: string) {
  const starts = [
    "Verejne rozpoznané prepojenia",
    "Prepojenie na konkrétneho politika",
  ];
  const start = starts
    .map((marker) => summary.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (start == null) return null;

  const legalStart = summary.indexOf("Záznam nepredstavuje", start);
  const end = legalStart >= 0 ? legalStart : summary.length;
  const sentence = summary.slice(start, end).replace(/\s+/g, " ").trim();
  return sentence ? `${sentence.replace(/[.!?]+$/, "")}.` : null;
}

function clampSeverity(value: number): 1 | 2 | 3 | 4 | 5 {
  if (value <= 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  if (value === 4) return 4;
  return 5;
}

function defaultInstitution(status: KauzaStatus) {
  if (status === "disciplinarne_potrestany") return "Kontrolný alebo priestupkový orgán";
  if (isClosedStatus(status)) return "Príslušná verejná inštitúcia";
  return "Orgány činné v trestnom konaní / kontrolné orgány";
}

function humanizeRole(role: string) {
  return role.replace(/_/g, " ");
}

function legalNote(status: KauzaStatus) {
  if (status === "odsudeny") {
    return "Záznam uvádza verejne doložený procesný výsledok. Pri súvisiacich osobách rozlišuje ich vlastné procesné postavenie.";
  }
  if (status === "zastavene" || status === "uzavreta_bez_vysledku" || status === "oslobodeny") {
    return "Záznam zachytáva verejne doložený vývoj a neoznačuje vlastné rozhodnutie o vine.";
  }
  return "Platí prezumpcia neviny. Záznam označuje verejne uvádzané podozrenia, procesný stav a zdroje, nie vlastné rozhodnutie o vine.";
}

function phaseText(status: KauzaStatus, endDate: string | null) {
  const suffix = endDate ? ` Evidované k ${endDate}.` : "";
  return `${KAUZA_STATUS_LABELS[status]}.${suffix}`;
}

function displayTitle(scandal: ScandalForUi) {
  const override = SCANDAL_TITLE_OVERRIDES[scandal.slug];
  if (override) return override;

  const compact = scandal.titleSk.replace(/\s+/g, " ").trim();
  const explicitKauza = compact.match(/\bkauz[aeiouy]\s+([A-ZÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ][^:.,!?]{2,54})/i);
  if (explicitKauza?.[1]) return `Kauza ${explicitKauza[1].trim()}`;

  const colonPrefix = compact.split(":")[0]?.trim();
  if (colonPrefix && colonPrefix.length >= 6 && colonPrefix.length <= 48) return colonPrefix;

  return compact;
}

function shortTitle(title: string) {
  return title
    .replace(/^Kauza\s+/i, "")
    .split(":")[0]
    .split(".")[0]
    .trim()
    .slice(0, 42);
}

function statusPriority(status: KauzaStatus) {
  if (status === "vysetruje_sa") return 1;
  if (status === "prebieha") return 2;
  if (status === "odsudeny") return 3;
  return 4;
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}
