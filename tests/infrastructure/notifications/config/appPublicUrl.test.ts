import { loadAppPublicUrl } from '../../../../src/infrastructure/notifications/config/appPublicUrl';

describe('loadAppPublicUrl', () => {
  it('returns null when unset or blank', () => {
    expect(loadAppPublicUrl({})).toBeNull();
    expect(loadAppPublicUrl({ APP_PUBLIC_URL: '  ' })).toBeNull();
  });

  it('keeps an origin as is', () => {
    expect(
      loadAppPublicUrl({ APP_PUBLIC_URL: 'http://192.168.1.10:3001' })
    ).toBe('http://192.168.1.10:3001');
  });

  it('drops a trailing slash', () => {
    expect(
      loadAppPublicUrl({ APP_PUBLIC_URL: 'https://app.example.com/' })
    ).toBe('https://app.example.com');
  });

  it('keeps a base path', () => {
    expect(
      loadAppPublicUrl({ APP_PUBLIC_URL: 'https://example.com/nms/' })
    ).toBe('https://example.com/nms');
  });

  it('rejects a malformed URL', () => {
    expect(() =>
      loadAppPublicUrl({ APP_PUBLIC_URL: 'not a url' })
    ).toThrow('APP_PUBLIC_URL is not a valid URL');
  });

  it('rejects a non-http scheme', () => {
    expect(() =>
      loadAppPublicUrl({ APP_PUBLIC_URL: 'ftp://example.com' })
    ).toThrow('APP_PUBLIC_URL must be an http(s) URL');
  });

  it('rejects a query string', () => {
    expect(() =>
      loadAppPublicUrl({ APP_PUBLIC_URL: 'https://example.com/?a=1' })
    ).toThrow('must not carry a query or fragment');
  });
});
