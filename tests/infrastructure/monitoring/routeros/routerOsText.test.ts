// Source: src/infrastructure/monitoring/routeros/routerOsText.ts

import { fromRouterOsText } from '../../../../src/infrastructure/monitoring/routeros/routerOsText';

// What node-routeros makes of UTF-8 bytes: each byte read as Windows-1252.
function asRead(text: string): string {
  return new TextDecoder('windows-1252').decode(
    new TextEncoder().encode(text)
  );
}

describe('fromRouterOsText', () => {
  it('[MON-200] restores UTF-8 text read as Windows-1252', () => {
    expect(asRead('Virgüez')).toBe('VirgÃ¼ez');
    expect(fromRouterOsText(asRead('Virgüez'))).toBe('Virgüez');
    expect(fromRouterOsText(asRead('Torre Peñón — AP 3'))).toBe(
      'Torre Peñón — AP 3'
    );
  });

  it('[MON-200] keeps text typed as Windows-1252, which is not UTF-8', () => {
    expect(fromRouterOsText('Peña')).toBe('Peña');
  });

  it('[MON-200] leaves plain ASCII alone', () => {
    expect(fromRouterOsText('ether2 AP 32')).toBe('ether2 AP 32');
  });

  it('[MON-200] leaves text with characters Windows-1252 cannot hold', () => {
    expect(fromRouterOsText('AP ✓')).toBe('AP ✓');
  });
});
