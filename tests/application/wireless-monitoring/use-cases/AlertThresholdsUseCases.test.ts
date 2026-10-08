// Source: src/application/wireless-monitoring/use-cases/GetAlertThresholdsUseCase.ts,
// UpdateAlertThresholdsUseCase.ts, GetDeviceAlertThresholdsUseCase.ts,
// UpdateDeviceAlertThresholdsUseCase.ts

import { GetAlertThresholdsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetAlertThresholdsUseCase';
import { UpdateAlertThresholdsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/UpdateAlertThresholdsUseCase';
import {
  GetDeviceAlertThresholdsUseCase,
  WIRELESS_CONFIG_NOT_FOUND
} from '../../../../src/application/wireless-monitoring/use-cases/GetDeviceAlertThresholdsUseCase';
import { UpdateDeviceAlertThresholdsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/UpdateDeviceAlertThresholdsUseCase';
import { AlertThresholdsMapper } from '../../../../src/application/wireless-monitoring/mappers/AlertThresholdsMapper';
import { IAlertThresholdsRepository } from '../../../../src/domain/wireless-monitoring/repository/IAlertThresholdsRepository';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { AlertThresholds } from '../../../../src/domain/wireless-monitoring/value-objects/AlertThresholds';
import { AlertThresholdOverrides } from '../../../../src/domain/wireless-monitoring/value-objects/AlertThresholdOverrides';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeThresholdsRepo(
  global = AlertThresholds.defaults(),
  overrides = AlertThresholdOverrides.none()
): jest.Mocked<IAlertThresholdsRepository> {
  return {
    getGlobal: jest.fn().mockResolvedValue(Result.ok(global)),
    saveGlobal: jest.fn().mockResolvedValue(Result.ok()),
    findOverrides: jest.fn().mockResolvedValue(Result.ok(overrides)),
    saveOverrides: jest.fn().mockResolvedValue(Result.ok())
  };
}

function makeConfigRepo(
  config: WirelessDeviceConfig | null = {} as WirelessDeviceConfig
): IWirelessDeviceConfigRepository {
  return {
    findByDeviceId: jest.fn().mockResolvedValue(Result.ok(config))
  } as unknown as IWirelessDeviceConfigRepository;
}

const DEFAULTS_DTO = AlertThresholdsMapper.toDTO(
  AlertThresholds.defaults()
);

describe('[WLS-200] GetAlertThresholdsUseCase', () => {
  it('returns the saved thresholds alongside the defaults', async () => {
    const saved = AlertThresholds.defaults().withOverrides({
      cpuPercent: 60
    });
    const useCase = new GetAlertThresholdsUseCase(
      makeThresholdsRepo(saved),
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.value.thresholds.cpuPercent).toBe(60);
    expect(result.value.defaults).toEqual(DEFAULTS_DTO);
  });

  it('fails when the thresholds cannot be read', async () => {
    const repo = makeThresholdsRepo();
    repo.getGlobal.mockResolvedValue(Result.fail('connection reset'));
    const useCase = new GetAlertThresholdsUseCase(repo, makeLogger());

    const result = await useCase.execute({});

    expect(result.error).toBe(
      'Failed to load alert thresholds: connection reset'
    );
  });
});

describe('[WLS-200] UpdateAlertThresholdsUseCase', () => {
  it('saves a valid set and returns it', async () => {
    const repo = makeThresholdsRepo();
    const useCase = new UpdateAlertThresholdsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      ...DEFAULTS_DTO,
      minCapacityMbps: { '40': 150 }
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.thresholds.minCapacityMbps).toEqual({
      '40': 150
    });
    const saved = repo.saveGlobal.mock.calls[0]![0];
    expect(saved.minCapacityKbpsFor(40)).toBe(150_000);
  });

  it('rejects an invalid set without saving', async () => {
    const repo = makeThresholdsRepo();
    const useCase = new UpdateAlertThresholdsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      ...DEFAULTS_DTO,
      latencyMs: { warning: 200, critical: 100 }
    });

    expect(result.error).toBe(
      'latencyMs.warning must be lower than latencyMs.critical'
    );
    expect(repo.saveGlobal).not.toHaveBeenCalled();
  });

  it('fails when the save fails', async () => {
    const repo = makeThresholdsRepo();
    repo.saveGlobal.mockResolvedValue(Result.fail('disk full'));
    const useCase = new UpdateAlertThresholdsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute(DEFAULTS_DTO);

    expect(result.error).toBe(
      'Failed to save alert thresholds: disk full'
    );
  });
});

