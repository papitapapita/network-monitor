// Source: src/application/wireless-monitoring/mappers/WirelessDeviceConfigMapper.ts

import { WirelessDeviceConfig } from 'domain/wireless-monitoring/aggregates';
import { WirelessDeviceConfigId, DeviceId } from 'domain/shared/ids';
import { IPAddress, PollingInterval } from 'domain/shared/value-objects';
import { WirelessDeviceConfigMapper } from 'application/wireless-monitoring/mappers';
import {
  CreateWirelessConfigRequestDTO,
  UpdateWirelessConfigRequestDTO
} from 'application/wireless-monitoring/dtos';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIG_UUID  = '550e8400-e29b-41d4-a716-446655440020';
const DEVICE_UUID  = '550e8400-e29b-41d4-a716-446655440021';
const LAST_POLLED  = new Date('2024-06-01T12:00:00.000Z');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  overrides: Partial<{
    id:                      WirelessDeviceConfigId;
    deviceId:                DeviceId;
    ipAddress:               IPAddress | null;
    enabled:                 boolean;
    pollingInterval:         PollingInterval;
    deviceType:              'STATION' | 'ACCESS_POINT';
    linkCapacityBps:         number | null;
    clientsProvisionedLimit: number | null;
    lastPolledAt:            Date | null;
  }> = {}
): WirelessDeviceConfig {
  const id       = overrides.id       ?? WirelessDeviceConfigId.parse(CONFIG_UUID).value!;
  const deviceId = overrides.deviceId ?? DeviceId.parse(DEVICE_UUID).value!;

  return WirelessDeviceConfig.reconstitute(id, {
    deviceId,
    ipAddress:               overrides.ipAddress               ?? null,
    enabled:                 overrides.enabled                 ?? true,
    pollingInterval:         overrides.pollingInterval         ?? PollingInterval.reconstitute(60),
    deviceType:              overrides.deviceType              ?? 'STATION',
    linkCapacityBps:         overrides.linkCapacityBps         ?? null,
    clientsProvisionedLimit: overrides.clientsProvisionedLimit ?? null,
    lastPolledAt:            overrides.lastPolledAt            ?? null
  });
}

// ---------------------------------------------------------------------------

