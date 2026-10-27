// Source: src/application/wireless-monitoring/use-cases/RenameRadioUseCase.ts

import { RenameRadioUseCase } from '../../../../src/application/wireless-monitoring/use-cases/RenameRadioUseCase';
import {
  OUT_OF_SERVER_REACH,
  RADIO_SETTINGS_FAILURES
} from '../../../../src/application/wireless-monitoring/interfaces';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  DEVICE_UUID,
  LOGIN,
  RADIO_IP,
  RadioSettingsMocks,
  makeLogger,
  makeMocks
} from './radioSettingsFixtures';

const NOW = new Date('2026-10-27T15:00:00.000Z');

describe('RenameRadioUseCase', () => {
  let mocks: RadioSettingsMocks;
  let logger: ReturnType<typeof makeLogger>;
  let useCase: RenameRadioUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    logger = makeLogger();
    mocks.gateway.setHostname.mockResolvedValue({
      ok: true,
      value: undefined
    });
    useCase = new RenameRadioUseCase(
      mocks.sources,
      mocks.gateway,
      logger,
      () => NOW
    );
  });

  const rename = (hostname: string) =>
    useCase.execute({
      deviceId: DEVICE_UUID,
      hostname,
      renamedBy: 'user-1'
    });

  it('[WLS-224] writes the trimmed name to the radio', async () => {
    const result = await rename('  AP Norte  ');

    expect(result.value).toEqual({
      deviceId: DEVICE_UUID,
      hostname: 'AP Norte',
      renamedAt: NOW.toISOString()
    });
    expect(mocks.gateway.setHostname).toHaveBeenCalledWith(
      { by: 'server' },
      {
        ipAddress: RADIO_IP,
        vendor: 'ubiquiti',
        deviceType: 'ACCESS_POINT',
        login: LOGIN
      },
      'AP Norte'
    );
    expect(logger.info).toHaveBeenCalledWith('Radio renamed', {
      deviceId: DEVICE_UUID,
      hostname: 'AP Norte',
      renamedBy: 'user-1'
    });
  });

  it('[WLS-223] refuses a name AirOS cannot take, before reaching anything', async () => {
    const result = await rename('AP Peña');

    expect(result.error).toContain('must be letters');
    expect(mocks.deviceReach.readerFor).not.toHaveBeenCalled();
    expect(mocks.gateway.setHostname).not.toHaveBeenCalled();
  });

  it('[WLS-225] renames through the agent the radio sits behind', async () => {
    mocks.deviceReach.readerFor.mockResolvedValue(
      Result.ok({ by: 'agent', agentId: 'agent-1' })
    );

    await rename('AP Norte');

    expect(mocks.gateway.setHostname).toHaveBeenCalledWith(
      { by: 'agent', agentId: 'agent-1' },
      expect.anything(),
      'AP Norte'
    );
  });

  it('[WLS-225] refuses a radio no one can reach', async () => {
    mocks.deviceReach.readerFor.mockResolvedValue(
      Result.ok({ by: 'none' })
    );

    const result = await rename('AP Norte');

    expect(result.error).toBe(
      `Cannot rename the radio — ${OUT_OF_SERVER_REACH}`
    );
  });

  it('[AGT-120] names an agent too old to rename', async () => {
    mocks.gateway.setHostname.mockResolvedValue({
      ok: false,
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to rename radios'
    });

    const result = await rename('AP Norte');

    expect(result.error).toBe(
      `Cannot rename the radio — ${RADIO_SETTINGS_FAILURES.PROBE_UNSUPPORTED}: The agent must be updated to rename radios`
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      'Radio renamed',
      expect.anything()
    );
  });

  it('names a radio that refused', async () => {
    mocks.gateway.setHostname.mockResolvedValue({
      ok: false,
      reason: 'RADIO',
      error: 'SSH connection refused on port 22'
    });

    const result = await rename('AP Norte');

    expect(result.error).toBe(
      `Cannot rename the radio — ${RADIO_SETTINGS_FAILURES.RADIO}: SSH connection refused on port 22`
    );
  });

  it('rejects a malformed device id', async () => {
    const result = await useCase.execute({
      deviceId: 'nope',
      hostname: 'AP',
      renamedBy: 'user-1'
    });

    expect(result.error).toContain('Invalid device ID');
  });
});
