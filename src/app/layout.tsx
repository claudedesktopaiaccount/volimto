import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import GdprBanner from "@/components/GdprBanner";
import UmamiAnalytics from "@/components/UmamiAnalytics";
import ThemeProvider from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { ViewTransition } from "react";
import PageNumber from "@/components/PageNumber";
import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  ELECTION_DATE_ESTIMATE,
} from "@/lib/site-config";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "VolímTo — Slovenské prieskumy a predikcie",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    siteName: SITE_NAME,
    title: "VolímTo — Slovenské prieskumy a predikcie",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "VolímTo — Slovenské prieskumy a predikcie",
    description: SITE_DESCRIPTION,
  },
};

const SW_REGISTRATION_SCRIPT = `if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});})}`;

function getInitialDaysUntilElection(): number {
  return Math.ceil((ELECTION_DATE_ESTIMATE.getTime() - Date.now()) / 86_400_000);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = (cookieStore.get("theme")?.value as "light" | "dark") || "light";
  const initialDaysUntilElection = getInitialDaysUntilElection();

  return (
    <html
      lang="sk"
      className={`${theme} ${dmSans.variable} ${dmSerifDisplay.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#111110" />
        {/* Service worker registration — static string, no user input */}
        <script
          dangerouslySetInnerHTML={{ __html: SW_REGISTRATION_SCRIPT }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  name: SITE_NAME,
                  url: SITE_URL,
                  description: SITE_DESCRIPTION,
                  inLanguage: "sk",
                  publisher: { "@id": `${SITE_URL}/#organization` },
                },
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  name: SITE_NAME,
                  url: SITE_URL,
                },
              ],
            }),
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider initialTheme={theme}>
          <AuthProvider>
            <a href="#main-content" className="skip-link">
              Preskočiť na obsah
            </a>
            <Navbar initialDays={initialDaysUntilElection} />
            <main id="main-content" className="pb-16 lg:pb-0" style={{ viewTransitionName: "page-content" }}>
              <ViewTransition>{children}</ViewTransition>
            </main>
            <Footer />
            <PageNumber />
            <GdprBanner />
            <UmamiAnalytics />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
