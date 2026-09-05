export interface QuotationBrandingConfig {
  companyName: string;
  accentColorHex: string;
  contactPhone: string;
  contactEmail: string;
  // Filesystem path pdfkit's doc.image() can load directly. Null skips the
  // logo block entirely — swap in a real asset path once one exists.
  logoPath: string | null;
  currencySymbol: string;
}

// Neutral placeholder identity. Swap these values for the real company's
// branding — nothing else in the renderer needs to change.
export const quotationBrandingConfig: QuotationBrandingConfig = {
  companyName: 'Your Company Name',
  accentColorHex: '#1F4E79',
  contactPhone: '+1 (000) 000-0000',
  contactEmail: 'sales@yourcompany.com',
  logoPath: null,
  currencySymbol: '$'
};
