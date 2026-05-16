import type { Metadata } from "next";
import SectionHeading from "@/components/ui/SectionHeading";
import DeleteDataButton from "./DeleteDataButton";
import ExportDataButton from "./ExportDataButton";
import ConsentManager from "./ConsentManager";

export const metadata: Metadata = {
  title: "Ochrana súkromia",
  description: "Informácie o spracovaní osobných údajov na stránke VolímTo.",
};

export default function SukromiePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SectionHeading title="Ochrana súkromia" />

      <div className="space-y-8 text-text">
        <section>
          <h2 className="font-serif text-xl font-bold text-ink mt-8 mb-3">Aké údaje zbierame</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>
              <strong className="text-ink">Cookies:</strong> Ukladáme anonymný identifikátor návštevníka (<code className="text-xs bg-hover px-1 py-0.5">pt_visitor</code>) a CSRF token
              (<code className="text-xs bg-hover px-1 py-0.5">pt_csrf</code>) na zabezpečenie funkčnosti a ochranu pred útokmi.
            </li>
            <li>
              <strong className="text-ink">Fingerprinting (len so súhlasom):</strong> Ak udelíte súhlas, vytvoríme hash z technických
              parametrov prehliadača. Hash slúži výhradne na zabránenie duplicitným hlasom v sekcii Tipovanie.
            </li>
            <li>
              <strong className="text-ink">IP adresa:</strong> Používame ju dočasne na rate limiting. Neukladáme ju do databázy.
            </li>
            <li>
              <strong className="text-ink">Používateľský účet (voliteľné):</strong> Ak sa zaregistrujete, ukladáme vašu e-mailovú adresu,
              zobrazované meno a bezpečne hashované heslo (PBKDF2-SHA256). Heslo v čitateľnej podobe nikdy neukladáme.
            </li>
          </ul>
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Účel spracovania</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>Zabránenie duplicitným hlasom v sekcii Tipovanie</li>
            <li>Ochranu pred automatizovanými útokmi (rate limiting)</li>
            <li>CSRF ochranu formulárov</li>
            <li>Správu používateľského účtu a prepojenie predpovedí naprieč zariadeniami</li>
          </ul>
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Doba uchovávania</h2>
          <p className="text-sm">
            Údaje o hlasovaní uchovávame po dobu trvania volebného cyklu. Cookie identifikátor má platnosť
            1 rok. Údaje z používateľského účtu uchovávame do vymazania účtu. Údaje môžete kedykoľvek
            vymazať pomocou tlačidla nižšie alebo v sekcii Profil.
          </p>
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Vaše práva (GDPR)</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong className="text-ink">Prístup</strong> — vedieť, aké údaje o vás máme</li>
            <li><strong className="text-ink">Vymazanie</strong> — požiadať o odstránenie všetkých vašich údajov</li>
            <li><strong className="text-ink">Odvolanie súhlasu</strong> — kedykoľvek odvolať súhlas s fingerprintingom</li>
            <li><strong className="text-ink">Prenosnosť (čl. 20)</strong> — získať vaše údaje v strojovo čitateľnom formáte (JSON export)</li>
          </ul>
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Správa súhlasu</h2>
          <p className="text-sm mb-4">Tu môžete zmeniť váš súhlas s fingerprintingom prehliadača.</p>
          <ConsentManager />
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Stiahnuť moje údaje</h2>
          <p className="text-sm mb-4">Stiahnite si všetky údaje, ktoré o vás máme, vo formáte JSON.</p>
          <ExportDataButton />
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Vymazať moje údaje</h2>
          <p className="text-sm mb-4">Kliknutím na tlačidlo nižšie vymažeme všetky vaše hlasovanie a cookie identifikátor.</p>
          <DeleteDataButton />
        </section>

        <section className="border-t border-divider pt-6">
          <h2 className="font-serif text-xl font-bold text-ink mb-3">Tretie strany</h2>
          <p className="text-sm">
            Stránka je hostovaná na Vercel. Nepoužívame žiadne analytické nástroje tretích strán
            ani reklamné siete. Údaje nezdieľame so žiadnymi tretími stranami.
          </p>
        </section>
      </div>
    </div>
  );
}
