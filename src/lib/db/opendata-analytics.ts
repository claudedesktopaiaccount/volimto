import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Database } from "./index";
import {
  companies,
  contracts,
  itmsProjectPoliticianLinks,
  itmsProjects,
  mps,
  partyRegistryIdentities,
  parties,
} from "./schema";
import {
  getItmsPoliticalLinkSummary,
  type ItmsPoliticalLinkSummary,
} from "./itms-projects";
import {
  verifiedContractLinkCondition,
  verifiedContractPoliticianJoinCondition,
} from "./verified-contract-links";
import {
  OPENDATA_PAGE_SIZE,
  type OpendataFilters,
} from "@/lib/opendata-dashboard";

export interface OpendataDatasetSummary {
  contractCount: number;
  contractAmount: number;
  supplierCount: number;
  authorityCount: number;
  rpvsCompanyCount: number;
  linkedContractCount: number;
  minDate: string | null;
  maxDate: string | null;
}

export interface OpendataFilteredSummary {
  contractCount: number;
  contractAmount: number;
  medianPositiveAmount: number;
  positiveAmountCount: number;
  zeroAmountCount: number;
  rpvsContractCount: number;
  rpvsContractAmount: number;
  linkedContractCount: number;
  linkedContractAmount: number;
  unusualDateCount: number;
}

export interface OpendataContractRow {
  id: number;
  titleSk: string;
  contractingAuthority: string;
  supplierIco: string;
  supplierName: string;
  amountEur: number;
  signedDate: string;
  sourceUrl: string;
  rpvsCompanyName: string | null;
  rpvsUrl: string | null;
  politicianId: number | null;
  politicianName: string | null;
  partyId: string | null;
  partyName: string | null;
  partyAbbreviation: string | null;
  partyColor: string | null;
}

export interface OpendataCompanyRow {
  id: number;
  name: string;
  ico: string;
  legalForm: string | null;
  addressSk: string | null;
  sourceUrl: string;
  contractCount: number;
  contractAmount: number;
}

export interface OpendataCompanySummary {
  companyCount: number;
  companiesWithContracts: number;
  contractCount: number;
  contractAmount: number;
}

export interface OpendataRankedEntity {
  name: string;
  secondaryLabel: string | null;
  count: number;
  amount: number;
}

export interface OpendataMonthlyPoint {
  month: string;
  count: number;
  amount: number;
}

export interface OpendataPartyRankingRow {
  partyId: string | null;
  partyName: string;
  abbreviation: string;
  color: string;
  contractCount: number;
  politicianCount: number;
  amount: number;
}

export interface OpendataPartyOption {
  id: string;
  name: string;
  abbreviation: string;
}

export interface OpendataLinkedItmsProjectRow {
  id: number;
  itmsId: number;
  projectCode: string;
  titleSk: string;
  recipientIco: string | null;
  recipientName: string | null;
  contractedAmount: number;
  effectiveDate: string | null;
  status: string | null;
  sourceUrl: string;
  politicianId: number;
  politicianName: string;
  currentPartyId: string | null;
  currentPartyName: string | null;
  currentPartyAbbreviation: string | null;
  rpvsRegistrationSourceUrl: string;
  rpvsBeneficialOwnerSourceUrl: string;
  politicianSourceUrl: string;
  verifiedAt: string;
}

export interface OpendataDirectPartyItmsRow {
  id: number;
  itmsId: number;
  projectCode: string;
  titleSk: string;
  recipientIco: string | null;
  contractedAmount: number;
  effectiveDate: string | null;
  sourceUrl: string;
  partyId: string;
  partyName: string;
  partyAbbreviation: string;
  registrySourceUrl: string;
}

