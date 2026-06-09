import Link from "next/link";

export default function AdminDashboard() {
  const sections = [
    { href: "/admin/promises", label: "Programové sľuby strán", desc: "Pridať, importovať a zmazať sľuby" },
    { href: "/admin/polls", label: "Manuálne zadanie prieskumu", desc: "Pridať výsledky prieskumu" },
    { href: "/admin/kalkulator", label: "Volebný kalkulátor", desc: "Upraviť váhy odpovedí pre strany" },
    { href: "/admin/kauzy", label: "Kauzy", desc: "Skontrolovať a schváliť AI analýzy" },
  ];

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-bold text-ink">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block border border-divider p-5 transition-colors hover:border-ink"
          >
            <div className="mb-1 font-semibold text-ink">{section.label}</div>
            <div className="text-sm text-muted">{section.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
