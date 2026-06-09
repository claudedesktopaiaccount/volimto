export const GEMINI_REVIEW_MODEL_DEFAULT = "gemini-2.5-flash";

export const GEMINI_REVIEW_WORKFLOW = [
  "Načíta len trusted zdroje priradené ku kauze a existujúce draftové claimy.",
  "Porovná claimy s textom zdrojov a so známymi aktérmi v databáze.",
  "Upraví slovenské texty do neutrálneho editorského štýlu bez vlastného právneho verdiktu.",
  "Vráti štruktúrovaný JSON: rozhodnutie, istotu, dôvod a upravený draft.",
  "Server ešte raz odfiltruje nedovolené zdroje a nepublikovateľné claimy pred uložením.",
] as const;

export const GEMINI_APPROVAL_CRITERIA = [
  "Každý publikovaný actor claim má jasnú oporu v načítanom trusted zdroji.",
  "Zdroj claimu je v zozname povolených URL pre danú kauzu.",
  "Text rozlišuje podozrenie, procesný stav a právoplatný výsledok.",
  "Formulácia nepripisuje vinu aplikácii a zachováva prezumpciu neviny.",
  "Claim obsahuje relevantnosť, dôkazový výsek, procesný status a protiargument alebo obmedzenie tam, kde je potrebné.",
] as const;

export const GEMINI_REJECTION_CRITERIA = [
  "Draft nemá zdrojovo doložené claimy alebo je založený na nedôveryhodnom zdroji.",
  "Text tvrdí vinu, pridáva neoverené fakty, osoby, právny stav alebo citácie.",
  "Claim sa nedá spárovať so známym aktérom alebo jasným predmetom kauzy.",
  "Zdrojový text je nedostupný alebo neobsahuje tvrdenie, ktoré má byť publikované.",
  "JSON claimov je po úprave nepublikovateľný alebo nespĺňa minimálne validácie.",
] as const;

export const GEMINI_MANUAL_REVIEW_CRITERIA = [
  "Dôkaz je čiastočný, nejasný alebo závisí od kontextu, ktorý zdroj neobsahuje.",
  "Gemini upraví texty, ale nemá dosť istoty na automatické schválenie alebo zamietnutie.",
  "Nepodarilo sa načítať text trusted zdroja; server vtedy automatické schválenie zmení na ručnú kontrolu.",
  "Kauza je právne citlivá alebo obsahuje viac možných interpretácií procesného stavu.",
] as const;
