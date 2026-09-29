import { PairingKey } from '../../../../src/application/probe-agents/services/PairingKey';

describe('PairingKey', () => {
  const parts = {
    backendUrl: 'https://api.example.com',
    pairingCode: 'Zm9vYmFy_-abc'
  };

  it('[AGT-001] round-trips the backend URL and the code', () => {
    const key = PairingKey.format(parts);

    expect(PairingKey.parse(key).value).toEqual(parts);
  });

  it('is a single pasteable token with a version prefix', () => {
    const key = PairingKey.format(parts);

    expect(key).toMatch(/^pk1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('tolerates surrounding whitespace from a paste', () => {
    const key = PairingKey.format(parts);

    expect(PairingKey.parse(`  ${key}\n`).value).toEqual(parts);
  });

  it.each([
    ['an unknown version', 'pk2.aHR0cHM6Ly94.code'],
    ['missing segments', 'pk1.code'],
    ['an empty code', 'pk1.aHR0cHM6Ly94.'],
    ['garbage', 'hello world']
  ])('rejects %s', (_label, raw) => {
    expect(PairingKey.parse(raw).isFailure).toBe(true);
  });

  it('rejects a key whose URL is not http(s)', () => {
    const key = PairingKey.format({
      backendUrl: 'ftp://example.com',
      pairingCode: 'code'
    });

    expect(PairingKey.parse(key).error).toContain('bad backend URL');
  });
});
