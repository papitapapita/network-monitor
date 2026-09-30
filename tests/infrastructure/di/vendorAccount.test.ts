// Source: src/infrastructure/di/vendorAccount.ts

import { loadVendorAccount } from '../../../src/infrastructure/di/vendorAccount';

describe('[IDN-011] loadVendorAccount', () => {
  it('returns null when no vendor account is configured', () => {
    expect(loadVendorAccount({})).toBeNull();
  });

  it('treats a blank email as unset', () => {
    expect(loadVendorAccount({ VENDOR_EMAIL: '  ' })).toBeNull();
  });

  it('returns the email and password', () => {
    expect(
      loadVendorAccount({
        VENDOR_EMAIL: ' owner@isp.example ',
        VENDOR_PASSWORD: 'secret-secret'
      })
    ).toEqual({
      email: 'owner@isp.example',
      password: 'secret-secret'
    });
  });

  it('accepts an email without a password', () => {
    expect(
      loadVendorAccount({ VENDOR_EMAIL: 'owner@isp.example' })
    ).toEqual({ email: 'owner@isp.example', password: undefined });
  });

  it('stops the boot on a password with no email', () => {
    expect(() =>
      loadVendorAccount({ VENDOR_PASSWORD: 'secret-secret' })
    ).toThrow('VENDOR_PASSWORD is set but VENDOR_EMAIL is not');
  });
});
