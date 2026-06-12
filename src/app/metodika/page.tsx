import type { Metadata } from "next";
import MetodikaClient from "./MetodikaClient";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Metodika",
  description:
    "Ako VolimTo zbiera data, pocita prieskumy, predikcie, mandaty, povolebne plany, kauzy a otvorene data.",
  openGraph: {
    title: "Metodika | VolimTo",
    description:
      "Interaktivne vysvetlenie metodiky VolimTo: prieskumy, predikcia, D'Hondt, zdroje dat a limity interpretacie.",
  },
};

export default function MetodikaPage() {
  return <MetodikaClient />;
}
