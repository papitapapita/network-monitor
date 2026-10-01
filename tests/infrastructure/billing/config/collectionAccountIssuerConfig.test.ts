// Source: src/infrastructure/billing/config/collectionAccountIssuerConfig.ts

import { describe, it, expect } from '@jest/globals';
import {
  loadIssuerDisplayConfig,
  toIssuerConfig
} from '../../../../src/infrastructure/billing/config/collectionAccountIssuerConfig';
import { ISSUER } from '../../../fixtures/vendorSettings';

describe('[BIL-232] issuer config', () => {
  it('reads the logo, locale and time zone from the environment', () => {
    expect(
      loadIssuerDisplayConfig({
        ISSUER_LOGO_PATH: ' /srv/nms/logo.png ',
        ISSUER_LOCALE: 'es-MX',
        ISSUER_TIME_ZONE: 'America/Mexico_City'
      })
    ).toEqual({
      logoPath: '/srv/nms/logo.png',
      locale: 'es-MX',
      timeZone: 'America/Mexico_City'
    });
  });

  it('defaults to no logo, es-CO and Bogotá time', () => {
    expect(loadIssuerDisplayConfig({})).toEqual({
      logoPath: null,
      locale: 'es-CO',
      timeZone: 'America/Bogota'
    });
  });

  it("combines the vendor's issuer with the display settings", () => {
    const config = toIssuerConfig(
      ISSUER,
      loadIssuerDisplayConfig({})
    );

    expect(config).toEqual({
      issuerName: 'Insetel',
      issuerDocumentLabel: 'NIT',
      issuerDocument: '11685533-3',
      issuerAddress: 'Calle 10 # 31-28',
      issuerCity: 'Villavicencio',
      contactPhone: '310 226 3770',
      contactEmail: 'facturacion@insetel.example',
      accentColorHex: '#1F4E79',
      logoPath: null,
      locale: 'es-CO',
      timeZone: 'America/Bogota'
    });
  });
});
