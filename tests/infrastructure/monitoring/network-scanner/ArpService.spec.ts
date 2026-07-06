// Source: src/infrastructure/monitoring/network-scanner/ArpService.ts

jest.mock('@network-utils/arp-lookup', () => ({
  default: { toMAC: jest.fn() },
  __esModule: true
}));

import arp from '@network-utils/arp-lookup';
import { ArpService } from '../../../../src/infrastructure/monitoring/network-scanner/ArpService';

const mockArpToMAC = arp.toMAC as jest.MockedFunction<
  typeof arp.toMAC
>;

describe('ArpService', () => {
  let service: ArpService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ArpService();
  });

  describe('toMAC', () => {
    it('should return the MAC string when arp.toMAC resolves with a MAC address', async () => {
      mockArpToMAC.mockResolvedValue('AA:BB:CC:DD:EE:FF');

      const result = await service.toMAC('192.168.1.1');

      expect(result).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should return null when arp.toMAC resolves with null', async () => {
      mockArpToMAC.mockResolvedValue(null);

      const result = await service.toMAC('192.168.1.1');

      expect(result).toBeNull();
    });

    it('should return null and swallow the error when arp.toMAC rejects', async () => {
      mockArpToMAC.mockRejectedValue(
        new Error('ARP table read failed')
      );

      const result = await service.toMAC('192.168.1.1');

      expect(result).toBeNull();
    });

    it('should call arp.toMAC with the exact IP address provided', async () => {
      mockArpToMAC.mockResolvedValue('11:22:33:44:55:66');

      await service.toMAC('10.0.0.1');

      expect(mockArpToMAC).toHaveBeenCalledWith('10.0.0.1');
    });
  });
});
