export interface CollectionAccountIssuerConfig {
  issuerName: string;
  issuerDocumentLabel: string;
  issuerDocument: string;
  issuerAddress: string;
  issuerCity: string;
  contactPhone: string;
  contactEmail: string;
  // One line per payment channel, printed verbatim under "Forma de pago".
  paymentInstructions: string[];
  accentColorHex: string;
  // Filesystem path pdfkit's doc.image() can load directly. Null skips the
  // logo entirely.
  logoPath: string | null;
  locale: string;
  timeZone: string;
}

// Neutral placeholder identity. Swap these values for the real issuer —
// nothing else in the renderer needs to change.
export const collectionAccountIssuerConfig: CollectionAccountIssuerConfig =
  {
    issuerName: 'Your Company Name',
    issuerDocumentLabel: 'NIT',
    issuerDocument: '000.000.000-0',
    issuerAddress: 'Calle 0 # 0-00',
    issuerCity: 'Ciudad',
    contactPhone: '+57 300 000 0000',
    contactEmail: 'facturacion@yourcompany.com',
    paymentInstructions: [
      'Transferencia a cuenta de ahorros Banco XXXX No. 000-000000-00'
    ],
    accentColorHex: '#1F4E79',
    logoPath: null,
    locale: 'es-CO',
    timeZone: 'America/Bogota'
  };
