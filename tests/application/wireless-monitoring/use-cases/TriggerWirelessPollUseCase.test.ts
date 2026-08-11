// Source: src/application/wireless-monitoring/use-cases/TriggerWirelessPollUseCase.ts

import { TriggerWirelessPollUseCase } from '../../../../src/application/wireless-monitoring/use-cases/TriggerWirelessPollUseCase';
import { IWirelessPollOrchestrator } from '../../../../src/application/wireless-monitoring/interfaces/IWirelessPollOrchestrator';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { PollWirelessDeviceResponseDTO } from '../../../../src/application/wireless-monitoring/dtos/PollWirelessDeviceResponseDTO';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn(),
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeOrchestrator(): jest.Mocked<IWirelessPollOrchestrator> {
  return { execute: jest.fn() };
}

function makeSuccessResponse(deviceId: string): PollWirelessDeviceResponseDTO {
  return {
    deviceId,
    collectedAt: new Date().toISOString(),
    metricsCollected: true,
    alertsTriggered: 0,
    alertsCleared: 0,
    collectionMethod: 'mixed',
  };
}

// ---------------------------------------------------------------------------

describe('[WLS-025] TriggerWirelessPollUseCase', () => {
  let orchestrator: jest.Mocked<IWirelessPollOrchestrator>;
  let logger: jest.Mocked<ILogger>;
  let useCase: TriggerWirelessPollUseCase;

  beforeEach(() => {
    orchestrator = makeOrchestrator();
    logger = makeLogger();
    useCase = new TriggerWirelessPollUseCase(orchestrator, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — request validation', () => {
    it('should fail when deviceId is empty', async () => {
      const result = await useCase.execute({ deviceId: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute({ deviceId: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should NOT call the orchestrator when beforeExecute fails', async () => {
      await useCase.execute({ deviceId: '' });

      expect(orchestrator.execute).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path', () => {
    it('should return a successful Result when orchestrator succeeds', async () => {
      orchestrator.execute.mockResolvedValue(Result.ok(makeSuccessResponse(VALID_DEVICE_UUID)));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should call orchestrator.execute exactly once', async () => {
      orchestrator.execute.mockResolvedValue(Result.ok(makeSuccessResponse(VALID_DEVICE_UUID)));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(orchestrator.execute).toHaveBeenCalledTimes(1);
    });

    it('should delegate with forceExecution set to true', async () => {
      orchestrator.execute.mockResolvedValue(Result.ok(makeSuccessResponse(VALID_DEVICE_UUID)));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(orchestrator.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: VALID_DEVICE_UUID,
          forceExecution: true,
        })
      );
    });

    it('should propagate the orchestrator response DTO unchanged', async () => {
      const response = makeSuccessResponse(VALID_DEVICE_UUID);
      orchestrator.execute.mockResolvedValue(Result.ok(response));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value).toEqual(response);
    });

    it('should propagate collectionMethod from the orchestrator response', async () => {
      const response = makeSuccessResponse(VALID_DEVICE_UUID);
      response.collectionMethod = 'snmp';
      orchestrator.execute.mockResolvedValue(Result.ok(response));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.collectionMethod).toBe('snmp');
    });
  });

  // ===========================================================================
  describe('executeImpl — orchestrator failure propagation', () => {
    it('should return a failure result when orchestrator fails', async () => {
      orchestrator.execute.mockResolvedValue(
        Result.fail('No wireless polling configuration found')
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should propagate the orchestrator error message', async () => {
      orchestrator.execute.mockResolvedValue(
        Result.fail('No credentials configured for device')
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.error).toBe('No credentials configured for device');
    });
  });
});
