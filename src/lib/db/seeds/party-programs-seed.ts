// Seed script for party promises
// Run manually after connecting to Neon Postgres

interface PromiseSeed {
  partyId: string;
  promiseText: string;
  category: string;
  isPro: boolean;
  sourceUrl?: string;
}

export const SEED_DATA: PromiseSeed[] = [
  // PS — Progresívne Slovensko
  { partyId: "ps", promiseText: "Posilnenie nezávislosti súdnictva a prokuratúry", category: "Právny štát", isPro: true, sourceUrl: "https://progresivne.sk/program" },
  { partyId: "ps", promiseText: "Zavedenie registrovaných partnerstiev", category: "Ľudské práva", isPro: true, sourceUrl: "https://progresivne.sk/program" },
  { partyId: "ps", promiseText: "Zvýšenie výdavkov na vzdelávanie na 5% HDP", category: "Školstvo", isPro: true, sourceUrl: "https://progresivne.sk/program" },
  { partyId: "ps", promiseText: "Proeurópska zahraničná politika a podpora Ukrajiny", category: "Zahraničná politika", isPro: true, sourceUrl: "https://progresivne.sk/program" },
  { partyId: "ps", promiseText: "Zelená transformácia energetiky", category: "Životné prostredie", isPro: true, sourceUrl: "https://progresivne.sk/program" },

  // Smer-SD
  { partyId: "smer-sd", promiseText: "Konsolidácia verejných financií", category: "Ekonomika", isPro: true, sourceUrl: "https://smer.sk" },
  { partyId: "smer-sd", promiseText: "Zachovanie sociálnych istôt a valorizácia dôchodkov", category: "Sociálne veci", isPro: true, sourceUrl: "https://smer.sk" },
  { partyId: "smer-sd", promiseText: "Posilnenie suverenity SR voči inštitúciám EÚ", category: "Zahraničná politika", isPro: true, sourceUrl: "https://smer.sk" },
  { partyId: "smer-sd", promiseText: "Boj proti nelegálnej migrácii", category: "Bezpečnosť", isPro: true, sourceUrl: "https://smer.sk" },
  { partyId: "smer-sd", promiseText: "Regulácia cien energií pre domácnosti", category: "Ekonomika", isPro: true, sourceUrl: "https://smer.sk" },

  // Hlas-SD
  { partyId: "hlas-sd", promiseText: "Zvýšenie minimálnej mzdy", category: "Sociálne veci", isPro: true, sourceUrl: "https://hlas.sk" },
  { partyId: "hlas-sd", promiseText: "Modernizácia a výstavba nových nemocníc", category: "Zdravotníctvo", isPro: true, sourceUrl: "https://hlas.sk" },
  { partyId: "hlas-sd", promiseText: "Podpora rodín s deťmi a rodinné prídavky", category: "Sociálne veci", isPro: true, sourceUrl: "https://hlas.sk" },
  { partyId: "hlas-sd", promiseText: "Reforma verejnej správy a digitalizácia", category: "Ekonomika", isPro: true, sourceUrl: "https://hlas.sk" },
  { partyId: "hlas-sd", promiseText: "Zvýšenie platov v štátnej správe", category: "Ekonomika", isPro: true, sourceUrl: "https://hlas.sk" },

  // KDH
  { partyId: "kdh", promiseText: "Ochrana tradičnej rodiny a manželstva", category: "Sociálne veci", isPro: true, sourceUrl: "https://kdh.sk" },
  { partyId: "kdh", promiseText: "Podpora vidieka a poľnohospodárstva", category: "Ekonomika", isPro: true, sourceUrl: "https://kdh.sk" },
  { partyId: "kdh", promiseText: "Zvýšenie platov učiteľov a reforma školstva", category: "Školstvo", isPro: true, sourceUrl: "https://kdh.sk" },
  { partyId: "kdh", promiseText: "Posilnenie kresťanských hodnôt vo verejnom živote", category: "Sociálne veci", isPro: true, sourceUrl: "https://kdh.sk" },
  { partyId: "kdh", promiseText: "Podpora prorodinnej politiky a demografického rastu", category: "Sociálne veci", isPro: true, sourceUrl: "https://kdh.sk" },

  // SaS
  { partyId: "sas", promiseText: "Zníženie daní a odvodov pre podnikateľov", category: "Ekonomika", isPro: true, sourceUrl: "https://sas.sk" },
  { partyId: "sas", promiseText: "Zrušenie zbytočnej byrokracie a regulácií", category: "Ekonomika", isPro: true, sourceUrl: "https://sas.sk" },
  { partyId: "sas", promiseText: "Reforma školstva podľa fínskeho modelu", category: "Školstvo", isPro: true, sourceUrl: "https://sas.sk" },
  { partyId: "sas", promiseText: "Slobodný trh a minimálne zásahy štátu", category: "Ekonomika", isPro: true, sourceUrl: "https://sas.sk" },
  { partyId: "sas", promiseText: "Transparentné verejné obstarávanie", category: "Ekonomika", isPro: true, sourceUrl: "https://sas.sk" },

  // Republika
  { partyId: "republika", promiseText: "Ochrana národnej suverenity a odmietanie federalizácie EÚ", category: "Zahraničná politika", isPro: true, sourceUrl: "https://republika.sk" },
  { partyId: "republika", promiseText: "Prísna migračná politika a ochrana hraníc", category: "Bezpečnosť", isPro: true, sourceUrl: "https://republika.sk" },
  { partyId: "republika", promiseText: "Podpora tradičnej rodiny a demografický rast", category: "Sociálne veci", isPro: true, sourceUrl: "https://republika.sk" },
  { partyId: "republika", promiseText: "Zníženie závislosti na zahraničných dodávateľoch energií", category: "Ekonomika", isPro: true, sourceUrl: "https://republika.sk" },
  { partyId: "republika", promiseText: "Odmietanie sankcií voči Rusku", category: "Zahraničná politika", isPro: true, sourceUrl: "https://republika.sk" },

  // SNS
  { partyId: "sns", promiseText: "Ochrana slovenského jazyka a národnej identity", category: "Školstvo", isPro: true, sourceUrl: "https://sns.sk" },
  { partyId: "sns", promiseText: "Posilnenie obranyschopnosti Slovenskej republiky", category: "Bezpečnosť", isPro: true, sourceUrl: "https://sns.sk" },
  { partyId: "sns", promiseText: "Podpora domáceho poľnohospodárstva a potravinovej sebestačnosti", category: "Ekonomika", isPro: true, sourceUrl: "https://sns.sk" },
  { partyId: "sns", promiseText: "Zachovanie tradičných hodnôt v školstve", category: "Školstvo", isPro: true, sourceUrl: "https://sns.sk" },
  { partyId: "sns", promiseText: "Boj proti drogovej závislosti a kriminalite", category: "Bezpečnosť", isPro: true, sourceUrl: "https://sns.sk" },

  // Demokrati
  { partyId: "demokrati", promiseText: "Posilnenie právneho štátu a nezávislosti justície", category: "Právny štát", isPro: true, sourceUrl: "https://demokrati.sk" },
  { partyId: "demokrati", promiseText: "Transparentnosť verejných financií a boj proti korupcii", category: "Ekonomika", isPro: true, sourceUrl: "https://demokrati.sk" },
  { partyId: "demokrati", promiseText: "Proeurópska a proatlantická zahraničná politika", category: "Zahraničná politika", isPro: true, sourceUrl: "https://demokrati.sk" },
  { partyId: "demokrati", promiseText: "Reforma súdnictva a prokuratúry", category: "Právny štát", isPro: true, sourceUrl: "https://demokrati.sk" },
  { partyId: "demokrati", promiseText: "Podpora občianskej spoločnosti a médií", category: "Sociálne veci", isPro: true, sourceUrl: "https://demokrati.sk" },
];
