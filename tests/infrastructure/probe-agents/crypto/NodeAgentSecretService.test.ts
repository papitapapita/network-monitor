import { NodeAgentSecretService } from '../../../../src/infrastructure/probe-agents/crypto';

describe('NodeAgentSecretService', () => {
  const service = new NodeAgentSecretService();

  it('generates 256-bit url-safe secrets', () => {
    const secret = service.generate();

    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never repeats a secret', () => {
    const secrets = new Set(
      Array.from({ length: 100 }, () => service.generate())
    );

    expect(secrets.size).toBe(100);
  });

  it('hashes to a stable SHA-256 hex digest', () => {
    expect(service.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});
