import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  scrapeRpvsCompanies,
  scrapePublicContracts,
  getKnownDonations,
} from "@/lib/scraper/opendata";
import {
  linkContractsToVerifiedPoliticians,
  upsertCompanies,
  upsertContracts,
  upsertDonations,
  upsertVerifiedPoliticianCompanyLinks,
} from "@/lib/db/opendata";
import { isCronAuthed } from "@/lib/cron-auth";
import { VERIFIED_POLITICIAN_COMPANY_LINKS } from "@/lib/verified-financial-links";

export async function GET(req: NextRequest) {
  if (!(await isCronAuthed(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();

    // Companies from RPVS OpenData
    const companyItems = await scrapeRpvsCompanies(500);
    const companyCount = await upsertCompanies(db, companyItems);
    const verifiedCompanyLinkCount = await upsertVerifiedPoliticianCompanyLinks(
      db,
      VERIFIED_POLITICIAN_COMPANY_LINKS
    );

    // Public contracts from CRZ
    const contractItems = await scrapePublicContracts(500);
    const contractCount = await upsertContracts(db, contractItems);
    const linkedContractCount = await linkContractsToVerifiedPoliticians(
      db,
      VERIFIED_POLITICIAN_COMPANY_LINKS
    );

    // Known donations (static seed from public reports)
    const donationItems = getKnownDonations();
    const donationCount = await upsertDonations(db, donationItems);

    return NextResponse.json({
      ok: true,
      companies: {
        scraped: companyItems.length,
        upserted: companyCount,
        verifiedLinks: verifiedCompanyLinkCount,
      },
      contracts: {
        scraped: contractItems.length,
        upserted: contractCount,
        linkedToPoliticians: linkedContractCount,
      },
      donations: { seeded: donationItems.length, inserted: donationCount },
    });
  } catch (error) {
    console.error("[cron] scrape-opendata error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
