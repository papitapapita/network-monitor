import { IssuerSettingsProps } from 'domain/shared/props';

export interface CollectionAccountIssuerConfig {
  issuerName: string;
  issuerDocumentLabel: string;
  issuerDocument: string;
  issuerAddress: string;
  issuerCity: string;
  contactPhone: string;
  contactEmail: string;
  accentColorHex: string;
  // Filesystem path pdfkit's doc.image() can load directly. Null skips the
  // logo entirely.
  logoPath: string | null;
  locale: string;
  timeZone: string;
}

// What stays in env: a file on the server, and formatting every install of a
// Colombian ISP shares. The issuer's identity is the vendor's setting
// (BIL-232, INS-028).
export interface IssuerDisplayConfig {
  logoPath: string | null;
  locale: string;
  timeZone: string;
}

export function loadIssuerDisplayConfig(
  env: NodeJS.ProcessEnv
): IssuerDisplayConfig {
  return {
    logoPath: env.ISSUER_LOGO_PATH?.trim() || null,
    locale: env.ISSUER_LOCALE?.trim() || 'es-CO',
    timeZone: env.ISSUER_TIME_ZONE?.trim() || 'America/Bogota'
  };
}

export function toIssuerConfig(
  issuer: IssuerSettingsProps,
  display: IssuerDisplayConfig
): CollectionAccountIssuerConfig {
  return {
    issuerName: issuer.name,
    issuerDocumentLabel: issuer.documentLabel,
    issuerDocument: issuer.document,
    issuerAddress: issuer.address,
    issuerCity: issuer.city,
    contactPhone: issuer.contactPhone,
    contactEmail: issuer.contactEmail,
    accentColorHex: issuer.accentColorHex,
    ...display
  };
}
