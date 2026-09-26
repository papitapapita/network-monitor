import { GetLinkDiagnosisUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetLinkDiagnosisUseCase';
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

describe('[WLS-181] GetLinkDiagnosisUseCase', () => {
  it('should return the session the runner holds', async () => {
    const runner = makeRunner();
    runner.find.mockReturnValue(diagnosis);
    const useCase = new GetLinkDiagnosisUseCase(
      runner as unknown as ILinkDiagnosisRunner,
      makeLogger()
    );

    const result = await useCase.execute({ deviceId: DEVICE_UUID });

    expect(result.value).toBe(diagnosis);
    expect(runner.find).toHaveBeenCalledWith(DEVICE_UUID);
  });

  it('should fail as not found when there is no session', async () => {
    const useCase = new GetLinkDiagnosisUseCase(
      makeRunner() as unknown as ILinkDiagnosisRunner,
      makeLogger()
    );

    const result = await useCase.execute({ deviceId: DEVICE_UUID });

    expect(result.error).toBe('Diagnosis not found for device');
  });

  it('should reject a malformed id', async () => {
    const useCase = new GetLinkDiagnosisUseCase(
      makeRunner() as unknown as ILinkDiagnosisRunner,
      makeLogger()
    );

    const result = await useCase.execute({ deviceId: 'nope' });

    expect(result.error).toMatch(/^Invalid device ID/);
  });

  it('should leave the samples out of the completion log', async () => {
    const runner = makeRunner();
    runner.find.mockReturnValue(diagnosis);
    const logger = makeLogger();
    const useCase = new GetLinkDiagnosisUseCase(
      runner as unknown as ILinkDiagnosisRunner,
      logger
    );

    await useCase.execute({ deviceId: DEVICE_UUID });

    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).not.toContain('samples');
  });
});