export interface OpendataAnalyticsData {
  dataset: OpendataDatasetSummary;
  totals: OpendataFilteredSummary;
  companySummary: OpendataCompanySummary;
  contracts: OpendataContractRow[];
  companies: OpendataCompanyRow[];
  topSuppliers: OpendataRankedEntity[];
  topAuthorities: OpendataRankedEntity[];
  monthly: OpendataMonthlyPoint[];
  partyRanking: OpendataPartyRankingRow[];
  years: string[];
  partyOptions: OpendataPartyOption[];
  legalForms: string[];
  itmsSummary: ItmsPoliticalLinkSummary;
  linkedItmsProjects: OpendataLinkedItmsProjectRow[];
  directPartyItmsProjects: OpendataDirectPartyItmsRow[];
  contractPagination: Pagination;
  companyPagination: Pagination;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

const number = <T extends SQL>(expression: T) => expression.mapWith(Number);

export async function getOpendataAnalytics(
  db: Database,
  filters: OpendataFilters,
  todayIso: string
): Promise<OpendataAnalyticsData> {
  const contractConditions = getContractConditions(filters);
  const contractWhere = whereAll(contractConditions);
  const companyConditions = getCompanyConditions(filters);
  const companyWhere = whereAll(companyConditions);
  const verifiedContractLink = verifiedContractLinkCondition();
  const verifiedPoliticianJoin = verifiedContractPoliticianJoinCondition();

  const contractAmount = number(sql<number>`coalesce(sum(${contracts.amountEur}), 0)`);
  const supplierAmount = number(sql<number>`coalesce(sum(${contracts.amountEur}), 0)`);
  const authorityAmount = number(sql<number>`coalesce(sum(${contracts.amountEur}), 0)`);
  const companyContractAmount = number(sql<number>`coalesce(sum(${contracts.amountEur}), 0)`);
  const monthExpression = sql<string>`substring(${contracts.signedDate}, 1, 7)`;
  const yearExpression = sql<string>`substring(${contracts.signedDate}, 1, 4)`;

  const contractOrder = getContractOrder(filters);
  const companyOrder = filters.companySort === "name"
    ? [asc(companies.name)]
    : [desc(companyContractAmount), asc(companies.name)];

  const [
    datasetContractRows,
    rpvsCompanyCountRows,
    filteredTotalRows,
    contractRows,
    companySummaryRows,
    companyRows,
    supplierRows,
    authorityRows,
    recentMonthlyRows,
    partyRankingRows,
    yearRows,
    partyOptionRows,
    legalFormRows,
    itmsSummary,
    linkedItmsProjectRows,
    directPartyItmsRows,
  ] = await Promise.all([
    db
      .select({
        contractCount: number(sql<number>`count(*)`),
        contractAmount,
        supplierCount: number(sql<number>`count(distinct ${contracts.supplierIco})`),
        authorityCount: number(sql<number>`count(distinct ${contracts.contractingAuthority})`),
        linkedContractCount: number(
          sql<number>`count(*) filter (where ${verifiedContractLink})`
        ),
        minDate: sql<string | null>`min(${contracts.signedDate})`,
        maxDate: sql<string | null>`max(${contracts.signedDate})`,
      })
      .from(contracts),
    db
      .select({
        count: number(sql<number>`count(*)`),
      })
      .from(companies)
      .where(isNotNull(companies.rpvsUboUrl)),
    db
      .select({
        contractCount: number(sql<number>`count(*)`),
        contractAmount,
        medianPositiveAmount: number(sql<number>`coalesce(
          percentile_cont(0.5) within group (
            order by ${contracts.amountEur}
          ) filter (where ${contracts.amountEur} > 0),
          0
        )`),
        positiveAmountCount: number(
          sql<number>`count(*) filter (where ${contracts.amountEur} > 0)`
        ),
        zeroAmountCount: number(
          sql<number>`count(*) filter (where ${contracts.amountEur} <= 0)`
        ),
        rpvsContractCount: number(
          sql<number>`count(*) filter (where ${companies.rpvsUboUrl} is not null)`
        ),
        rpvsContractAmount: number(
          sql<number>`coalesce(sum(${contracts.amountEur}) filter (
            where ${companies.rpvsUboUrl} is not null
          ), 0)`
        ),
        linkedContractCount: number(
          sql<number>`count(*) filter (where ${verifiedContractLink})`
        ),
        linkedContractAmount: number(
          sql<number>`coalesce(sum(${contracts.amountEur}) filter (
            where ${verifiedContractLink}
          ), 0)`
        ),
        unusualDateCount: number(
          sql<number>`count(*) filter (
            where ${contracts.signedDate} < '2011-01-01'
               or ${contracts.signedDate} > ${todayIso}
          )`
        ),
      })
      .from(contracts)
      .leftJoin(companies, eq(contracts.supplierIco, companies.ico))
      .leftJoin(mps, verifiedPoliticianJoin)
      .where(contractWhere),
    db
      .select({
        id: contracts.id,
        titleSk: contracts.titleSk,
        contractingAuthority: contracts.contractingAuthority,
        supplierIco: contracts.supplierIco,
        supplierName: contracts.supplierName,
        amountEur: contracts.amountEur,
        signedDate: contracts.signedDate,
        sourceUrl: contracts.sourceUrl,
        rpvsCompanyName: companies.name,
        rpvsUrl: companies.rpvsUboUrl,
        politicianId: mps.id,
        politicianName: mps.nameDisplay,
        partyId: parties.id,
        partyName: parties.name,
        partyAbbreviation: parties.abbreviation,
        partyColor: parties.color,
      })
      .from(contracts)
      .leftJoin(companies, eq(contracts.supplierIco, companies.ico))
      .leftJoin(mps, verifiedPoliticianJoin)
      .leftJoin(parties, eq(mps.partyId, parties.id))
      .where(contractWhere)
      .orderBy(...contractOrder)
      .limit(OPENDATA_PAGE_SIZE)
      .offset((filters.page - 1) * OPENDATA_PAGE_SIZE),
    db
      .select({
        companyCount: number(sql<number>`count(distinct ${companies.id})`),
        companiesWithContracts: number(
          sql<number>`count(distinct ${companies.id}) filter (where ${contracts.id} is not null)`
        ),
        contractCount: number(sql<number>`count(distinct ${contracts.id})`),
        contractAmount: number(sql<number>`coalesce(sum(${contracts.amountEur}), 0)`),
      })
      .from(companies)
      .leftJoin(contracts, eq(companies.ico, contracts.supplierIco))
      .where(companyWhere),
    db
      .select({
        id: companies.id,
        name: companies.name,
        ico: companies.ico,
        legalForm: companies.legalForm,
        addressSk: companies.addressSk,
        sourceUrl: sql<string>`${companies.rpvsUboUrl}`,
        contractCount: number(sql<number>`count(distinct ${contracts.id})`),
        contractAmount: companyContractAmount,
      })
      .from(companies)
      .leftJoin(contracts, eq(companies.ico, contracts.supplierIco))
      .where(companyWhere)
      .groupBy(
        companies.id,
        companies.name,
        companies.ico,
        companies.legalForm,
        companies.addressSk,
        companies.rpvsUboUrl
      )
      .orderBy(...companyOrder)
      .limit(OPENDATA_PAGE_SIZE)
      .offset((filters.page - 1) * OPENDATA_PAGE_SIZE),
    db
      .select({
        name: sql<string>`max(${contracts.supplierName})`,
        secondaryLabel: contracts.supplierIco,
        count: number(sql<number>`count(*)`),
        amount: supplierAmount,
      })
      .from(contracts)
      .leftJoin(companies, eq(contracts.supplierIco, companies.ico))
      .leftJoin(mps, verifiedPoliticianJoin)
      .where(contractWhere)
      .groupBy(contracts.supplierIco)
      .orderBy(desc(supplierAmount))
      .limit(8),
    db
      .select({
        name: contracts.contractingAuthority,
        secondaryLabel: sql<string | null>`null`,
        count: number(sql<number>`count(*)`),
        amount: authorityAmount,
      })
      .from(contracts)
      .leftJoin(companies, eq(contracts.supplierIco, companies.ico))
      .leftJoin(mps, verifiedPoliticianJoin)
      .where(contractWhere)
      .groupBy(contracts.contractingAuthority)
      .orderBy(desc(authorityAmount))
      .limit(8),
    db
      .select({
        month: monthExpression,
        count: number(sql<number>`count(*)`),
        amount: number(sql<number>`coalesce(sum(${contracts.amountEur}), 0)`),
      })
      .from(contracts)
      .leftJoin(companies, eq(contracts.supplierIco, companies.ico))
      .leftJoin(mps, verifiedPoliticianJoin)
      .where(whereAll([
        ...contractConditions,
        gte(contracts.signedDate, "2011-01-01"),
        lte(contracts.signedDate, todayIso),
      ]))
      .groupBy(monthExpression)
      .orderBy(desc(monthExpression))
      .limit(18),
    db
      .select({
        partyId: mps.partyId,
        partyName: sql<string>`coalesce(${parties.name}, 'Nezaradení')`,
        abbreviation: sql<string>`coalesce(${parties.abbreviation}, 'NEZ')`,
        color: sql<string>`coalesce(${parties.color}, '#888888')`,
        contractCount: number(sql<number>`count(*)`),
        politicianCount: number(sql<number>`count(distinct ${mps.id})`),
        amount: number(sql<number>`coalesce(sum(${contracts.amountEur}), 0)`),
      })
      .from(contracts)
      .leftJoin(companies, eq(contracts.supplierIco, companies.ico))
      .innerJoin(mps, verifiedPoliticianJoin)
      .leftJoin(parties, eq(mps.partyId, parties.id))
      .where(whereAll([
        ...contractConditions,
        verifiedContractLink,
      ]))
      .groupBy(mps.partyId, parties.name, parties.abbreviation, parties.color)
      .orderBy(desc(sql`sum(${contracts.amountEur})`)),
    db
      .select({ year: yearExpression })
      .from(contracts)
      .where(sql`${contracts.signedDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`)
      .groupBy(yearExpression)
      .orderBy(desc(yearExpression)),
    db
      .select({
        id: parties.id,
        name: parties.name,
        abbreviation: parties.abbreviation,
      })
      .from(contracts)
      .innerJoin(mps, verifiedPoliticianJoin)
      .innerJoin(parties, eq(mps.partyId, parties.id))
      .where(verifiedContractLink)
      .groupBy(parties.id, parties.name, parties.abbreviation)
      .orderBy(asc(parties.name)),
    db
      .select({ legalForm: companies.legalForm })
      .from(companies)
      .where(and(
        isNotNull(companies.rpvsUboUrl),
        isNotNull(companies.legalForm)
      ))
      .groupBy(companies.legalForm)
      .orderBy(asc(companies.legalForm)),
    getItmsPoliticalLinkSummary(db),
    db
      .select({
        id: itmsProjects.id,
        itmsId: itmsProjects.itmsId,
        projectCode: itmsProjects.projectCode,
        titleSk: itmsProjects.titleSk,
        recipientIco: itmsProjects.recipientIco,
        recipientName: companies.name,
        contractedAmount: itmsProjects.contractedAmount,
        effectiveDate: itmsProjects.effectiveDate,
        status: itmsProjects.status,
        sourceUrl: itmsProjects.sourceUrl,
        politicianId: mps.id,
        politicianName: mps.nameDisplay,
        currentPartyId: parties.id,
        currentPartyName: parties.name,
        currentPartyAbbreviation: parties.abbreviation,
        rpvsRegistrationSourceUrl: itmsProjectPoliticianLinks.rpvsRegistrationSourceUrl,
        rpvsBeneficialOwnerSourceUrl: itmsProjectPoliticianLinks.rpvsBeneficialOwnerSourceUrl,
        politicianSourceUrl: itmsProjectPoliticianLinks.politicianSourceUrl,
        verifiedAt: itmsProjectPoliticianLinks.verifiedAt,
      })
      .from(itmsProjectPoliticianLinks)
      .innerJoin(itmsProjects, eq(itmsProjectPoliticianLinks.projectId, itmsProjects.id))
      .innerJoin(mps, eq(itmsProjectPoliticianLinks.mpId, mps.id))
      .leftJoin(parties, eq(mps.partyId, parties.id))
      .leftJoin(companies, eq(itmsProjects.recipientIco, companies.ico))
      .orderBy(desc(itmsProjects.effectiveDate), desc(itmsProjects.contractedAmount))
      .limit(100),
    db
      .select({
        id: itmsProjects.id,
        itmsId: itmsProjects.itmsId,
        projectCode: itmsProjects.projectCode,
        titleSk: itmsProjects.titleSk,
        recipientIco: itmsProjects.recipientIco,
        contractedAmount: itmsProjects.contractedAmount,
        effectiveDate: itmsProjects.effectiveDate,
        sourceUrl: itmsProjects.sourceUrl,
        partyId: parties.id,
        partyName: parties.name,
        partyAbbreviation: parties.abbreviation,
        registrySourceUrl: partyRegistryIdentities.sourceUrl,
      })
      .from(itmsProjects)
      .innerJoin(
        partyRegistryIdentities,
        sql`${partyRegistryIdentities.ico} = ${itmsProjects.recipientIco}
          and ${itmsProjects.effectiveDate} is not null
          and (${partyRegistryIdentities.registeredFrom} is null
            or ${itmsProjects.effectiveDate} >= ${partyRegistryIdentities.registeredFrom})
          and (${partyRegistryIdentities.registeredTo} is null
            or ${itmsProjects.effectiveDate} <= ${partyRegistryIdentities.registeredTo})`
      )
      .innerJoin(parties, eq(partyRegistryIdentities.partyId, parties.id))
      .orderBy(desc(itmsProjects.effectiveDate), desc(itmsProjects.contractedAmount))
      .limit(100),
  ]);

  const datasetContracts = datasetContractRows[0] ?? {
    contractCount: 0,
    contractAmount: 0,
    supplierCount: 0,
    authorityCount: 0,
    linkedContractCount: 0,
    minDate: null,
    maxDate: null,
  };
  const totals = filteredTotalRows[0] ?? emptyFilteredSummary();
  const companySummary = companySummaryRows[0] ?? {
    companyCount: 0,
    companiesWithContracts: 0,
    contractCount: 0,
    contractAmount: 0,
  };

  return {
    dataset: {
      ...datasetContracts,
      rpvsCompanyCount: rpvsCompanyCountRows[0]?.count ?? 0,
    },
    totals,
    companySummary,
    contracts: contractRows,
    companies: companyRows,
    topSuppliers: supplierRows,
    topAuthorities: authorityRows,
    monthly: recentMonthlyRows.reverse(),
    partyRanking: partyRankingRows,
    years: yearRows.map((row) => row.year),
    partyOptions: partyOptionRows,
    legalForms: legalFormRows
      .map((row) => row.legalForm)
      .filter((value): value is string => Boolean(value)),
    itmsSummary,
    linkedItmsProjects: linkedItmsProjectRows,
    directPartyItmsProjects: directPartyItmsRows,
    contractPagination: pagination(filters.page, totals.contractCount),
    companyPagination: pagination(filters.page, companySummary.companyCount),
  };
}

function getContractConditions(filters: OpendataFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.query) {
    const pattern = `%${filters.query}%`;
    const search = or(
      ilike(contracts.titleSk, pattern),
      ilike(contracts.supplierName, pattern),
      ilike(contracts.supplierIco, pattern),
      ilike(contracts.contractingAuthority, pattern)
    );
    if (search) conditions.push(search);
  }

