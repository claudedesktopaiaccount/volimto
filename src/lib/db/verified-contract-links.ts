import { and, eq, sql, type SQL } from "drizzle-orm";
import {
  companies,
  contracts,
  mps,
  politicianCompanyLinks,
} from "./schema";

/**
 * Public CRZ attribution is valid only when the stored politician ID is backed
 * by a reviewed company relationship for the exact supplier IČO and contract
 * date. A bare or legacy contracts.linkedPoliticianId is never enough.
 */
export function verifiedContractLinkCondition(): SQL<boolean> {
  return sql<boolean>`
    ${contracts.linkedPoliticianId} is not null
    and exists (
      select 1
      from ${politicianCompanyLinks}
      inner join ${companies}
        on ${companies.id} = ${politicianCompanyLinks.companyId}
      where ${politicianCompanyLinks.mpId} = ${contracts.linkedPoliticianId}
        and ${companies.ico} = ${contracts.supplierIco}
        and ${politicianCompanyLinks.reviewStatus} = 'verified'
        and (${politicianCompanyLinks.startDate} is null
          or ${politicianCompanyLinks.startDate} <= ${contracts.signedDate})
        and (${politicianCompanyLinks.endDate} is null
          or ${politicianCompanyLinks.endDate} >= ${contracts.signedDate})
    )
  `;
}

export function verifiedContractPoliticianJoinCondition(): SQL {
  return and(
    eq(contracts.linkedPoliticianId, mps.id),
    verifiedContractLinkCondition()
  )!;
}
