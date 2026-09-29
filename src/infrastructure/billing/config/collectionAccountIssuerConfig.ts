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

const REQUIRED = {
  issuerName: 'ISSUER_NAME',
  issuerDocument: 'ISSUER_DOCUMENT',
  issuerAddress: 'ISSUER_ADDRESS',
  issuerCity: 'ISSUER_CITY',
  contactPhone: 'ISSUER_CONTACT_PHONE',
  contactEmail: 'ISSUER_CONTACT_EMAIL'
} as const;

// Issuer identity printed on every cuenta de cobro — one per install, so it
// comes from the environment. Bank accounts are not here: they are managed
// through /api/bank-accounts and picked per document.
export function loadCollectionAccountIssuerConfig(
  env: NodeJS.ProcessEnv
): CollectionAccountIssuerConfig {
  const missing = Object.values(REQUIRED).filter(
    (name) => !env[name]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `Billing is enabled but the issuer is not configured: ${missing.join(', ')}`
    );
  }

  const read = (name: string): string => env[name]!.trim();
  const readOr = (name: string, fallback: string): string =>
    env[name]?.trim() || fallback;

  return {
    issuerName: read(REQUIRED.issuerName),
    issuerDocumentLabel: readOr('ISSUER_DOCUMENT_LABEL', 'NIT'),
    issuerDocument: read(REQUIRED.issuerDocument),
    issuerAddress: read(REQUIRED.issuerAddress),
    issuerCity: read(REQUIRED.issuerCity),
    contactPhone: read(REQUIRED.contactPhone),
    contactEmail: read(REQUIRED.contactEmail),
    accentColorHex: readOr('ISSUER_ACCENT_COLOR', '#1F4E79'),
    logoPath: env.ISSUER_LOGO_PATH?.trim() || null,
    locale: readOr('ISSUER_LOCALE', 'es-CO'),
    timeZone: readOr('ISSUER_TIME_ZONE', 'America/Bogota')
  };
}
