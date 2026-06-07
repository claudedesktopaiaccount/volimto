export interface Party {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  secondaryColor?: string;
  leader: string;
  deputyLeaders: string[];
  seats: number;
  ideology: string;
  logoUrl?: string;
  portraitUrl?: string;
}

/**
 * Party registry — verified from Wikipedia infoboxes, March 2026.
 * Colors are from Wikipedia `legend-color` computed background-color.
 * KEEP THIS UP TO DATE when leadership changes occur.
 */
export const PARTIES: Record<string, Party> = {
  ps: {
    id: "ps",
    name: "Progresívne Slovensko",
    abbreviation: "PS",
    color: "#00BDFF",
    leader: "Michal Šimečka",
    deputyLeaders: [
      "Ivan Štefunko",
      "Michal Truban",
      "Tomáš Valášek",
      "Simona Petrík",
      "Zora Jaurová",
    ],
    seats: 33,
    ideology: "Liberalizmus, sociálny liberalizmus, proeurópskosť",
    portraitUrl: "/portraits/ps-simecka.jpg",
  },
  "smer-sd": {
    id: "smer-sd",
    name: "Smer – sociálna demokracia",
    abbreviation: "SMER",
    color: "#D82222",
    leader: "Robert Fico",
    deputyLeaders: [],
    seats: 42,
    ideology: "Sociálna demokracia, populizmus, euroskepticizmus",
    portraitUrl: "/portraits/smer-fico.jpg",
  },
  "hlas-sd": {
    id: "hlas-sd",
    name: "Hlas – sociálna demokracia",
    abbreviation: "HLAS",
    color: "#FA0F18",
    secondaryColor: "#0B0F57",
    leader: "Matúš Šutaj Eštok",
    deputyLeaders: ["Peter Pellegrini (čestný predseda)"],
    seats: 26,
    ideology: "Sociálna demokracia",
    portraitUrl: "/portraits/hlas-sutaj-estok.jpg",
  },
  republika: {
    id: "republika",
    name: "Republika",
    abbreviation: "REP",
    color: "#174194",
    secondaryColor: "#E30512",
    leader: "Milan Uhrík",
    deputyLeaders: [],
    seats: 0,
    ideology: "Národný konzervativizmus, euroskepticizmus",
    portraitUrl: "/portraits/republika-uhrik.jpg",
  },
  sas: {
    id: "sas",
    name: "Sloboda a Solidarita",
    abbreviation: "SaS",
    color: "#9BC31C",
    secondaryColor: "#00315C",
    leader: "Branislav Gröhling",
    deputyLeaders: [],
    seats: 11,
    ideology: "Klasický liberalizmus, ekonomický liberalizmus",
    portraitUrl: "/portraits/sas-grohling.jpg",
  },
  kdh: {
    id: "kdh",
    name: "Kresťanskodemokratické hnutie",
    abbreviation: "KDH",
    color: "#173A70",
    secondaryColor: "#EE2724",
    leader: "Milan Majerský",
    deputyLeaders: [],
    seats: 11,
    ideology: "Kresťanská demokracia, konzervativizmus",
    portraitUrl: "/portraits/kdh-majersky.jpg",
  },
  sns: {
    id: "sns",
    name: "Slovenská národná strana",
    abbreviation: "SNS",
    color: "#252E70",
    secondaryColor: "#E40032",
    leader: "Andrej Danko",
    deputyLeaders: [],
    seats: 6,
    ideology: "Národný konzervativizmus, populizmus",
    portraitUrl: "/portraits/sns-danko.jpg",
  },
  vidieka: {
    id: "vidieka",
    name: "Strana vidieka",
    abbreviation: "VIDIEK",
    color: "#4F7D2A",
    secondaryColor: "#D9B44A",
    leader: "Rudolf Huliak",
    deputyLeaders: [],
    seats: 3,
    portraitUrl: "/portraits/minister-rudolf-huliak.png",
    ideology: "Regionálna politika, vidiek, poľnohospodárstvo",
  },
  demokrati: {
    id: "demokrati",
    name: "Demokrati",
    abbreviation: "DEM",
    color: "#FC0C5D",
    secondaryColor: "#50168E",
    leader: "Jaroslav Naď",
    deputyLeaders: [],
    seats: 1,
    ideology: "Liberálny konzervativizmus, proeurópskosť",
    portraitUrl: "/portraits/demokrati-nad.jpg",
  },
  aliancia: {
    id: "aliancia",
    name: "Magyar Szövetség – Maďarská aliancia",
    abbreviation: "AL",
    color: "#F48B24",
    leader: "László Gubík",
    deputyLeaders: [],
    seats: 0,
    ideology: "Regionalizmus, menšinové práva",
    portraitUrl: "/portraits/aliancia-gubik.jpg",
  },
  slovensko: {
    id: "slovensko",
    name: "Slovensko",
    abbreviation: "SLOV",
    color: "#42B5C2",
    secondaryColor: "#CF181F",
    leader: "Igor Matovič",
    deputyLeaders: [],
    seats: 10,
    ideology: "Populizmus, kresťanská demokracia",
    portraitUrl: "/portraits/slovensko-matovic.jpg",
  },
};

export const PARTY_IDS = Object.keys(PARTIES);

export const PARTY_LIST = Object.values(PARTIES);

/** Preset coalition groupings */
const COALITIONS = {
  progressive: ["ps", "demokrati", "kdh", "sas"],
  fico: ["smer-sd", "hlas-sd", "sns", "republika"],
} as const;

/** Get a party by ID, with fallback */
function getParty(id: string): Party | undefined {
  return PARTIES[id];
}
