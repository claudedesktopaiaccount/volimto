export interface ScrapedCompany {
  ico: string;
  name: string;
  legalForm: string | null;
  rpvsUboUrl: string | null;
  addressSk: string | null;
}

export interface ScrapedContract {
  contractNumber: string | null;
  titleSk: string;
  contractingAuthority: string;
  supplierIco: string;
  supplierName: string;
  amountEur: number;
  signedDate: string;
  cpvCode: string | null;
  sourceUrl: string;
}

export interface ScrapedDonation {
  partyId: string;
  donorName: string;
  donorIco: string | null;
  amountEur: number;
  donationDate: string;
  sourceUrl: string;
}
