// Source: src/infrastructure/billing/config/collectionAccountIssuerConfig.ts

import { describe, it, expect } from '@jest/globals';
import { loadCollectionAccountIssuerConfig } from '../../../../src/infrastructure/billing/config/collectionAccountIssuerConfig';

function makeEnv(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return {
    ISSUER_NAME: 'Test ISP',
    ISSUER_DOCUMENT: '900123456-7',
    ISSUER_ADDRESS: 'Calle 1 # 2-3',
    ISSUER_CITY: 'Villavicencio',
    ISSUER_CONTACT_PHONE: '300 000 0000',
    ISSUER_CONTACT_EMAIL: 'billing@test-isp.example',
    ...overrides
  };
}

describe('[BIL-232] loadCollectionAccountIssuerConfig', () => {
  it('reads the issuer from the environment', () => {
    const config = loadCollectionAccountIssuerConfig(makeEnv());

    expect(config).toEqual({
      issuerName: 'Test ISP',
      issuerDocumentLabel: 'NIT',
      issuerDocument: '900123456-7',
      issuerAddress: 'Calle 1 # 2-3',
      issuerCity: 'Villavicencio',
      contactPhone: '300 000 0000',
      contactEmail: 'billing@test-isp.example',
      accentColorHex: '#1F4E79',
      logoPath: null,
      locale: 'es-CO',
      timeZone: 'America/Bogota'
    });
  });

  it('uses the optional settings when they are given', () => {
    const config = loadCollectionAccountIssuerConfig(
      makeEnv({
        ISSUER_DOCUMENT_LABEL: 'CC',
        ISSUER_ACCENT_COLOR: '#000000',
        ISSUER_LOGO_PATH: '/srv/logo.png',
        ISSUER_LOCALE: 'es-MX',
        ISSUER_TIME_ZONE: 'America/Mexico_City'
      })
    );

    expect(config.issuerDocumentLabel).toBe('CC');
    expect(config.accentColorHex).toBe('#000000');
    expect(config.logoPath).toBe('/srv/logo.png');
    expect(config.locale).toBe('es-MX');
    expect(config.timeZone).toBe('America/Mexico_City');
  });

  it('trims surrounding whitespace', () => {
    const config = loadCollectionAccountIssuerConfig(
      makeEnv({ ISSUER_NAME: '  Test ISP  ' })
    );

    expect(config.issuerName).toBe('Test ISP');
  });

  it('refuses to load with every missing required setting named', () => {
    expect(() =>
      loadCollectionAccountIssuerConfig(
        makeEnv({ ISSUER_NAME: undefined, ISSUER_CITY: '   ' })
      )
    ).toThrow(
      'Billing is enabled but the issuer is not configured: ISSUER_NAME, ISSUER_CITY'
    );
  });
});
