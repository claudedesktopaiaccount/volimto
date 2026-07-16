export interface VerifiedPartyRegistryIdentity {
  partyId: string;
  ico: string;
  registeredFrom: string;
  registeredTo: string | null;
  sourceUrl: string;
}

/**
 * Legal identities copied from the official register of political parties.
 * A project is treated as a direct party project only on an exact IČO match
 * inside this registration interval. Names are never used for attribution.
 */
export const VERIFIED_PARTY_REGISTRY_IDENTITIES: VerifiedPartyRegistryIdentity[] = [
  party("smer-sd", "31801242", "1999-11-08", 153097),
  party("ps", "51224836", "2017-11-27", 218725),
  party("hlas-sd", "53258070", "2020-09-11", 227017),
  party("kdh", "00586846", "1990-02-23", 152973),
  party("sns", "00677639", "1990-03-07", 152976),
  party("sas", "42139333", "2009-02-27", 153180),
  party("slovensko", "42287511", "2011-11-11", 201471),
  party("demokrati", "51313901", "2018-01-25", 219453),
  party("republika", "31811761", "2002-07-12", 153121),
  party("aliancia", "52695514", "2019-10-22", 224412),
  party("vidieka", "42359741", "2014-03-05", 208014),
];

function party(
  partyId: string,
  ico: string,
  registeredFrom: string,
  registerId: number
): VerifiedPartyRegistryIdentity {
  return {
    partyId,
    ico,
    registeredFrom,
    registeredTo: null,
    sourceUrl: `https://rez.vs.minv.sk/PolitickeStrany/detail?id_spolok=${registerId}`,
  };
}
