export const GEMINI_REVIEW_MODEL_DEFAULT = "gemini-2.5-flash";

export const GEMINI_REVIEW_WORKFLOW = [
  "Nacita len trusted zdroje priradene ku kauze a existujuce draftove claimy.",
  "Porovna claimy s textom zdrojov a so znamymi aktormi v databaze.",
  "Upravi slovenske texty do neutralneho editorskeho stylu bez vlastneho pravneho verdiktu.",
  "Vrati strukturovany JSON: rozhodnutie, istotu, dovod a upraveny draft.",
  "Server este raz odfiltruje nedovolene zdroje a nepublikovatelne claimy pred ulozenim.",
] as const;

export const GEMINI_APPROVAL_CRITERIA = [
  "Kazdy publikovany actor claim ma jasnu oporu v nacitanom trusted zdroji.",
  "Zdroj claimu je v zozname povolenych URL pre danu kauzu.",
  "Text rozlisuje podozrenie, procesny stav a pravoplatny vysledok.",
  "Formulacia nepripisuje vinu aplikacii a zachovava prezumpciu neviny.",
  "Claim obsahuje relevantnost, dokazovy vysek, procesny status a protiargument alebo obmedzenie tam, kde je potrebne.",
] as const;

export const GEMINI_REJECTION_CRITERIA = [
  "Draft nema zdrojovo dolozene claimy alebo je zalozeny na nedoveryhodnom zdroji.",
  "Text tvrdi vinu, pridava neoverene fakty, osoby, pravny stav alebo citacie.",
  "Claim sa neda sparovat so znamym aktorom alebo jasnym predmetom kauzy.",
  "Zdrojovy text je nedostupny alebo neobsahuje tvrdenie, ktore ma byt publikovane.",
  "JSON claimov je po uprave nepublikovatelny alebo nesplna minimalne validacie.",
] as const;

export const GEMINI_MANUAL_REVIEW_CRITERIA = [
  "Dokaz je ciastocny, nejasny alebo zavisi od kontextu, ktory zdroj neobsahuje.",
  "Gemini upravi texty, ale nema dost istoty na automaticke schvalenie alebo zamietnutie.",
  "Nepodarilo sa nacitat text trusted zdroja; server vtedy automaticke schvalenie zmeni na rucnu kontrolu.",
  "Kauza je pravne citliva alebo obsahuje viac moznych interpretacii procesneho stavu.",
] as const;
