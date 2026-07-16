const ITMS_BASE_URL = "https://opendata.itms2014.sk";
const RPVS_ODATA_BASE_URL = "https://rpvs.gov.sk/opendatav2";
const MAX_RPVS_ODATA_PAGES = 1_000;

export const ITMS_PROJECT_COLLECTIONS = ["vrealizacii", "ukoncene"] as const;

export type ItmsProjectCollection = (typeof ITMS_PROJECT_COLLECTIONS)[number];

export const ITMS_PROJECT_COLLECTION_URLS: Record<ItmsProjectCollection, string> = {
  vrealizacii: `${ITMS_BASE_URL}/v2/projekty/vrealizacii`,
  ukoncene: `${ITMS_BASE_URL}/v2/projekty/ukoncene`,
};

export interface ItmsProject {
  sourceSystem: "itms2014+";
  sourceCollection: ItmsProjectCollection;
  sourceState: ItmsProjectCollection;
  sourceRecordId: string;
  externalId: number;
  code: string;
  name: string;
  contractNumber: string | null;
  contractValidDate: string | null;
  contractEffectiveDate: string | null;
  associationDate: string | null;
  associationDateBasis: "contract_effective_date" | "contract_valid_date" | null;
  contractedAmount: number;
  recipientSubjectId: number;
  recipientIco: string | null;
  recipientForeignIdentifier: string | null;
  recipientSourceUrl: string;
  status: string | null;
  focus: string | null;
  sourceUrl: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface RpvsPartnerRegistration {
  registrationId: number;
  partnerId: number;
  partnerFileNumber: number | null;
  ico: string;
  name: string;
  validFrom: string;
  validTo: string | null;
  sourceUrl: string;
  apiSourceUrl: string;
}

export interface RpvsBeneficialOwner {
  beneficialOwnerId: number;
  partnerId: number;
  givenName: string;
  familyName: string;
  birthDate: string | null;
  isPublicOfficial: boolean | null;
  validFrom: string;
  validTo: string | null;
  sourceUrl: string;
}

/**
 * An identity from an authoritative politician source, currently the NRSR
 * profile. Full date of birth is deliberately required by the matcher; a
 * birth year or name-only record is not sufficient evidence.
 */
export interface VerifiedPoliticianIdentity {
  politicianId: number;
  givenName: string;
  familyName: string;
  birthDate: string | null;
  sourceUrl: string;
}

export interface VerifiedItmsRpvsPoliticianLink {
  pathType: "itms_recipient_rpvs_beneficial_owner";
  projectExternalId: number;
  projectCode: string;
  recipientIco: string;
  eventDate: string;
  eventDateBasis: "contract_effective_date" | "contract_valid_date";
  rpvsRegistrationId: number;
  rpvsPartnerId: number;
  rpvsBeneficialOwnerId: number;
  rpvsPublicOfficialFlag: boolean | null;
  politicianId: number;
  projectSourceUrl: string;
  rpvsRegistrationSourceUrl: string;
  rpvsBeneficialOwnerSourceUrl: string;
  politicianSourceUrl: string;
}

export interface AmbiguousItmsRpvsPoliticianIdentity {
  reason: "duplicate_exact_name_and_birth_date";
  projectExternalId: number;
  rpvsRegistrationId: number;
  rpvsBeneficialOwnerId: number;
  candidatePoliticianIds: number[];
}

export interface ItmsRpvsPoliticianResolution {
  verifiedLinks: VerifiedItmsRpvsPoliticianLink[];
  ambiguousIdentities: AmbiguousItmsRpvsPoliticianIdentity[];
}

export type JsonFetcher = (url: string) => Promise<unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJson(raw: unknown, label: string): unknown {
  if (typeof raw !== "string") return raw;

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`${label} is not valid JSON`, { cause: error });
  }
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function optionalSafeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function requiredNonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
  return value;
}

function requiredBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Normalize an official ISO/Slovak date without shifting it across time zones. */
export function normalizeSourceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  const slovak = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  const year = iso ? Number(iso[1]) : slovak ? Number(slovak[3]) : NaN;
  const month = iso ? Number(iso[2]) : slovak ? Number(slovak[2]) : NaN;
  const day = iso ? Number(iso[3]) : slovak ? Number(slovak[1]) : NaN;
  if (!isRealCalendarDate(year, month, day)) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function requiredSourceDate(value: unknown, label: string): string {
  const date = normalizeSourceDate(value);
  if (!date) throw new Error(`${label} must contain a valid full date`);
  return date;
}