describe('WirelessDeviceConfigMapper', () => {
  // ===========================================================================
  describe('toDTO()', () => {
    it('should map id to a string', () => {
      const config = makeConfig();

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.id).toBe(CONFIG_UUID);
    });

    it('should map deviceId to a string', () => {
      const config = makeConfig();

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.deviceId).toBe(DEVICE_UUID);
    });

    it('should map ipAddress to the IP string value when present', () => {
      const ip     = IPAddress.reconstitute('10.0.0.1');
      const config = makeConfig({ ipAddress: ip });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.ipAddress).toBe('10.0.0.1');
    });

    it('should map ipAddress to null when config.ipAddress is null', () => {
      const config = makeConfig({ ipAddress: null });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.ipAddress).toBeNull();
    });

    it('should pass enabled true through unchanged', () => {
      const config = makeConfig({ enabled: true });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.enabled).toBe(true);
    });

    it('should pass enabled false through unchanged', () => {
      const config = makeConfig({ enabled: false });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.enabled).toBe(false);
    });

    it('should pass intervalSecs through unchanged', () => {
      const config = makeConfig({ pollingInterval: PollingInterval.reconstitute(300) });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.intervalSecs).toBe(300);
    });

    it('should pass deviceType STATION through unchanged', () => {
      const config = makeConfig({ deviceType: 'STATION' });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.deviceType).toBe('STATION');
    });

    it('should pass deviceType ACCESS_POINT through unchanged', () => {
      const config = makeConfig({ deviceType: 'ACCESS_POINT' });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.deviceType).toBe('ACCESS_POINT');
    });

    it('should pass linkCapacityBps number through unchanged', () => {
      const config = makeConfig({ linkCapacityBps: 100000000 });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.linkCapacityBps).toBe(100000000);
    });

    it('should pass linkCapacityBps null through unchanged', () => {
      const config = makeConfig({ linkCapacityBps: null });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.linkCapacityBps).toBeNull();
    });

    it('should pass clientsProvisionedLimit number through unchanged', () => {
      const config = makeConfig({ clientsProvisionedLimit: 50 });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.clientsProvisionedLimit).toBe(50);
    });

    it('should pass clientsProvisionedLimit null through unchanged', () => {
      const config = makeConfig({ clientsProvisionedLimit: null });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.clientsProvisionedLimit).toBeNull();
    });

    it('should map lastPolledAt to an ISO string when present', () => {
      const config = makeConfig({ lastPolledAt: LAST_POLLED });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.lastPolledAt).toBe(LAST_POLLED.toISOString());
    });

    it('should map lastPolledAt to null when absent', () => {
      const config = makeConfig({ lastPolledAt: null });

      const dto = WirelessDeviceConfigMapper.toDTO(config);

      expect(dto.lastPolledAt).toBeNull();
    });

    it('should produce identical output on repeated calls with the same config (pure)', () => {
      const config = makeConfig({ ipAddress: IPAddress.reconstitute('192.168.1.1'), lastPolledAt: LAST_POLLED });

      expect(WirelessDeviceConfigMapper.toDTO(config)).toEqual(WirelessDeviceConfigMapper.toDTO(config));
    });
  });

  // ===========================================================================
  describe('extractCreateData()', () => {
    it('should pass deviceId through as-is', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION' };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.deviceId).toBe(DEVICE_UUID);
    });

    it('should pass deviceType STATION through as-is', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION' };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.deviceType).toBe('STATION');
    });

    it('should pass deviceType ACCESS_POINT through as-is', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'ACCESS_POINT' };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.deviceType).toBe('ACCESS_POINT');
    });

    it('should pass ipAddress through when provided as a string', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION', ipAddress: '10.0.0.5' };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.ipAddress).toBe('10.0.0.5');
    });

    it('should default ipAddress to null when omitted', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION' };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.ipAddress).toBeNull();
    });

    it('should pass ipAddress as null when explicitly null', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION', ipAddress: null };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.ipAddress).toBeNull();
    });

    it('should pass intervalSecs through when provided', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION', intervalSecs: 300 };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.intervalSecs).toBe(300);
    });

    it('should default intervalSecs to null when omitted', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION' };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.intervalSecs).toBeNull();
    });

    it('should pass enabled true through unchanged', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION', enabled: true };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.enabled).toBe(true);
    });

    it('should pass enabled false through unchanged', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION', enabled: false };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.enabled).toBe(false);
    });

    it('should default enabled to null when omitted', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION' };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.enabled).toBeNull();
    });

    it('should pass linkCapacityBps through when provided', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION', linkCapacityBps: 50000000 };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.linkCapacityBps).toBe(50000000);
    });

    it('should default linkCapacityBps to null when omitted', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION' };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.linkCapacityBps).toBeNull();
    });

    it('should pass linkCapacityBps as null when explicitly null', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION', linkCapacityBps: null };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.linkCapacityBps).toBeNull();
    });

    it('should pass clientsProvisionedLimit through when provided', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION', clientsProvisionedLimit: 20 };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.clientsProvisionedLimit).toBe(20);
    });

    it('should default clientsProvisionedLimit to null when omitted', () => {
      const dto: CreateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, deviceType: 'STATION' };

      const result = WirelessDeviceConfigMapper.extractCreateData(dto);

      expect(result.clientsProvisionedLimit).toBeNull();
    });
  });

  // ===========================================================================
  describe('extractUpdateData()', () => {
    it('should return an empty object when no optional fields are provided', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result).toEqual({});
    });

    it('should include ipAddress when provided as a string', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, ipAddress: '10.0.0.9' };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result.ipAddress).toBe('10.0.0.9');
    });

    it('should include ipAddress when explicitly null (clearing the field)', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, ipAddress: null };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result.ipAddress).toBeNull();
    });

    it('should not include ipAddress key when omitted', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect('ipAddress' in result).toBe(false);
    });

    it('should include intervalSecs when provided', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, intervalSecs: 120 };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result.intervalSecs).toBe(120);
    });

    it('should not include intervalSecs key when omitted', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect('intervalSecs' in result).toBe(false);
    });

    it('should include enabled when true', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, enabled: true };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result.enabled).toBe(true);
    });

    it('should include enabled when false', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, enabled: false };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result.enabled).toBe(false);
    });

    it('should not include enabled key when omitted', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect('enabled' in result).toBe(false);
    });

    it('should include linkCapacityBps when provided as a number', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, linkCapacityBps: 75000000 };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result.linkCapacityBps).toBe(75000000);
    });

    it('should include linkCapacityBps when explicitly null', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, linkCapacityBps: null };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result.linkCapacityBps).toBeNull();
    });

    it('should not include linkCapacityBps key when omitted', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect('linkCapacityBps' in result).toBe(false);
    });

    it('should include clientsProvisionedLimit when provided as a number', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, clientsProvisionedLimit: 30 };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result.clientsProvisionedLimit).toBe(30);
    });

    it('should include clientsProvisionedLimit when explicitly null', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID, clientsProvisionedLimit: null };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result.clientsProvisionedLimit).toBeNull();
    });

    it('should not include clientsProvisionedLimit key when omitted', () => {
      const dto: UpdateWirelessConfigRequestDTO = { deviceId: DEVICE_UUID };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect('clientsProvisionedLimit' in result).toBe(false);
    });

    it('should include all five fields when all are provided', () => {
      const dto: UpdateWirelessConfigRequestDTO = {
        deviceId:                DEVICE_UUID,
        ipAddress:               '10.0.0.1',
        intervalSecs:            180,
        enabled:                 false,
        linkCapacityBps:         25000000,
        clientsProvisionedLimit: 10
      };

      const result = WirelessDeviceConfigMapper.extractUpdateData(dto);

      expect(result).toEqual({
        ipAddress:               '10.0.0.1',
        intervalSecs:            180,
        enabled:                 false,
        linkCapacityBps:         25000000,
        clientsProvisionedLimit: 10
      });
    });
  });

  // ===========================================================================
  describe('mapper compliance', () => {
    it('should expose toDTO as a static method', () => {
      expect(typeof WirelessDeviceConfigMapper.toDTO).toBe('function');
    });

    it('should expose extractCreateData as a static method', () => {
      expect(typeof WirelessDeviceConfigMapper.extractCreateData).toBe('function');
    });

    it('should expose extractUpdateData as a static method', () => {
      expect(typeof WirelessDeviceConfigMapper.extractUpdateData).toBe('function');
    });

    it('should produce identical output on repeated toDTO calls with the same config (pure)', () => {
      const config = makeConfig({ pollingInterval: PollingInterval.reconstitute(120) });

      expect(WirelessDeviceConfigMapper.toDTO(config)).toEqual(WirelessDeviceConfigMapper.toDTO(config));
    });
  });
});
