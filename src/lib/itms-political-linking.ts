import { inArray } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { mps } from "@/lib/db/schema";
import {
  fetchRpvsBeneficialOwners,
  fetchRpvsPartnerRegistrations,
  resolveItmsRpvsPoliticianLinks,
  type ItmsProject,
  type RpvsBeneficialOwner,
  type RpvsPartnerRegistration,
} from "@/lib/scraper/itms-projects";
import { VERIFIED_POLITICIAN_COMPANY_LINKS } from "@/lib/verified-financial-links";

export interface ItmsPoliticalDiscovery {
  verifiedLinks: ReturnType<typeof resolveItmsRpvsPoliticianLinks>["verifiedLinks"];
  ambiguousIdentities: ReturnType<typeof resolveItmsRpvsPoliticianLinks>["ambiguousIdentities"];
  missingPoliticianSlugs: string[];
  inspectedIcos: number;
  inspectedRpvsPartners: number;
}

interface DiscoveryDependencies {
  fetchRegistrations: (ico: string) => Promise<RpvsPartnerRegistration[]>;
  fetchOwners: (partnerId: number) => Promise<RpvsBeneficialOwner[]>;
}

const defaultDependencies: DiscoveryDependencies = {
  fetchRegistrations: fetchRpvsPartnerRegistrations,
  fetchOwners: fetchRpvsBeneficialOwners,
};

/**
 * Revalidate the conservative identity manifest against live RPVS history and
 * the current ITMS project set. Nothing is linked from a name alone.
 */
export async function discoverVerifiedItmsPoliticalLinks(
  db: Database,
  projects: ItmsProject[],
  dependencies: DiscoveryDependencies = defaultDependencies
): Promise<ItmsPoliticalDiscovery> {
  const slugs = [...new Set(VERIFIED_POLITICIAN_COMPANY_LINKS.map((link) => link.mpSlug))];
  const mpRows = slugs.length === 0
    ? []
    : await db
      .select({ id: mps.id, slug: mps.slug })
      .from(mps)
      .where(inArray(mps.slug, slugs));
  const mpIdBySlug = new Map(mpRows.map((row) => [row.slug, row.id]));

  const identityBySlug = new Map(
    VERIFIED_POLITICIAN_COMPANY_LINKS.map((link) => [link.mpSlug, link] as const)
  );
  const politicians = [...identityBySlug.values()].flatMap((identity) => {
    const politicianId = mpIdBySlug.get(identity.mpSlug);
    return politicianId === undefined
      ? []
      : [{
        politicianId,
        givenName: identity.politicianGivenName,
        familyName: identity.politicianFamilyName,
        birthDate: identity.identityBirthDate,
        sourceUrl: identity.identitySourceUrl,
      }];
  });

  const icos = [...new Set(VERIFIED_POLITICIAN_COMPANY_LINKS.map((link) => link.ico))];
  const registrations = (
    await Promise.all(icos.map((ico) => dependencies.fetchRegistrations(ico)))
  ).flat();
  const partnerIds = [...new Set(registrations.map((registration) => registration.partnerId))];
  const beneficialOwners = (
    await Promise.all(partnerIds.map((partnerId) => dependencies.fetchOwners(partnerId)))
  ).flat();

  const resolution = resolveItmsRpvsPoliticianLinks({
    projects,
    registrations,
    beneficialOwners,
    politicians,
  });

  return {
    ...resolution,
    missingPoliticianSlugs: slugs.filter((slug) => !mpIdBySlug.has(slug)),
    inspectedIcos: icos.length,
    inspectedRpvsPartners: partnerIds.length,
  };
}