/**
 * Normalize a Slovak IČO conservatively. Only whitespace may be removed; other
 * punctuation or letters make the identifier unusable for an exact join.
 */
export function normalizeSlovakIco(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const compact = String(value).replace(/[\s\u00a0]+/g, "");
  if (!/^\d{6,8}$/.test(compact)) return null;
  return compact.padStart(8, "0");
}

function normalizeIdentityName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sk-SK");
}

function canonicalItmsProjectUrl(collection: ItmsProjectCollection, id: number): string {
  return `${ITMS_PROJECT_COLLECTION_URLS[collection]}/${id}`;
}

export function buildItmsSubjectUrl(subjectId: number): string {
  if (!Number.isSafeInteger(subjectId) || subjectId <= 0) {
    throw new Error("ITMS subject ID must be a positive safe integer");
  }
  return `${ITMS_BASE_URL}/v2/subjekty/${subjectId}`;
}

/** Parse one official ITMS project collection response atomically. */
export function parseItmsProjectCollection(
  raw: unknown,
  collection: ItmsProjectCollection
): ItmsProject[] {
  const parsed = parseJson(raw, `ITMS ${collection} response`);
  if (!Array.isArray(parsed)) {
    throw new Error(`ITMS ${collection} response must be an array`);
  }

  return parsed.map((value, index) => {
    const label = `ITMS ${collection} record ${index}`;
    const item = requiredRecord(value, label);
    const id = requiredSafeInteger(item.id, `${label}.id`);
    const recipient = requiredRecord(item.prijimatel, `${label}.prijimatel`);
    const subject = requiredRecord(recipient.subjekt, `${label}.prijimatel.subjekt`);
    const subjectId = requiredSafeInteger(subject.id, `${label}.prijimatel.subjekt.id`);
    const amount = requiredNonNegativeNumber(item.sumaZazmluvnena, `${label}.sumaZazmluvnena`);
    const effectiveDate = normalizeSourceDate(item.datumUcinnostiZmluvy);
    const validDate = normalizeSourceDate(item.datumPlatnostiZmluvy);
    const associationDate = effectiveDate ?? validDate;

    return {
      sourceSystem: "itms2014+" as const,
      sourceCollection: collection,
      sourceState: collection,
      sourceRecordId: String(id),
      externalId: id,
      code: requiredString(item.kod, `${label}.kod`),
      name: requiredString(item.nazov, `${label}.nazov`),
      contractNumber: optionalString(item.cisloZmluvy),
      contractValidDate: validDate,
      contractEffectiveDate: effectiveDate,
      associationDate,
      associationDateBasis: effectiveDate
        ? "contract_effective_date" as const
        : validDate
          ? "contract_valid_date" as const
          : null,
      contractedAmount: amount,
      recipientSubjectId: subjectId,
      recipientIco: normalizeSlovakIco(subject.ico),
      recipientForeignIdentifier: optionalString(subject.ineIdentifikacneCislo),
      recipientSourceUrl: buildItmsSubjectUrl(subjectId),
      status: optionalString(item.stav),
      focus: optionalString(item.zameranieProjektu),
      sourceUrl: canonicalItmsProjectUrl(collection, id),
      createdAt: requiredString(item.createdAt, `${label}.createdAt`),
      updatedAt: optionalString(item.updatedAt),
    };
  });
}

export function buildRpvsPartnerRegistrationsUrl(ico: string): string {
  const normalizedIco = normalizeSlovakIco(ico);
  if (!normalizedIco) throw new Error("RPVS IČO must be a valid Slovak IČO");

  const url = new URL(`${RPVS_ODATA_BASE_URL}/PartneriVerejnehoSektora`);
  url.searchParams.set("$filter", `Ico eq '${normalizedIco}'`);
  url.searchParams.set("$expand", "Partner");
  return url.toString();
}

