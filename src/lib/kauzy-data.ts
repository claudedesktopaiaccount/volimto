export type KauzaStatus = "active_court" | "appeal" | "closed" | "ethics";
export type KauzaCategory =
  | "bezpecnostne_zlozky"
  | "korupcia"
  | "pravny_stat"
  | "akademicka_etika"
  | "doprava";

export interface KauzaSource {
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

export const KAUZY: Kauza[] = [
  {
    id: "ocistec",
    title: "Kauza Očistec",
    shortTitle: "Očistec",
    category: "bezpecnostne_zlozky",
    status: "active_court",
    statusLabel: "Hlavné pojednávanie",
    courtPriority: 1,
    severity: 5,
    startedAt: "2020-11-05",
    updatedAt: "2026-05-20",
    oneLine:
      "Súdny proces o údajnej zločineckej skupine v bezpečnostných zložkách, medzi obžalovanými je aktívny podpredseda NR SR Tibor Gašpar.",
    summary:
      "Očistec je jadrová kauza bývalého vedenia polície, NAKA, finančnej správy a špeciálnej prokuratúry. Podľa verejne dostupných správ obžaloba zahŕňa dvadsať skutkov a opisuje podozrenia zo zneužívania právomoci, korupcie a ovplyvňovania trestných konaní. Pre VolimTo je dôležitá preto, že spája bezpečnostný aparát štátu s aktívnou politickou funkciou: Tibor Gašpar je dnes podpredsedom Národnej rady SR a poslancom za Smer-SD. Kauzu treba zobrazovať so silným dôrazom na procesný stav: ide o obžalobu a súdne prejednávanie, nie o právoplatný rozsudok.",
    legalNote:
      "Obžalovaní majú prezumpciu neviny. Mapa označuje verejne uvádzané procesné postavenie a prepojenia, nie vlastné rozhodnutie o vine.",
    court: {
      institution: "Špecializovaný trestný súd, pracovisko Banská Bystrica",
      phase: "Hlavné pojednávanie sa začalo 11. mája 2026 a bolo odročené.",
      nextStep: "Médiá uvádzajú pokračovanie pojednávania v júni 2026.",
    },
    actors: [
      {
        name: "Tibor Gašpar",
        role: "bývalý policajný prezident",
        party: "Smer-SD",
        slug: "tibor-gaspar",
        relation: "obžalovaný",
        activePublicRole: "podpredseda NR SR, poslanec",
      },
      {
        name: "Dušan Kováčik",
        role: "bývalý špeciálny prokurátor",
        relation: "obžalovaný",
      },
      {
        name: "Norbert Bödör",
        role: "nitriansky podnikateľ",
        relation: "obžalovaný",
      },
    ],
    connections: [
      { target: "Špecializovaný trestný súd", type: "institution", label: "prejednáva", weight: 5 },
      { target: "NAKA", type: "institution", label: "pôvodné vyšetrovanie", weight: 4 },
      { target: "Finančná správa", type: "institution", label: "verejne uvádzané prepojenie", weight: 3 },
      { target: "Smer-SD", type: "institution", label: "aktuálna politická väzba", weight: 4 },
    ],
    claims: [
      {
        subjectName: "Tibor Gašpar",
        statement:
          "Obžaloba ho podľa verejných správ zaraďuje medzi obžalovaných v kauze Očistec; dnes zároveň pôsobí ako podpredseda NR SR.",
        processStatus: "obžaloba / hlavné pojednávanie",
        responsibilityKind: "procesná a politická zodpovednosť",
        claimKind: "obžaloba",
        counterpoint:
          "Neexistuje právoplatný rozsudok v tejto veci; platí prezumpcia neviny.",
        sources: [
          {
            title: "V kauze Očistec začína hlavné pojednávanie na ŠTS",
            outlet: "STVR",
            url: "https://spravy.stvr.sk/2026/05/v-kauze-ocistec-zacina-hlavne-pojednavanie-na-sts-na-lavici-obzalovanych-je-aj-t-gaspar-a-n-bodor/",
            date: "2026-05-11",
          },
        ],
      },
      {
        subjectName: "Norbert Bödör",
        statement:
          "Verejné zdroje ho uvádzajú medzi obžalovanými osobami v hlavnom pojednávaní kauzy Očistec.",
        processStatus: "obžaloba / hlavné pojednávanie",
        responsibilityKind: "procesná zodpovednosť",
        claimKind: "obžaloba",
        counterpoint: "Mapa opisuje procesné postavenie, nie vlastný verdikt aplikácie.",
        sources: [
          {
            title: "Gašpar, Bödör, Kováčik aj Imrecze sa postavili pred súd",
            outlet: "Pravda",
            url: "https://spravy.pravda.sk/domace/clanok/806691-gaspar-bodor-kovacik-aj-imrecze-sa-spolocne-postavili-pred-sudcu/",
            date: "2026-05-11",
          },
        ],
      },
    ],
    timeline: [
      {
        date: "2020-11",
        title: "Akcia Očistec",
        body: "Verejné správy opisujú zadržania viacerých bývalých policajných funkcionárov a ďalších osôb.",
      },
      {
        date: "2021-12",
        title: "Podanie obžaloby",
        body: "Prokurátor bývalého Úradu špeciálnej prokuratúry podal obžalobu na Špecializovaný trestný súd.",
      },
      {
        date: "2026-05-11",
        title: "Začiatok procesu",
        body: "Na pracovisku ŠTS v Banskej Bystrici sa začalo hlavné pojednávanie.",
      },
    ],
    sources: [
      {
        title: "V kauze Očistec začína hlavné pojednávanie na ŠTS",
        outlet: "STVR",
        url: "https://spravy.stvr.sk/2026/05/v-kauze-ocistec-zacina-hlavne-pojednavanie-na-sts-na-lavici-obzalovanych-je-aj-t-gaspar-a-n-bodor/",
        date: "2026-05-11",
      },
      {
        title: "Proces v kauze Očistec má začať v máji",
        outlet: "SITA",
        url: "https://sita.sk/proces-v-kauze-ocistec-v-ktorej-je-obzalovany-aj-podpredseda-parlamentu-tibor-gaspar-ma-zacat-v-maji/",
        date: "2026-03-20",
      },
      {
        title: "Gašpar, Bödör, Kováčik aj Imrecze sa postavili pred súd",
        outlet: "Pravda",
        url: "https://spravy.pravda.sk/domace/clanok/806691-gaspar-bodor-kovacik-aj-imrecze-sa-spolocne-postavili-pred-sudcu/",
        date: "2026-05-11",
      },
    ],
  },
  {
    id: "kazimir-uplatok",
    title: "Peter Kažimír a kauza úplatku",
    shortTitle: "Kažimír",
    category: "korupcia",
    status: "appeal",
    statusLabel: "Neprávoplatný rozsudok",
    courtPriority: 2,
    severity: 4,
    startedAt: "2022-10-01",
    updatedAt: "2025-09-15",
    oneLine:
      "Guvernér NBS a bývalý minister financií bol neprávoplatne uznaný vinným v korupčnej veci; obhajoba avizovala odvolanie.",
    summary:
      "Kauza sa týka obdobia, keď Peter Kažimír pôsobil ako minister financií. Podľa verejných správ ho obžaloba spájala s údajným úplatkom pre bývalého šéfa finančnej správy Františka Imreczeho pri urýchlení daňových kontrol a vratiek DPH. Špecializovaný trestný súd ho v máji 2025 neprávoplatne uznal vinným z podplácania a uložil peňažný trest. Verejný význam kauzy je v prepojení bývalej politickej funkcie, finančnej správy, bankovej autority a súdneho preskúmania.",
    legalNote:
      "Rozsudok uvádzame ako neprávoplatný. Detail musí vždy odlišovať rozhodnutie prvostupňového súdu od konečného výsledku.",
    court: {
      institution: "Špecializovaný trestný súd / Najvyšší súd SR",
      phase: "Prvostupňový neprávoplatný rozsudok, vec smeruje na odvolacie konanie.",
    },
    actors: [
      {
        name: "Peter Kažimír",
        role: "bývalý minister financií",
        party: "Smer-SD",
        relation: "neprávoplatne odsúdený",
        activePublicRole: "guvernér NBS",
      },
      {
        name: "František Imrecze",
        role: "bývalý prezident finančnej správy",
        relation: "kľúčová osoba v skutku podľa obžaloby",
      },
    ],
    connections: [
      { target: "Finančná správa", type: "institution", label: "daňové kontroly", weight: 5 },
      { target: "NBS", type: "institution", label: "aktuálna verejná funkcia", weight: 4 },
      { target: "Najvyšší súd SR", type: "institution", label: "odvolacia rovina", weight: 3 },
      { target: "Smer-SD", type: "institution", label: "bývalá politická väzba", weight: 3 },
    ],
    claims: [
      {
        subjectName: "Peter Kažimír",
        statement:
          "Špecializovaný trestný súd ho podľa verejných správ neprávoplatne uznal vinným z podplácania a uložil peňažný trest.",
        processStatus: "neprávoplatný rozsudok",
        responsibilityKind: "prvostupňový súdny výsledok",
        claimKind: "rozhodnutie",
        counterpoint:
          "Rozsudok nie je právoplatný a obhajoba avizovala odvolanie; konečný výsledok určí odvolacie konanie.",
        sources: [
          {
            title: "Guvernér Národnej banky Peter Kažimír je vinný",
            outlet: "STVR",
            url: "https://slovensko.stvr.sk/clanky/politika-z-domova/403851/guverner-narodnej-banky-peter-kazimir-je-vinny",
            date: "2025-05-29",
          },
          {
            title: "Kauza Kažimír smeruje na Najvyšší súd",
            outlet: "ta3",
            url: "https://www.ta3.com/clanok/1012225/kauza-kazimir-smeruje-na-najvyssi-sud-obhajoba-tvrdi-ze-rozsudok-je-nezakonny-a-cely-proces-bol-chybny",
            date: "2025-09-15",
          },
        ],
      },
      {
        subjectName: "František Imrecze",
        statement:
          "V skutku je podľa obžaloby uvádzaný ako bývalý šéf finančnej správy, ktorému mal byť úplatok určený.",
        processStatus: "tvrdenie obžaloby",
        responsibilityKind: "kontext skutku",
        claimKind: "kontext",
        counterpoint: "Tento uzol nevyslovuje vlastnú vinu ani zodpovednosť tejto osoby.",
        sources: [
          {
            title: "Najvyšší súd zamietol sťažnosť guvernéra NBS",
            outlet: "ta3",
            url: "https://www.ta3.com/clanok/957099/najvyssi-sud-zamietol-staznost-guvernera-nbs-petra-kazimira-obzaloba-splna-zakonne-nalezitosti",
            date: "2024-07-10",
          },
        ],
      },
    ],
    timeline: [
      {
        date: "2022-10",
        title: "Opätovné obvinenie",
        body: "Médiá informovali o opätovnom obvinení v súvislosti s podplácaním.",
      },
      {
        date: "2024-07",
        title: "Obžaloba obstála",
        body: "Najvyšší súd podľa medializovaných informácií zamietol sťažnosť proti prijatiu obžaloby.",
      },
      {
        date: "2025-05-29",
        title: "Neprávoplatný rozsudok",
        body: "Špecializovaný trestný súd ho uznal vinným; obhajoba avizovala odvolanie.",
      },
    ],
    sources: [
      {
        title: "Guvernér Národnej banky Peter Kažimír je vinný",
        outlet: "STVR",
        url: "https://slovensko.stvr.sk/clanky/politika-z-domova/403851/guverner-narodnej-banky-peter-kazimir-je-vinny",
        date: "2025-05-29",
      },
      {
        title: "Kauza Kažimír smeruje na Najvyšší súd",
        outlet: "ta3",
        url: "https://www.ta3.com/clanok/1012225/kauza-kazimir-smeruje-na-najvyssi-sud-obhajoba-tvrdi-ze-rozsudok-je-nezakonny-a-cely-proces-bol-chybny",
        date: "2025-09-15",
      },
      {
        title: "Najvyšší súd zamietol sťažnosť guvernéra NBS",
        outlet: "ta3",
        url: "https://www.ta3.com/clanok/957099/najvyssi-sud-zamietol-staznost-guvernera-nbs-petra-kazimira-obzaloba-splna-zakonne-nalezitosti",
        date: "2024-07-10",
      },
    ],
  },
  {
    id: "sumrak",
    title: "Kauza Súmrak",
    shortTitle: "Súmrak",
    category: "pravny_stat",
    status: "closed",
    statusLabel: "Zrušené cez §363",
    courtPriority: 4,
    severity: 4,
    startedAt: "2022-04-20",
    updatedAt: "2022-11-29",
    oneLine:
      "Prípad pôvodných obvinení Roberta Fica, Roberta Kaliňáka, Tibora Gašpara a Norberta Bödöra bol zrušený generálnou prokuratúrou cez §363.",
    summary:
      "Súmrak je pre mapu dôležitý ako uzol medzi politickými lídrami, bývalým vedením polície, Generálnou prokuratúrou a debatou o §363 Trestného poriadku. Vyšetrovateľ NAKA v roku 2022 obvinil viaceré osoby vrátane Roberta Fica a Roberta Kaliňáka. Generálna prokuratúra neskôr uznesenia zrušila s odôvodnením procesných a právnych chýb. Kauza preto nesmie byť prezentovaná ako súdne potvrdená vina; má byť vedená ako procesne zrušená vec s vysokým významom pre právny štát.",
    legalNote:
      "Obvinenia boli zrušené. Záznam slúži na zachytenie verejne doloženého procesného vývoja a politických prepojení.",
    court: {
      institution: "Generálna prokuratúra SR",
      phase: "Zrušené postupom podľa §363 Trestného poriadku.",
    },
    actors: [
      {
        name: "Robert Fico",
        role: "predseda vlády",
        party: "Smer-SD",
        slug: "robert-fico",
        relation: "pôvodne obvinený, obvinenie zrušené",
        activePublicRole: "predseda vlády SR",
      },
      {
        name: "Robert Kaliňák",
        role: "minister obrany",
        party: "Smer-SD",
        slug: "robert-kalinak",
        relation: "pôvodne obvinený, obvinenie zrušené",
        activePublicRole: "minister obrany SR",
      },
      {
        name: "Tibor Gašpar",
        role: "poslanec",
        party: "Smer-SD",
        slug: "tibor-gaspar",
        relation: "pôvodne obvinený, obvinenie zrušené",
        activePublicRole: "podpredseda NR SR",
      },
    ],
    connections: [
      { target: "Generálna prokuratúra SR", type: "institution", label: "§363", weight: 5 },
      { target: "NAKA", type: "institution", label: "pôvodné obvinenie", weight: 4 },
      { target: "Smer-SD", type: "institution", label: "aktívni politici", weight: 5 },
    ],
    claims: [
      {
        subjectName: "Robert Fico",
        statement:
          "Verejné zdroje opisujú pôvodné obvinenie, ktoré Generálna prokuratúra neskôr zrušila postupom podľa §363.",
        processStatus: "zastavené / zrušené obvinenie",
        responsibilityKind: "procesne zrušená vec",
        claimKind: "procesný vývoj",
        counterpoint:
          "Zrušené obvinenie nemožno prezentovať ako súdom potvrdenú vinu.",
        sources: [
          {
            title: "Žilinka zrušil obvinenia Ficovi a ďalším v kauze Súmrak",
            outlet: "Pravda",
            url: "https://spravy.pravda.sk/domace/clanok/648760-zilinka-zrusil-obvinenia-ficovi-a-dalsim-v-kauze-sumrak/",
            date: "2022-11-29",
          },
        ],
      },
      {
        subjectName: "Robert Kaliňák",
        statement:
          "Mapa ho spája s kauzou len v rozsahu pôvodného obvinenia a jeho následného zrušenia.",
        processStatus: "zastavené / zrušené obvinenie",
        responsibilityKind: "procesne zrušená vec",
        claimKind: "procesný vývoj",
        counterpoint: "Aplikácia z tohto záznamu nerobí vlastný záver o vine.",
        sources: [
          {
            title: "Generálna prokuratúra zrušila obvinenie Ficovi i Kaliňákovi",
            outlet: "Postoj",
            url: "https://www.postoj.sk/119441/dnes-treba-vediet",
            date: "2022-11-29",
          },
        ],
      },
    ],
    timeline: [
      {
        date: "2022-04",
        title: "Vznesenie obvinení",
        body: "NAKA podľa verejných správ obvinila viaceré osoby v rámci akcie Súmrak.",
      },
      {
        date: "2022-11-29",
        title: "Zrušenie obvinení",
        body: "Generálna prokuratúra zrušila obvinenia postupom podľa §363.",
      },
    ],
    sources: [
      {
        title: "Žilinka zrušil obvinenia Ficovi a ďalším v kauze Súmrak",
        outlet: "Pravda",
        url: "https://spravy.pravda.sk/domace/clanok/648760-zilinka-zrusil-obvinenia-ficovi-a-dalsim-v-kauze-sumrak/",
        date: "2022-11-29",
      },
      {
        title: "Generálna prokuratúra zrušila obvinenie Ficovi i Kaliňákovi",
        outlet: "Postoj",
        url: "https://www.postoj.sk/119441/dnes-treba-vediet",
        date: "2022-11-29",
      },
    ],
  },
  {
    id: "danko-rigorozka-nehoda",
    title: "Andrej Danko: rigorózna práca a dopravná nehoda",
    shortTitle: "Danko",
    category: "akademicka_etika",
    status: "ethics",
    statusLabel: "Etická a priestupková kauza",
    courtPriority: 5,
    severity: 2,
    startedAt: "2018-09-01",
    updatedAt: "2024-04-26",
    oneLine:
      "Dve verejne sledované kontroverzie aktívneho predsedu SNS: spor o rigoróznu prácu a uzavretá dopravná nehoda so semaforom.",
    summary:
      "Tento záznam ukazuje, že mapa nemá byť iba trestnoprávny register. Pri aktívnych politikoch je relevantná aj akademická etika, transparentnosť a priestupkové rozhodnutia. V roku 2018 Univerzita Mateja Bela riešila sprístupnenie rigoróznej práce Andreja Danka a zverejnila stanoviská k postupu. V roku 2024 médiá informovali o dopravnej nehode, pri ktorej bol poškodený semafor; prípad bol podľa medializovaných správ uzavretý ako priestupok s pokutou a zákazom viesť vozidlo.",
    legalNote:
      "Záznam oddeľuje akademickú kontroverziu od priestupkovej veci. Neoznačuje trestnoprávnu vinu.",
    court: {
      institution: "Univerzita Mateja Bela / dopravný inšpektorát",
      phase: "Nie je aktívne súdne konanie v tomto zázname.",
    },
    actors: [
      {
        name: "Andrej Danko",
        role: "predseda SNS",
        party: "SNS",
        slug: "andrej-danko",
        relation: "verejne sledovaná osoba",
        activePublicRole: "podpredseda NR SR",
      },
    ],
    connections: [
      { target: "SNS", type: "institution", label: "politická funkcia", weight: 4 },
      { target: "Univerzita Mateja Bela", type: "institution", label: "rigorózna práca", weight: 3 },
      { target: "Dopravný inšpektorát", type: "institution", label: "priestupkové konanie", weight: 2 },
    ],
    claims: [
      {
        subjectName: "Andrej Danko",
        statement:
          "Záznam spája dve verejne doložené kontroverzie: spor o rigoróznu prácu a uzavretú dopravnú priestupkovú vec.",
        processStatus: "etická / priestupková vec",
        responsibilityKind: "politická a verejná zodpovednosť",
        claimKind: "verejná kontroverzia",
        counterpoint:
          "Tento záznam nie je trestnoprávny verdikt a oddeľuje akademickú kontroverziu od priestupku.",
        sources: [
          {
            title: "Stanovisko vedenia UMB vo veci rigorózneho konania Andreja Danka",
            outlet: "Univerzita Mateja Bela",
            url: "https://www.umb.sk/aktuality/stanovisko-vedenia-univerzity-mateja-bela-vo-veci-rigorozneho-konania-andreja-danka.html",
            date: "2018-10-09",
            primary: true,
          },
          {
            title: "Polícia už prípad uzavrela",
            outlet: "TVNOVINY.sk",
            url: "https://tvnoviny.sk/domace/clanok/942342-huliak-hovori-o-novom-dokaze-v-pripade-dankovej-nehody-policia-uz-pripad-uzavrela",
            date: "2024-04-09",
          },
        ],
      },
    ],
    timeline: [
      {
        date: "2018-09",
        title: "Spor o sprístupnenie práce",
        body: "UMB zverejnila stanovisko k žiadosti, aby rigorózna práca nebola sprístupnená.",
      },
      {
        date: "2024-01",
        title: "Nehoda so semaforom",
        body: "Médiá informovali o poškodení semaforu a odchode z miesta nehody.",
      },
      {
        date: "2024-04",
        title: "Uzavretie priestupku",
        body: "Médiá uviedli pokutu a zákaz viesť vozidlo.",
      },
    ],
    sources: [
      {
        title: "Stanovisko vedenia UMB vo veci rigorózneho konania Andreja Danka",
        outlet: "Univerzita Mateja Bela",
        url: "https://www.umb.sk/aktuality/stanovisko-vedenia-univerzity-mateja-bela-vo-veci-rigorozneho-konania-andreja-danka.html",
        date: "2018-10-09",
        primary: true,
      },
      {
        title: "Polícia už prípad uzavrela",
        outlet: "TVNOVINY.sk",
        url: "https://tvnoviny.sk/domace/clanok/942342-huliak-hovori-o-novom-dokaze-v-pripade-dankovej-nehody-policia-uz-pripad-uzavrela",
        date: "2024-04-09",
      },
      {
        title: "Danko dostal za nabouraný semafor pokutu a zákaz řízení",
        outlet: "iDNES.cz",
        url: "https://www.idnes.cz/zpravy/zahranicni/slovensko-andrej-danko-nehoda-semafor-pouta-zakaz-rizeni-zametani.A240426_104121_zahranicni_bro",
        date: "2024-04-26",
      },
    ],
  },
];

function getActiveCourtKauzy() {
  return [...KAUZY]
    .filter((kauza) => kauza.status === "active_court" || kauza.status === "appeal")
    .sort((a, b) => a.courtPriority - b.courtPriority);
}

function getKauzaStats() {
  return {
    total: KAUZY.length,
    activeCourt: KAUZY.filter((kauza) => kauza.status === "active_court").length,
    appeal: KAUZY.filter((kauza) => kauza.status === "appeal").length,
    actors: new Set(KAUZY.flatMap((kauza) => kauza.actors.map((actor) => actor.name))).size,
    sources: KAUZY.reduce((sum, kauza) => sum + kauza.sources.length, 0),
  };
}
