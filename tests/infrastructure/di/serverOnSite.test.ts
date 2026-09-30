import { loadServerOnSite } from '../../../src/infrastructure/di/serverOnSite';

describe('loadServerOnSite', () => {
  it.each([
    [undefined, true],
    ['', true],
    ['true', true],
    [' TRUE ', true],
    ['false', false],
    ['False', false]
  ])('[INS-041] %p → %p', (value, expected) => {
    expect(loadServerOnSite({ SERVER_ON_SITE: value })).toBe(
      expected
    );
  });

  it('[INS-041] stops the boot on anything else', () => {
    expect(() => loadServerOnSite({ SERVER_ON_SITE: 'no' })).toThrow(
      'SERVER_ON_SITE: expected true or false, got "no"'
    );
  });
});
