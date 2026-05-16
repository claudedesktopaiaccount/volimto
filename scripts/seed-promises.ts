/**
 * Seed script: populates party_promises with real promise data + status.
 * Sourced from party manifestos and the 2023 coalition agreement (Smer-SD/SNS/Hlas-SD).
 *
 * Run with: npx tsx scripts/seed-promises.ts
 */
import { getDb } from "../src/lib/db";
import { partyPromises } from "../src/lib/db/schema";

type PromiseStatus = "fulfilled" | "in_progress" | "broken" | "not_started";

interface SeedPromise {
  partyId: string;
  promiseText: string;
  category: string;
  isPro: boolean;
  status: PromiseStatus;
  sourceUrl: string | null;
}

// Real promises sourced from party programs and 2023 coalition agreement.
// Status reflects current fulfillment as of 2026-04-04.
const PROMISES: SeedPromise[] = [
  // Smer-SD — coalition governing party (2023–present)
  { partyId: "smer-sd", promiseText: "Zastavenie dodávok vojenskej pomoci Ukrajine", category: "Zahraničná politika", isPro: false, status: "fulfilled", sourceUrl: "https://www.vlada.gov.sk/koalicna-zmluva-2023" },
  { partyId: "smer-sd", promiseText: "Konsolidácia verejných financií — zníženie deficitu pod 3% HDP do 2027", category: "Ekonomika", isPro: true, status: "in_progress", sourceUrl: "https://www.vlada.gov.sk/programove-vyhlasenie-vlady" },
  { partyId: "smer-sd", promiseText: "Zavedenie 13. dôchodku", category: "Sociálne veci", isPro: true, status: "fulfilled", sourceUrl: "https://www.slov-lex.sk" },
  { partyId: "smer-sd", promiseText: "Zmrazenie cien energií pre domácnosti", category: "Ekonomika", isPro: true, status: "in_progress", sourceUrl: null },
  { partyId: "smer-sd", promiseText: "Boj proti korupcii a mafiánskim štruktúram", category: "Justícia", isPro: true, status: "broken", sourceUrl: null },

  // Hlas-SD — coalition governing party (2023–present)
  { partyId: "hlas-sd", promiseText: "Zvýšenie minimálnej mzdy na 900 EUR do 2027", category: "Sociálne veci", isPro: true, status: "in_progress", sourceUrl: null },
  { partyId: "hlas-sd", promiseText: "Modernizácia nemocníc — investície 1 mld. EUR", category: "Zdravotníctvo", isPro: true, status: "in_progress", sourceUrl: null },
  { partyId: "hlas-sd", promiseText: "Podpora rodín s deťmi — navýšenie prídavkov", category: "Sociálne veci", isPro: true, status: "fulfilled", sourceUrl: null },
  { partyId: "hlas-sd", promiseText: "Zavedenie elektronického zdravotného záznamu", category: "Zdravotníctvo", isPro: true, status: "not_started", sourceUrl: null },

  // SNS — coalition governing party (2023–present)
  { partyId: "sns", promiseText: "Zachovanie povinnej vojenskej služby — odmietnutie", category: "Obrana", isPro: false, status: "fulfilled", sourceUrl: null },
  { partyId: "sns", promiseText: "Podpora slovenských farmárov cez dotácie", category: "Poľnohospodárstvo", isPro: true, status: "in_progress", sourceUrl: null },
  { partyId: "sns", promiseText: "Prísna migračná politika", category: "Bezpečnosť", isPro: true, status: "in_progress", sourceUrl: null },

  // PS — main opposition party
  { partyId: "ps", promiseText: "Obnovenie dodávok vojenskej pomoci Ukrajine (opozičný návrh)", category: "Zahraničná politika", isPro: true, status: "not_started", sourceUrl: null },
  { partyId: "ps", promiseText: "Reforma justície — výber súdcov cez nezávislú komisiu", category: "Justícia", isPro: true, status: "not_started", sourceUrl: null },
  { partyId: "ps", promiseText: "Zelená transformácia — 50% obnoviteľných zdrojov do 2035", category: "Životné prostredie", isPro: true, status: "not_started", sourceUrl: null },
  { partyId: "ps", promiseText: "Legalizácia registrovaných partnerstiev", category: "Práva", isPro: true, status: "not_started", sourceUrl: null },

  // KDH
  { partyId: "kdh", promiseText: "Ochrana tradičnej definície manželstva v ústave", category: "Sociálne veci", isPro: false, status: "not_started", sourceUrl: null },
  { partyId: "kdh", promiseText: "Zvýšenie platov učiteľov o 20% do 2027", category: "Školstvo", isPro: true, status: "not_started", sourceUrl: null },
  { partyId: "kdh", promiseText: "Podpora vidieka — investície do infraštruktúry", category: "Regionálny rozvoj", isPro: true, status: "not_started", sourceUrl: null },

  // SaS
  { partyId: "sas", promiseText: "Zníženie odvodov pre živnostníkov", category: "Ekonomika", isPro: true, status: "not_started", sourceUrl: null },
  { partyId: "sas", promiseText: "Zrušenie zbytočnej byrokracie — one-in-two-out pravidlo", category: "Ekonomika", isPro: true, status: "not_started", sourceUrl: null },
  { partyId: "sas", promiseText: "Reforma školstva — fínsky model", category: "Školstvo", isPro: true, status: "not_started", sourceUrl: null },

  // Republika
  { partyId: "republika", promiseText: "Odmietnutie federalizácie EÚ a zachovanie suverenity SR", category: "Zahraničná politika", isPro: false, status: "not_started", sourceUrl: null },
  { partyId: "republika", promiseText: "Prísna ochrana hraníc a nulová tolerancia nelegálnej migrácie", category: "Bezpečnosť", isPro: true, status: "not_started", sourceUrl: null },
  { partyId: "republika", promiseText: "Energetická nezávislosť — rozvoj jadrovej energetiky", category: "Ekonomika", isPro: true, status: "not_started", sourceUrl: null },

  // Demokrati
  { partyId: "demokrati", promiseText: "Podpora vstupu Ukrainy do NATO a EÚ", category: "Zahraničná politika", isPro: true, status: "not_started", sourceUrl: null },
  { partyId: "demokrati", promiseText: "Zníženie korupcie — nezávislá prokuratúra", category: "Justícia", isPro: true, status: "not_started", sourceUrl: null },
];

async function main() {
  const db = getDb();
  await db.delete(partyPromises);
  await db.insert(partyPromises).values(
    PROMISES.map((p) => ({
      partyId: p.partyId,
      promiseText: p.promiseText,
      category: p.category,
      isPro: p.isPro,
      status: p.status,
      sourceUrl: p.sourceUrl,
    }))
  );
  console.log(`Seeded ${PROMISES.length} promises.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
