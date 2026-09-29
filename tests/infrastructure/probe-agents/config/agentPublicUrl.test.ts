import { loadAgentPublicUrl } from '../../../../src/infrastructure/probe-agents/config';

describe('loadAgentPublicUrl', () => {
  it('[AGT-007] returns null when unset or blank', () => {
    expect(loadAgentPublicUrl({})).toBeNull();
    expect(loadAgentPublicUrl({ AGENT_PUBLIC_URL: '  ' })).toBeNull();
  });

  it('normalises to the origin', () => {
    expect(
      loadAgentPublicUrl({
        AGENT_PUBLIC_URL: 'https://api.example.com/'
      })
    ).toBe('https://api.example.com');
  });

  it('keeps an explicit port', () => {
    expect(
      loadAgentPublicUrl({ AGENT_PUBLIC_URL: 'http://10.0.0.5:3000' })
    ).toBe('http://10.0.0.5:3000');
  });

  it.each([
    ['not a URL', 'api.example.com'],
    ['a non-http scheme', 'ftp://api.example.com'],
    ['a path', 'https://api.example.com/api']
  ])('[AGT-007] stops the boot on %s', (_label, value) => {
    expect(() =>
      loadAgentPublicUrl({ AGENT_PUBLIC_URL: value })
    ).toThrow(/AGENT_PUBLIC_URL/);
  });
});
