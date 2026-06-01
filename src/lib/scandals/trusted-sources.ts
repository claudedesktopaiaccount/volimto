export type ScandalSourceType =
  | "primary_public"
  | "court_or_prosecution"
  | "audit_or_control"
  | "registry"
  | "trusted_media"
  | "ngo_investigation"
  | "untrusted";

export interface ScandalSourceClassification {
  trusted: boolean;
  sourceType: ScandalSourceType;
  outletName: string;
}

const TRUSTED_HOSTS: Record<string, Omit<ScandalSourceClassification, "trusted">> = {
  "zastavmekorupciu.sk": {
    sourceType: "ngo_investigation",
    outletName: "Nadacia Zastavme korupciu",
  },
  "dennikn.sk": { sourceType: "trusted_media", outletName: "Dennik N" },
  "sme.sk": { sourceType: "trusted_media", outletName: "SME" },
  "aktuality.sk": { sourceType: "trusted_media", outletName: "Aktuality" },
  "tasr.sk": { sourceType: "trusted_media", outletName: "TASR" },
  "icjk.sk": { sourceType: "trusted_media", outletName: "ICJK" },
  "eppo.europa.eu": { sourceType: "court_or_prosecution", outletName: "EPPO" },
  "olaf.ec.europa.eu": { sourceType: "audit_or_control", outletName: "OLAF" },
  "nku.gov.sk": { sourceType: "audit_or_control", outletName: "NKU" },
  "uvo.gov.sk": { sourceType: "audit_or_control", outletName: "UVO" },
  "genpro.gov.sk": { sourceType: "court_or_prosecution", outletName: "Generalna prokuratura SR" },
  "justice.gov.sk": { sourceType: "court_or_prosecution", outletName: "Ministerstvo spravodlivosti SR" },
  "obcan.justice.sk": { sourceType: "registry", outletName: "Obchodny register" },
  "crz.gov.sk": { sourceType: "registry", outletName: "Centralny register zmluv" },
  "registeruz.sk": { sourceType: "registry", outletName: "Register uctovnych zavierok" },
  "orsr.sk": { sourceType: "registry", outletName: "Obchodny register" },
  "rpvs.gov.sk": { sourceType: "registry", outletName: "RPVS" },
  "land.gov.sk": { sourceType: "primary_public", outletName: "Ministerstvo podohospodarstva SR" },
  "apa.sk": { sourceType: "primary_public", outletName: "PPA" },
};

const EXCLUDED_HOSTS = new Set([
  "stvr.sk",
  "spravy.stvr.sk",
  "rtvs.sk",
]);

export function classifyScandalSource(url: string): ScandalSourceClassification {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { trusted: false, sourceType: "untrusted", outletName: "Neplatny zdroj" };
  }

  if (EXCLUDED_HOSTS.has(host) || [...EXCLUDED_HOSTS].some((excluded) => host.endsWith(`.${excluded}`))) {
    return { trusted: false, sourceType: "untrusted", outletName: host };
  }

  const direct = TRUSTED_HOSTS[host];
  if (direct) return { trusted: true, ...direct };

  const parent = Object.entries(TRUSTED_HOSTS).find(([trustedHost]) => host.endsWith(`.${trustedHost}`));
  if (parent) return { trusted: true, ...parent[1] };

  return { trusted: false, sourceType: "untrusted", outletName: host };
}

export function isTrustedScandalSource(url: string) {
  return classifyScandalSource(url).trusted;
}
