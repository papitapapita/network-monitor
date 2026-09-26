import { StartLinkDiagnosisUseCase } from '../../../../src/application/wireless-monitoring/use-cases/StartLinkDiagnosisUseCase';
import {
  DecryptedCredentials,
  IContractedCapacityProvider,
  IDeviceCredentialsRepository,
  IDeviceRepository,
  IDeviceVendorLookup,
  ILinkDiagnosisRunner,
  IWirelessCollector,
  IWirelessCollectorResolver,
  LinkDiagnosisTarget,
  TOO_MANY_DIAGNOSES
} from '../../../../src/application/wireless-monitoring/interfaces';
import { LinkDiagnosisDTO } from '../../../../src/application/wireless-monitoring/dtos';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessSnapshot } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessSnapshot';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids/WirelessDeviceConfigId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const PARENT_UUID = '550e8400-e29b-41d4-a716-446655440002';

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeConfig(
  overrides: Partial<{
    deviceId: string;
    ip: string | null;
    deviceType: 'STATION' | 'ACCESS_POINT';
    parentApDeviceId: string | null;
    linkCapacityKbps: number | null;
  }> = {}
): WirelessDeviceConfig {
  const ip = overrides.ip === undefined ? '10.0.0.20' : overrides.ip;
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.create(),
    {
      deviceId: DeviceId.parse(overrides.deviceId ?? DEVICE_UUID)
        .value,
      ipAddress: ip ? IPAddress.create(ip).value : null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(300),
      deviceType: overrides.deviceType ?? 'STATION',
      linkCapacityKbps: overrides.linkCapacityKbps ?? null,
      clientsProvisionedLimit: null,
      provisionedLanSpeedMbps: 100,
      parentApDeviceId: overrides.parentApDeviceId
        ? DeviceId.parse(overrides.parentApDeviceId).value
        : null,
      lastPolledAt: null
    }
  );
}

function makeCredentials(): DecryptedCredentials {
  return {
    snmpVersion: 2,
    snmpCommunity: null,
    snmpV3AuthUser: null,
    snmpV3AuthProto: null,
    snmpV3AuthKey: null,
    snmpV3PrivProto: null,
    snmpV3PrivKey: null,
    httpUsername: 'ubnt',
    httpPassword: 'secret',
    snmpPort: 161,
    httpPort: 443
  };
}

const runningDTO = {
  deviceId: DEVICE_UUID,
  status: 'RUNNING'
} as LinkDiagnosisDTO;

function setup() {
  const configRepo = {
    findByDeviceId: jest
      .fn()
      .mockResolvedValue(Result.ok(makeConfig()))
  };
  const snapshotRepo = {
    findLatestByDevice: jest.fn().mockResolvedValue(Result.ok(null))
  };
  const credentialsRepo = {
    findByDeviceId: jest
      .fn()
      .mockResolvedValue(Result.ok(makeCredentials()))
  };
  const collector = { method: 'http_api' } as IWirelessCollector;
  const collectors = {
    forVendor: jest.fn().mockReturnValue(collector)
  };
  const vendorLookup = {
    findVendorSlug: jest.fn().mockResolvedValue(Result.ok('ubiquiti'))
  };
  const deviceRepo = {
    findWirelessIneligibilityReason: jest
      .fn()
      .mockResolvedValue(Result.ok(null))
  };
  const contracted = {
    findKbpsByDeviceId: jest.fn().mockResolvedValue(Result.ok(null))
  };
  const runner = {
    find: jest.fn().mockReturnValue(null),
    startOrJoin: jest
      .fn()
      .mockReturnValue(
        Result.ok({ started: true, diagnosis: runningDTO })
      ),
    stop: jest.fn()
  };

  const useCase = new StartLinkDiagnosisUseCase(
    configRepo as unknown as IWirelessDeviceConfigRepository,
    snapshotRepo as unknown as IWirelessSnapshotRepository,
    credentialsRepo as unknown as IDeviceCredentialsRepository,
    collectors as unknown as IWirelessCollectorResolver,
    vendorLookup as unknown as IDeviceVendorLookup,
    deviceRepo as unknown as IDeviceRepository,
    contracted as unknown as IContractedCapacityProvider,
    runner as unknown as ILinkDiagnosisRunner,
    makeLogger()
  );

  const startedTarget = (): LinkDiagnosisTarget =>
    runner.startOrJoin.mock.calls[0][0];

  return {
    useCase,
    configRepo,
    snapshotRepo,
    credentialsRepo,
    collector,
    collectors,
    vendorLookup,
    deviceRepo,
    contracted,
    runner,
    startedTarget
  };
}