export function buildRpvsBeneficialOwnersUrl(partnerId: number): string {
  if (!Number.isSafeInteger(partnerId) || partnerId <= 0) {
    throw new Error("RPVS Partner ID must be a positive safe integer");
  }

  const url = new URL(`${RPVS_ODATA_BASE_URL}/KonecniUzivateliaVyhod`);
  url.searchParams.set("$filter", `Partner/Id eq ${partnerId}`);
  url.searchParams.set("$expand", "Partner");
  return url.toString();
}

function parseOdataItems(raw: unknown, label: string): unknown[] {
  const parsed = parseJson(raw, label);
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.value)) return parsed.value;
  throw new Error(`${label} must be an OData value array`);
}

function parseOdataPage(
  raw: unknown,
  label: string
): { items: unknown[]; nextLink: string | null } {
  const parsed = parseJson(raw, label);
  if (Array.isArray(parsed)) return { items: parsed, nextLink: null };
  if (!isRecord(parsed) || !Array.isArray(parsed.value)) {
    throw new Error(`${label} must be an OData value array`);
  }

  const nextLink = parsed["@odata.nextLink"];
  if (nextLink === undefined || nextLink === null || nextLink === "") {
    return { items: parsed.value, nextLink: null };
  }
  if (typeof nextLink !== "string" || !nextLink.trim()) {
    throw new Error(`${label} has a malformed @odata.nextLink`);
  }
  return { items: parsed.value, nextLink: nextLink.trim() };
}

function safeRpvsNextLink(nextLink: string, collection: string): string {
  let url: URL;
  try {
    url = new URL(nextLink, `${RPVS_ODATA_BASE_URL}/`);
  } catch (error) {
    throw new Error("Unsafe RPVS OData nextLink", { cause: error });
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "rpvs.gov.sk" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== `/opendatav2/${collection}`
  ) {
    throw new Error("Unsafe RPVS OData nextLink");
  }
  return url.toString();
}

async function fetchCompleteRpvsOdataCollection(
  initialUrl: string,
  collection: "PartneriVerejnehoSektora" | "KonecniUzivateliaVyhod",
  fetcher: JsonFetcher
): Promise<{ value: unknown[] }> {
  const items: unknown[] = [];
  const visited = new Set<string>();
  let url: string | null = initialUrl;

  while (url) {
    if (visited.has(url)) throw new Error("RPVS OData pagination loop detected");
    if (visited.size >= MAX_RPVS_ODATA_PAGES) {
      throw new Error("RPVS OData pagination exceeded the safety limit");
    }
    visited.add(url);

    const page = parseOdataPage(await fetcher(url), `RPVS ${collection} response`);
    items.push(...page.items);
    url = page.nextLink ? safeRpvsNextLink(page.nextLink, collection) : null;
  }

  return { value: items };
}

/** Keep every historical PVS registration row; do not deduplicate by IČO. */
export function parseRpvsPartnerRegistrations(raw: unknown): RpvsPartnerRegistration[] {
  return parseOdataItems(raw, "RPVS PartneriVerejnehoSektora response").map(
    (value, index) => {
      const label = `RPVS PVS record ${index}`;
      const item = requiredRecord(value, label);
      const partner = requiredRecord(item.Partner, `${label}.Partner`);
      const registrationId = requiredSafeInteger(item.Id, `${label}.Id`);
      const partnerId = requiredSafeInteger(partner.Id, `${label}.Partner.Id`);
      const ico = normalizeSlovakIco(item.Ico);
      if (!ico) throw new Error(`${label}.Ico must be a valid Slovak IČO`);
      const validFrom = requiredSourceDate(item.PlatnostOd, `${label}.PlatnostOd`);
      const validTo = normalizeSourceDate(item.PlatnostDo);
      if (validTo && validTo < validFrom) {
        throw new Error(`${label} has an inverted validity interval`);
      }

      return {
        registrationId,
        partnerId,
        partnerFileNumber: optionalSafeInteger(partner.CisloVlozky),
        ico,
        name: requiredString(item.ObchodneMeno, `${label}.ObchodneMeno`),
        validFrom,
        validTo,
        sourceUrl: `https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/${partnerId}`,
        apiSourceUrl: buildRpvsPartnerRegistrationsUrl(ico),
      };
    }
  );
}

