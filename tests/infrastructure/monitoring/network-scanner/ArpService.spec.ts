// Source: src/infrastructure/monitoring/network-scanner/ArpService.ts

jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));

import { readFile } from 'fs/promises';
import { ArpService } from '../../../../src/infrastructure/monitoring/network-scanner/ArpService';

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

const ARP_HEADER =
  'IP address       HW type     Flags       HW address            Mask     Device\n';

describe('ArpService', () => {
  let service: ArpService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ArpService();
  });

  describe('toMAC', () => {
    it('should return the MAC string for a resolved (ATF_COM) entry matching the IP', async () => {
      mockReadFile.mockResolvedValue(
        ARP_HEADER +
          '192.168.1.1      0x1         0x2         aa:bb:cc:dd:ee:ff     *        eth0\n'
      );

      const result = await service.toMAC('192.168.1.1');

      expect(result).toBe('aa:bb:cc:dd:ee:ff');
    });

    it('should return null when the matching entry is not yet resolved', async () => {
      mockReadFile.mockResolvedValue(
        ARP_HEADER +
          '192.168.1.1      0x1         0x0         00:00:00:00:00:00     *        eth0\n'
      );

      const result = await service.toMAC('192.168.1.1');

      expect(result).toBeNull();
    });

    it('should return null when no entry matches the IP', async () => {
      mockReadFile.mockResolvedValue(
        ARP_HEADER +
          '10.0.0.1         0x1         0x2         aa:bb:cc:dd:ee:ff     *        eth0\n'
      );

      const result = await service.toMAC('192.168.1.1');

      expect(result).toBeNull();
    });

    it('should return null and swallow the error when reading /proc/net/arp fails', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await service.toMAC('192.168.1.1');

      expect(result).toBeNull();
    });

    it('should only match the exact IP address requested', async () => {
      mockReadFile.mockResolvedValue(
        ARP_HEADER +
          '10.0.0.1         0x1         0x2         11:22:33:44:55:66     *        eth0\n' +
          '10.0.0.10        0x1         0x2         aa:bb:cc:dd:ee:ff     *        eth0\n'
      );

      const result = await service.toMAC('10.0.0.1');

      expect(result).toBe('11:22:33:44:55:66');
    });
  });
});