describe('StartLinkDiagnosisUseCase', () => {
  describe('[WLS-180] happy path', () => {
    it('should start a session with everything the runner needs', async () => {
      const { useCase, runner, collector, startedTarget } = setup();

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        started: true,
        diagnosis: runningDTO
      });
      expect(runner.startOrJoin).toHaveBeenCalledTimes(1);
      expect(startedTarget()).toMatchObject({
        deviceId: DEVICE_UUID,
        deviceType: 'STATION',
        ipAddress: '10.0.0.20',
        parent: null,
        collector,
        durationSeconds: 60,
        provisionedLanSpeedMbps: 100
      });
      expect(startedTarget().credentials.httpPassword).toBe('secret');
    });

    it('should join a running session without any lookup', async () => {
      const { useCase, runner, configRepo, deviceRepo } = setup();
      runner.find.mockReturnValue(runningDTO);

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.value).toEqual({
        started: false,
        diagnosis: runningDTO
      });
      expect(runner.startOrJoin).not.toHaveBeenCalled();
      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
      expect(
        deviceRepo.findWirelessIneligibilityReason
      ).not.toHaveBeenCalled();
    });

    it('should start a fresh session when only a finished one is on record', async () => {
      const { useCase, runner } = setup();
      runner.find.mockReturnValue({
        ...runningDTO,
        status: 'COMPLETED'
      });

      await useCase.execute({ deviceId: DEVICE_UUID });

      expect(runner.startOrJoin).toHaveBeenCalledTimes(1);
    });
  });

  describe('[WLS-181] duration', () => {
    it('should pass the requested duration', async () => {
      const { useCase, startedTarget } = setup();

      await useCase.execute({
        deviceId: DEVICE_UUID,
        durationSeconds: 180
      });

      expect(startedTarget().durationSeconds).toBe(180);
    });

    it('should reject a duration out of range', async () => {
      const { useCase, runner } = setup();

      const result = await useCase.execute({
        deviceId: DEVICE_UUID,
        durationSeconds: 301
      });

      expect(result.error).toBe(
        'Diagnosis duration must not exceed 300 seconds'
      );
      expect(runner.startOrJoin).not.toHaveBeenCalled();
    });
  });

  describe('[WLS-184] parent hop', () => {
    it('should ping the declared parent AP at its configured IP', async () => {
      const { useCase, configRepo, startedTarget, snapshotRepo } =
        setup();
      configRepo.findByDeviceId.mockImplementation(
        async (id: DeviceId) =>
          Result.ok(
            id.toString() === PARENT_UUID
              ? makeConfig({
                  deviceId: PARENT_UUID,
                  ip: '10.0.0.1',
                  deviceType: 'ACCESS_POINT'
                })
              : makeConfig({ parentApDeviceId: PARENT_UUID })
          )
      );

      await useCase.execute({ deviceId: DEVICE_UUID });

      expect(startedTarget().parent).toEqual({
        deviceId: PARENT_UUID,
        ipAddress: '10.0.0.1'
      });
      expect(snapshotRepo.findLatestByDevice).not.toHaveBeenCalled();
    });

    it('should fall back to the AP the radio last reported', async () => {
      const { useCase, snapshotRepo, startedTarget } = setup();
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok({
          metrics: { remoteApIp: '10.0.0.9' },
          remoteApDeviceId: DeviceId.parse(PARENT_UUID).value
        } as unknown as WirelessSnapshot)
      );

      await useCase.execute({ deviceId: DEVICE_UUID });

      expect(startedTarget().parent).toEqual({
        deviceId: PARENT_UUID,
        ipAddress: '10.0.0.9'
      });
    });

    it('should fall back when the declared parent has no IP', async () => {
      const { useCase, configRepo, snapshotRepo, startedTarget } =
        setup();
      configRepo.findByDeviceId.mockImplementation(
        async (id: DeviceId) =>
          Result.ok(
            id.toString() === PARENT_UUID
              ? makeConfig({ deviceId: PARENT_UUID, ip: null })
              : makeConfig({ parentApDeviceId: PARENT_UUID })
          )
      );
      snapshotRepo.findLatestByDevice.mockResolvedValue(
        Result.ok({
          metrics: { remoteApIp: '10.0.0.9' },
          remoteApDeviceId: null
        } as unknown as WirelessSnapshot)
      );

      await useCase.execute({ deviceId: DEVICE_UUID });

      expect(startedTarget().parent).toEqual({
        deviceId: null,
        ipAddress: '10.0.0.9'
      });
    });

    it('should give an access point no parent hop', async () => {
      const { useCase, configRepo, snapshotRepo, startedTarget } =
        setup();
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ deviceType: 'ACCESS_POINT' }))
      );

      await useCase.execute({ deviceId: DEVICE_UUID });

      expect(startedTarget().parent).toBeNull();
      expect(snapshotRepo.findLatestByDevice).not.toHaveBeenCalled();
    });
  });

  describe('link capacity', () => {
    it('should prefer the contracted plan', async () => {
      const { useCase, contracted, startedTarget } = setup();
      contracted.findKbpsByDeviceId.mockResolvedValue(
        Result.ok(20_000)
      );

      await useCase.execute({ deviceId: DEVICE_UUID });

      expect(startedTarget().linkCapacityKbps).toBe(20_000);
    });

    it('should fall back to the manual capacity when the plan lookup fails', async () => {
      const { useCase, contracted, configRepo, startedTarget } =
        setup();
      contracted.findKbpsByDeviceId.mockResolvedValue(
        Result.fail('db down')
      );
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ linkCapacityKbps: 15_000 }))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(startedTarget().linkCapacityKbps).toBe(15_000);
    });
  });

  describe('failures', () => {
    it('should require a device id', async () => {
      const { useCase } = setup();

      const result = await useCase.execute({ deviceId: ' ' });

      expect(result.error).toBe('Device ID is required');
    });

    it('should reject a malformed device id', async () => {
      const { useCase } = setup();

      const result = await useCase.execute({ deviceId: 'nope' });

      expect(result.error).toMatch(/^Invalid device ID/);
    });

    it('should refuse an ineligible device', async () => {
      const { useCase, deviceRepo } = setup();
      deviceRepo.findWirelessIneligibilityReason.mockResolvedValue(
        Result.ok('device is retired')
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.error).toBe(
        'Cannot diagnose device — device is retired'
      );
    });

    it('should fail without a wireless config', async () => {
      const { useCase, configRepo } = setup();
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.error).toBe(
        'No wireless polling configuration found for device'
      );
    });

    it('should fail without an IP address', async () => {
      const { useCase, configRepo } = setup();
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ ip: null }))
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.error).toBe(
        'Device has no IP address configured'
      );
    });

    it('should fail without credentials', async () => {
      const { useCase, credentialsRepo } = setup();
      credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.error).toBe(
        'Credentials not configured for device'
      );
    });

    it('should fail for a vendor with no collector', async () => {
      const { useCase, collectors } = setup();
      collectors.forVendor.mockReturnValue(null);

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.error).toBe(
        "Wireless polling is not supported for vendor 'ubiquiti'"
      );
    });

    it('should pass on the runner refusing for capacity', async () => {
      const { useCase, runner } = setup();
      runner.startOrJoin.mockReturnValue(
        Result.fail(TOO_MANY_DIAGNOSES)
      );

      const result = await useCase.execute({ deviceId: DEVICE_UUID });

      expect(result.error).toBe(TOO_MANY_DIAGNOSES);
    });
  });
});
