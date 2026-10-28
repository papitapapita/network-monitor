// Source: src/application/device-inventory/use-cases/UpdateDiscoverySettingsUseCase.ts

import { UpdateDiscoverySettingsUseCase } from '../../../../src/application/device-inventory/use-cases';
import { IAgentAssignmentQuery } from '../../../../src/application/device-inventory/interfaces';
import { UpdateDiscoverySettingsRequestDTO } from '../../../../src/application/device-inventory/dtos';
import { IDiscoverySettingsRepository } from '../../../../src/domain/device-inventory/repository';
import { Result } from '../../../../src/domain/shared/core';
import { makeLogger } from '../../probe-agents/fixtures';

const AGENT = '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10';
const LAST_RUN = new Date('2026-11-03T12:00:00Z');

function makeRequest(
  overrides: Partial<UpdateDiscoverySettingsRequestDTO> = {}
): UpdateDiscoverySettingsRequestDTO {
  return {
    enabled: true,
    intervalHours: 24,
    segments: [{ cidr: '192.168.1.0/24', agentId: null }],
    ...overrides
  };
}

describe('UpdateDiscoverySettingsUseCase', () => {
  let repository: jest.Mocked<IDiscoverySettingsRepository>;
  let agents: jest.Mocked<IAgentAssignmentQuery>;

  function makeUseCase(
    serverOnSite = true
  ): UpdateDiscoverySettingsUseCase {
    return new UpdateDiscoverySettingsUseCase(
      repository,
      agents,
      makeLogger(),
      serverOnSite
    );
  }

  beforeEach(() => {
    repository = {
      get: jest.fn(),
      save: jest.fn().mockResolvedValue(Result.ok()),
      lastRunAt: jest.fn().mockResolvedValue(Result.ok(LAST_RUN)),
      recordRun: jest.fn()
    };
    agents = {
      check: jest.fn().mockResolvedValue(Result.ok('ASSIGNABLE')),
      listAssignable: jest.fn()
    };
  });

  it('[DEV-210] saves the settings and answers them with the last run', async () => {
    const result = await makeUseCase().execute(makeRequest());

    expect(result.value).toEqual({
      ...makeRequest(),
      lastRunAt: LAST_RUN.toISOString()
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('[DEV-210] refuses invalid settings, saving nothing', async () => {
    const result = await makeUseCase().execute(
      makeRequest({ intervalHours: 0 })
    );

    expect(result.isFailure).toBe(true);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it.each(['REVOKED', 'NOT_FOUND'] as const)(
    '[DEV-212] refuses a segment whose agent is %s',
    async (state) => {
      agents.check.mockResolvedValue(Result.ok(state));

      const result = await makeUseCase().execute(
        makeRequest({
          segments: [{ cidr: '10.0.0.0/24', agentId: AGENT }]
        })
      );

      expect(result.error).toBe(
        'segment 10.0.0.0/24: agentId must be an agent that is not revoked'
      );
      expect(repository.save).not.toHaveBeenCalled();
    }
  );

  it('[DEV-212] off site, refuses a server segment', async () => {
    const result = await makeUseCase(false).execute(makeRequest());

    expect(result.error).toBe(
      'segment 192.168.1.0/24 needs an agent — this server is not on the monitored network'
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('[DEV-212] off site, saves an agent segment', async () => {
    const result = await makeUseCase(false).execute(
      makeRequest({
        segments: [{ cidr: '10.0.0.0/24', agentId: AGENT }]
      })
    );

    expect(result.isSuccess).toBe(true);
  });

  it('fails when saving fails', async () => {
    repository.save.mockResolvedValue(Result.fail('disk full'));

    const result = await makeUseCase().execute(makeRequest());

    expect(result.error).toBe(
      'Failed to save discovery settings: disk full'
    );
  });
});