  if (filters.year) {
    conditions.push(
      gte(contracts.signedDate, `${filters.year}-01-01`),
      lte(contracts.signedDate, `${filters.year}-12-31`)
    );
  }

  switch (filters.amount) {
    case "known":
      conditions.push(gt(contracts.amountEur, 0));
      break;
    case "zero":
      conditions.push(lte(contracts.amountEur, 0));
      break;
    case "10k":
      conditions.push(gte(contracts.amountEur, 10_000));
      break;
    case "100k":
      conditions.push(gte(contracts.amountEur, 100_000));
      break;
    case "1m":
      conditions.push(gte(contracts.amountEur, 1_000_000));
      break;
  }

  if (filters.rpvs === "in-rpvs") {
    conditions.push(isNotNull(companies.rpvsUboUrl));
  } else if (filters.rpvs === "not-in-rpvs") {
    conditions.push(isNull(companies.rpvsUboUrl));
  }

  if (filters.link === "linked") {
    conditions.push(verifiedContractLinkCondition());
  } else if (filters.link === "unlinked") {
    conditions.push(sql`not (${verifiedContractLinkCondition()})`);
  }

  if (filters.partyId) {
    conditions.push(eq(mps.partyId, filters.partyId));
  }

  return conditions;
}

function getCompanyConditions(filters: OpendataFilters): SQL[] {
  const conditions: SQL[] = [isNotNull(companies.rpvsUboUrl)];

  if (filters.query) {
    const pattern = `%${filters.query}%`;
    const search = or(
      ilike(companies.name, pattern),
      ilike(companies.ico, pattern),
      ilike(companies.legalForm, pattern),
      ilike(companies.addressSk, pattern)
    );
    if (search) conditions.push(search);
  }

  if (filters.legalForm) {
    conditions.push(eq(companies.legalForm, filters.legalForm));
  }

  return conditions;
}

function getContractOrder(filters: OpendataFilters) {
  switch (filters.sort) {
    case "oldest":
      return [asc(contracts.signedDate), asc(contracts.id)];
    case "highest":
      return [desc(contracts.amountEur), desc(contracts.signedDate)];
    case "lowest":
      return [asc(contracts.amountEur), desc(contracts.signedDate)];
    default:
      return [desc(contracts.signedDate), desc(contracts.id)];
  }
}

function whereAll(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function pagination(page: number, totalCount: number): Pagination {
  return {
    page,
    pageSize: OPENDATA_PAGE_SIZE,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / OPENDATA_PAGE_SIZE)),
  };
}

function emptyFilteredSummary(): OpendataFilteredSummary {
  return {
    contractCount: 0,
    contractAmount: 0,
    medianPositiveAmount: 0,
    positiveAmountCount: 0,
    zeroAmountCount: 0,
    rpvsContractCount: 0,
    rpvsContractAmount: 0,
    linkedContractCount: 0,
    linkedContractAmount: 0,
    unusualDateCount: 0,
  };
}
