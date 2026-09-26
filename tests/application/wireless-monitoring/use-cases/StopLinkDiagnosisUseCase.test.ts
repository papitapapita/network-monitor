import { StopLinkDiagnosisUseCase } from '../../../../src/application/wireless-monitoring/use-cases/StopLinkDiagnosisUseCase';
import { ILinkDiagnosisRunner } from '../../../../src/application/wireless-monitoring/interfaces';
import { LinkDiagnosisDTO } from '../../../../src/application/wireless-monitoring/dtos';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

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

const diagnosis = {
  deviceId: DEVICE_UUID,
  status: 'RUNNING',
  samples: { ping: [], radio: [] }
} as unknown as LinkDiagnosisDTO;

function makeRunner() {
  return {
    find: jest.fn().mockReturnValue(null),
    stop: jest.fn().mockReturnValue(null),
    startOrJoin: jest.fn()
  };
}

describe('[WLS-181] StopLinkDiagnosisUseCase', () => {
  it('should return the final session', async () => {
    const runner = makeRunner();
    runner.stop.mockReturnValue({ ...diagnosis, status: 'STOPPED' });
    const useCase = new StopLinkDiagnosisUseCase(
      runner as unknown as ILinkDiagnosisRunner,
      makeLogger()
    );

    const result = await useCase.execute({ deviceId: DEVICE_UUID });

    expect(result.value.status).toBe('STOPPED');
    expect(runner.stop).toHaveBeenCalledWith(DEVICE_UUID);
  });

  it('should fail as not found when nothing is running', async () => {
    const useCase = new StopLinkDiagnosisUseCase(
      makeRunner() as unknown as ILinkDiagnosisRunner,
      makeLogger()
    );

    const result = await useCase.execute({ deviceId: DEVICE_UUID });

    expect(result.error).toBe(
      'Running diagnosis not found for device'
    );
  });

  it('should reject a malformed id', async () => {
    const useCase = new StopLinkDiagnosisUseCase(
      makeRunner() as unknown as ILinkDiagnosisRunner,
      makeLogger()
    );

    const result = await useCase.execute({ deviceId: 'nope' });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
