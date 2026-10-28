// Source: src/application/wireless-monitoring/services/matchReportedModel.ts

import {
  matchReportedModel,
  normalizeModelName
} from '../../../../src/application/wireless-monitoring/services/matchReportedModel';

describe('[WLS-152] matchReportedModel', () => {
  const catalog = [
    { id: 'a', model: 'NanoStation Loco-M5', vendorId: 'other' },
    { id: 'b', model: 'Nanostation loco M5', vendorId: 'ubnt' },
    { id: 'c', model: 'Rocket 5AC Lite', vendorId: 'ubnt' }
  ];

  it('should ignore case, spaces and punctuation when normalizing', () => {
    expect(normalizeModelName(' NanoStation  loco-M5 ')).toBe(
      normalizeModelName('nanostationlocom5')
    );
  });

  it('should prefer the match from the preferred vendor', () => {
    expect(
      matchReportedModel('NanoStation loco M5', catalog, 'ubnt')?.id
    ).toBe('b');
  });

  it('should fall back to any vendor when the preferred one has no match', () => {
    expect(
      matchReportedModel('NanoStation loco M5', catalog, 'mimosa')?.id
    ).toBe('a');
  });

  it('should return null when nothing in the catalog matches', () => {
    expect(
      matchReportedModel('LiteBeam 5AC Gen2', catalog, 'ubnt')
    ).toBeNull();
  });

  it('[WLS-155] should fall back to the single model confirmed for the name', () => {
    expect(
      matchReportedModel('LBE-5AC-Gen2', catalog, 'ubnt', ['c'])?.id
    ).toBe('c');
  });

  it('[WLS-155] should prefer a name match over a confirmed model', () => {
    expect(
      matchReportedModel('Rocket 5AC Lite', catalog, 'ubnt', ['a'])
        ?.id
    ).toBe('c');
  });

  it('[WLS-155] should return null when the name was confirmed for several models', () => {
    expect(
      matchReportedModel('LBE-5AC-Gen2', catalog, 'ubnt', ['a', 'c'])
    ).toBeNull();
  });
});
