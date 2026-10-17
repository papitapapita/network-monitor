// Source: src/domain/power-control/services/PoePortLabel.ts

import { PoePortLabel } from '../../../../src/domain/power-control';

describe('PoePortLabel', () => {
  describe('[PWR-030] ipOf', () => {
    it.each([
      ['10.0.5.21', '10.0.5.21'],
      ['AP-10.0.5.21', '10.0.5.21'],
      ['10.0.5.21 rocket', '10.0.5.21'],
      ['rocket(192.168.1.20)', '192.168.1.20']
    ])('should read the IP in "%s"', (label, ip) => {
      expect(PoePortLabel.ipOf(label)).toBe(ip);
    });

    it('should take the first valid IP when there are several', () => {
      expect(PoePortLabel.ipOf('10.0.5.21 / 10.0.5.22')).toBe(
        '10.0.5.21'
      );
    });

    it('should skip an invalid address and take the next valid one', () => {
      expect(PoePortLabel.ipOf('10.0.5.300 10.0.5.30')).toBe(
        '10.0.5.30'
      );
    });

    it.each([
      'ether2',
      'spare',
      '',
      '10.0.5',
      '10.0.5.300',
      '1.10.0.5.21'
    ])('should find no IP in "%s"', (label) => {
      expect(PoePortLabel.ipOf(label)).toBeNull();
    });
  });
});
