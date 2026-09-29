import {
  formatPairingKey,
  parsePairingKey
} from '../../../src/agent/protocol/pairingKey';

describe('pairing key', () => {
  const parts = {
    backendUrl: 'https://api.example.com',
    pairingCode: 'Zm9vYmFy_-abc'
  };

  it('[AGT-001] round-trips the backend URL and the code', () => {
    const key = formatPairingKey(parts);

    expect(parsePairingKey(key)).toEqual(parts);
  });

  it('is a single pasteable token with a version prefix', () => {
    const key = formatPairingKey(parts);

    expect(key).toMatch(/^pk1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('tolerates surrounding whitespace from a paste', () => {
    const key = formatPairingKey(parts);

    expect(parsePairingKey(`  ${key}\n`)).toEqual(parts);
  });

  it.each([
    ['an unknown version', 'pk2.aHR0cHM6Ly94.code'],
    ['missing segments', 'pk1.code'],
    ['an empty code', 'pk1.aHR0cHM6Ly94.'],
    ['garbage', 'hello world']
  ])('rejects %s', (_label, raw) => {
    expect(parsePairingKey(raw)).toBeNull();
  });

  it('rejects a key whose URL is not http(s)', () => {
    const key = formatPairingKey({
      backendUrl: 'ftp://example.com',
      pairingCode: 'code'
    });

    expect(parsePairingKey(key)).toBeNull();
  });
});