describe('[WLS-201] GetDeviceAlertThresholdsUseCase', () => {
  it('returns the overrides, the install set and the result of both', async () => {
    const overrides = AlertThresholdOverrides.create({
      maxDistanceKm: { 40: 30 }
    }).value;
    const useCase = new GetDeviceAlertThresholdsUseCase(
      makeConfigRepo(),
      makeThresholdsRepo(AlertThresholds.defaults(), overrides),
      makeLogger()
    );

    const result = await useCase.execute({ deviceId: DEVICE_UUID });

    expect(result.value.deviceId).toBe(DEVICE_UUID);
    expect(result.value.overrides).toEqual({
      maxDistanceKm: { '40': 30 }
    });
    expect(result.value.install).toEqual(DEFAULTS_DTO);
    expect(result.value.effective.maxDistanceKm).toEqual({
      '20': 15,
      '40': 30,
      '80': 5
    });
  });

  it('fails for a device with no wireless config', async () => {
    const useCase = new GetDeviceAlertThresholdsUseCase(
      makeConfigRepo(null),
      makeThresholdsRepo(),
      makeLogger()
    );

    const result = await useCase.execute({ deviceId: DEVICE_UUID });

    expect(result.error).toBe(WIRELESS_CONFIG_NOT_FOUND);
  });

  it('fails for a malformed device id', async () => {
    const useCase = new GetDeviceAlertThresholdsUseCase(
      makeConfigRepo(),
      makeThresholdsRepo(),
      makeLogger()
    );

    const result = await useCase.execute({ deviceId: 'not-a-uuid' });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});

describe('[WLS-201] UpdateDeviceAlertThresholdsUseCase', () => {
  it('saves the overrides and returns the result applied', async () => {
    const repo = makeThresholdsRepo();
    const useCase = new UpdateDeviceAlertThresholdsUseCase(
      makeConfigRepo(),
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      deviceId: DEVICE_UUID,
      overrides: { signalDbm: { warning: -75, critical: -85 } }
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.effective.signalDbm).toEqual({
      warning: -75,
      critical: -85
    });
    const [deviceId, saved] = repo.saveOverrides.mock.calls[0]!;
    expect(deviceId.toString()).toBe(DEVICE_UUID);
    expect(saved.values).toEqual({
      signalDbm: { warning: -75, critical: -85 }
    });
  });

  it('passes empty overrides through, which clears them', async () => {
    const repo = makeThresholdsRepo();
    const useCase = new UpdateDeviceAlertThresholdsUseCase(
      makeConfigRepo(),
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      deviceId: DEVICE_UUID,
      overrides: {}
    });

    expect(result.value.effective).toEqual(DEFAULTS_DTO);
    expect(repo.saveOverrides.mock.calls[0]![1].isEmpty).toBe(true);
  });

  it('rejects invalid overrides without saving', async () => {
    const repo = makeThresholdsRepo();
    const useCase = new UpdateDeviceAlertThresholdsUseCase(
      makeConfigRepo(),
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      deviceId: DEVICE_UUID,
      overrides: { maxDistanceKm: { '40': 500 } }
    });

    expect(result.error).toBe(
      'maxDistanceKm.40 must be from 0.1 to 200'
    );
    expect(repo.saveOverrides).not.toHaveBeenCalled();
  });

  it('fails for a device with no wireless config without saving', async () => {
    const repo = makeThresholdsRepo();
    const useCase = new UpdateDeviceAlertThresholdsUseCase(
      makeConfigRepo(null),
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      deviceId: DEVICE_UUID,
      overrides: { cpuPercent: 70 }
    });

    expect(result.error).toBe(WIRELESS_CONFIG_NOT_FOUND);
    expect(repo.saveOverrides).not.toHaveBeenCalled();
  });
});