/** Parse the RPVS KUV collection including full DOB and historical validity. */
export function parseRpvsBeneficialOwners(raw: unknown): RpvsBeneficialOwner[] {
  return parseOdataItems(raw, "RPVS KonecniUzivateliaVyhod response").map(
    (value, index) => {
      const label = `RPVS KUV record ${index}`;
      const item = requiredRecord(value, label);
      const partner = requiredRecord(item.Partner, `${label}.Partner`);
      const partnerId = requiredSafeInteger(partner.Id, `${label}.Partner.Id`);
      const validFrom = requiredSourceDate(item.PlatnostOd, `${label}.PlatnostOd`);
      const validTo = normalizeSourceDate(item.PlatnostDo);
      if (validTo && validTo < validFrom) {
        throw new Error(`${label} has an inverted validity interval`);
      }

      return {
        beneficialOwnerId: requiredSafeInteger(item.Id, `${label}.Id`),
        partnerId,
        givenName: requiredString(item.Meno, `${label}.Meno`),
        familyName: requiredString(item.Priezvisko, `${label}.Priezvisko`),
        birthDate: normalizeSourceDate(item.DatumNarodenia),
        isPublicOfficial: requiredBooleanOrNull(item.JeVerejnyCinitel),
        validFrom,
        validTo,
        sourceUrl: buildRpvsBeneficialOwnersUrl(partnerId),
      };
    }
  );
}

function isDateWithin(
  date: string,
  interval: { validFrom: string; validTo: string | null }
): boolean {
  return date >= interval.validFrom && (interval.validTo === null || date <= interval.validTo);
}

function identityKey(givenName: string, familyName: string, birthDate: string): string {
  return [
    normalizeIdentityName(givenName),
    normalizeIdentityName(familyName),
    birthDate,
  ].join("\u0000");
}

/**
 * Resolve only evidence-complete ITMS -> recipient IČO -> PVS Partner -> KUV
 * -> politician paths. The event date must fall inside both RPVS intervals,
 * and the KUV identity must equal exactly one politician by name + full DOB.
 */
export function resolveItmsRpvsPoliticianLinks(input: {
  projects: ItmsProject[];
  registrations: RpvsPartnerRegistration[];
  beneficialOwners: RpvsBeneficialOwner[];
  politicians: VerifiedPoliticianIdentity[];
}): ItmsRpvsPoliticianResolution {
  const politicianIdsByIdentity = new Map<string, Set<number>>();
  const politiciansById = new Map<number, VerifiedPoliticianIdentity>();

  for (const politician of input.politicians) {
    const birthDate = normalizeSourceDate(politician.birthDate);
    if (!birthDate) continue;
    const key = identityKey(politician.givenName, politician.familyName, birthDate);
    const ids = politicianIdsByIdentity.get(key) ?? new Set<number>();
    ids.add(politician.politicianId);
    politicianIdsByIdentity.set(key, ids);
    politiciansById.set(politician.politicianId, politician);
  }

  const verifiedLinks: VerifiedItmsRpvsPoliticianLink[] = [];
  const ambiguousIdentities: AmbiguousItmsRpvsPoliticianIdentity[] = [];
  const seenVerifiedPaths = new Set<string>();
  const seenAmbiguousPaths = new Set<string>();

  for (const project of input.projects) {
    if (!project.recipientIco || !project.associationDate || !project.associationDateBasis) {
      continue;
    }

    const registrations = input.registrations.filter(
      (registration) =>
        registration.ico === project.recipientIco &&
        isDateWithin(project.associationDate as string, registration)
    );

    for (const registration of registrations) {
      const owners = input.beneficialOwners.filter(
        (owner) =>
          owner.partnerId === registration.partnerId &&
          isDateWithin(project.associationDate as string, owner)
      );

      for (const owner of owners) {
        if (!owner.birthDate) continue;
        const key = identityKey(owner.givenName, owner.familyName, owner.birthDate);
        const candidateIds = [...(politicianIdsByIdentity.get(key) ?? [])].sort((a, b) => a - b);
        if (candidateIds.length === 0) continue;

        if (candidateIds.length > 1) {
          const pathKey = [project.externalId, registration.registrationId, owner.beneficialOwnerId].join(":");
          if (!seenAmbiguousPaths.has(pathKey)) {
            seenAmbiguousPaths.add(pathKey);
            ambiguousIdentities.push({
              reason: "duplicate_exact_name_and_birth_date",
              projectExternalId: project.externalId,
              rpvsRegistrationId: registration.registrationId,
              rpvsBeneficialOwnerId: owner.beneficialOwnerId,
              candidatePoliticianIds: candidateIds,
            });
          }
          continue;
        }

        const politicianId = candidateIds[0];
        const politician = politiciansById.get(politicianId);
        if (!politician) continue;
        const pathKey = [
          project.externalId,
          registration.registrationId,
          owner.beneficialOwnerId,
          politicianId,
        ].join(":");
        if (seenVerifiedPaths.has(pathKey)) continue;
        seenVerifiedPaths.add(pathKey);

        verifiedLinks.push({
          pathType: "itms_recipient_rpvs_beneficial_owner",
          projectExternalId: project.externalId,
          projectCode: project.code,
          recipientIco: project.recipientIco,
          eventDate: project.associationDate,
          eventDateBasis: project.associationDateBasis,
          rpvsRegistrationId: registration.registrationId,
          rpvsPartnerId: registration.partnerId,
          rpvsBeneficialOwnerId: owner.beneficialOwnerId,
          rpvsPublicOfficialFlag: owner.isPublicOfficial,
          politicianId,
          projectSourceUrl: project.sourceUrl,
          rpvsRegistrationSourceUrl: registration.sourceUrl,
          rpvsBeneficialOwnerSourceUrl: owner.sourceUrl,
          politicianSourceUrl: politician.sourceUrl,
        });
      }
    }
  }

  verifiedLinks.sort((a, b) =>
    a.projectExternalId - b.projectExternalId ||
    a.rpvsRegistrationId - b.rpvsRegistrationId ||
    a.rpvsBeneficialOwnerId - b.rpvsBeneficialOwnerId ||
    a.politicianId - b.politicianId
  );
  ambiguousIdentities.sort((a, b) =>
    a.projectExternalId - b.projectExternalId ||
    a.rpvsRegistrationId - b.rpvsRegistrationId ||
    a.rpvsBeneficialOwnerId - b.rpvsBeneficialOwnerId
  );

  return { verifiedLinks, ambiguousIdentities };
}

