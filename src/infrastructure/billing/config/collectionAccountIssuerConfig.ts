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

// Issuer identity printed on every cuenta de cobro. Bank accounts are not here:
// they are managed through /api/bank-accounts and picked per document.
export const collectionAccountIssuerConfig: CollectionAccountIssuerConfig =
  {
    issuerName: 'Insetel',
    issuerDocumentLabel: 'NIT',
    issuerDocument: '11685533-3',
    issuerAddress: 'Calle 10 # 31-28, Villavicencio, Meta',
    issuerCity: 'Villavicencio',
    contactPhone: '310 226 3770',
    contactEmail: 'insetelseguridad@hotmail.com',
    accentColorHex: '#1F4E79',
    logoPath: null,
    locale: 'es-CO',
    timeZone: 'America/Bogota'
  };