async function defaultJsonFetcher(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OpenData fetch failed with HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function fetchItmsProjectCollection(
  collection: ItmsProjectCollection,
  fetcher: JsonFetcher = defaultJsonFetcher
): Promise<ItmsProject[]> {
  const url = new URL(ITMS_PROJECT_COLLECTION_URLS[collection]);
  url.searchParams.set("limit", "1000000");
  const raw = await fetcher(url.toString());
  return parseItmsProjectCollection(raw, collection);
}

export async function fetchAllItmsProjects(
  fetcher: JsonFetcher = defaultJsonFetcher
): Promise<ItmsProject[]> {
  const collections = await Promise.all(
    ITMS_PROJECT_COLLECTIONS.map((collection) =>
      fetchItmsProjectCollection(collection, fetcher)
    )
  );

  // A project keeps its numeric ID when it moves from vrealizacii to ukoncene.
  // The completed collection is processed last and wins a transition race.
  const byExternalId = new Map<number, ItmsProject>();
  for (const project of collections.flat()) {
    byExternalId.set(project.externalId, project);
  }
  return [...byExternalId.values()];
}

export async function fetchRpvsPartnerRegistrations(
  ico: string,
  fetcher: JsonFetcher = defaultJsonFetcher
): Promise<RpvsPartnerRegistration[]> {
  const raw = await fetchCompleteRpvsOdataCollection(
    buildRpvsPartnerRegistrationsUrl(ico),
    "PartneriVerejnehoSektora",
    fetcher
  );
  return parseRpvsPartnerRegistrations(raw);
}

export async function fetchRpvsBeneficialOwners(
  partnerId: number,
  fetcher: JsonFetcher = defaultJsonFetcher
): Promise<RpvsBeneficialOwner[]> {
  const raw = await fetchCompleteRpvsOdataCollection(
    buildRpvsBeneficialOwnersUrl(partnerId),
    "KonecniUzivateliaVyhod",
    fetcher
  );
  return parseRpvsBeneficialOwners(raw);
}
