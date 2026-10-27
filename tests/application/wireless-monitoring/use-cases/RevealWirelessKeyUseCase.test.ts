// Source: src/application/wireless-monitoring/use-cases/RevealWirelessKeyUseCase.ts

import { RevealWirelessKeyUseCase } from '../../../../src/application/wireless-monitoring/use-cases/RevealWirelessKeyUseCase';
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
  makeConfig,
  makeLogger,
  makeMocks
} from './radioSettingsFixtures';

const NOW = new Date('2026-10-27T15:00:00.000Z');
const READING = {
  role: 'ACCESS_POINT' as const,
  ssid: 'AP Norte',
  security: 'WPA_PSK' as const,
  key: 'clave-secreta'
};

describe('RevealWirelessKeyUseCase', () => {
  let mocks: RadioSettingsMocks;
  let logger: ReturnType<typeof makeLogger>;
  let useCase: RevealWirelessKeyUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    logger = makeLogger();
    mocks.gateway.readWirelessSecurity.mockResolvedValue({
      ok: true,
      value: READING
    });
    useCase = new RevealWirelessKeyUseCase(
      mocks.sources,
      mocks.gateway,
      logger,
      () => NOW
    );
  });

  const reveal = () =>
    useCase.execute({ deviceId: DEVICE_UUID, revealedBy: 'user-1' });

  it('[WLS-220] reads the key from the radio and returns it in plaintext', async () => {
    const result = await reveal();

    expect(result.value).toEqual({
      deviceId: DEVICE_UUID,
      ...READING,
      readAt: NOW.toISOString()
    });
    expect(mocks.gateway.readWirelessSecurity).toHaveBeenCalledWith(
      { by: 'server' },
      {
        ipAddress: RADIO_IP,
        vendor: 'ubiquiti',
        deviceType: 'ACCESS_POINT',
        login: LOGIN
      }
    );
  });

  it('[WLS-220] logs who saw which device, and never the key', async () => {
    await reveal();

    expect(logger.warn).toHaveBeenCalledWith('Wi-Fi key revealed', {
      deviceId: DEVICE_UUID,
      revealedBy: 'user-1'
    });
    const logged = JSON.stringify(
      [logger.info, logger.warn, logger.debug, logger.error].flatMap(
        (fn) => (fn as jest.Mock).mock.calls
      )
    );
    expect(logged).not.toContain('clave-secreta');
  });

  it('[WLS-225] reads through the agent the radio sits behind', async () => {
    mocks.deviceReach.readerFor.mockResolvedValue(
      Result.ok({ by: 'agent', agentId: 'agent-1' })
    );

    await reveal();

    expect(mocks.gateway.readWirelessSecurity).toHaveBeenCalledWith(
      { by: 'agent', agentId: 'agent-1' },
      expect.anything()
    );
  });

  it('[WLS-225] refuses a radio no one can reach, without asking', async () => {
    mocks.deviceReach.readerFor.mockResolvedValue(
      Result.ok({ by: 'none' })
    );

    const result = await reveal();

    expect(result.error).toBe(
      `Cannot read the Wi-Fi key — ${OUT_OF_SERVER_REACH}`
    );
    expect(mocks.gateway.readWirelessSecurity).not.toHaveBeenCalled();
  });

  it('names the agent failure and its detail', async () => {
    mocks.gateway.readWirelessSecurity.mockResolvedValue({
      ok: false,
      reason: 'AGENT_OFFLINE',
      error: 'The agent is not connected'
    });

    const result = await reveal();

    expect(result.error).toBe(
      `Cannot read the Wi-Fi key — ${RADIO_SETTINGS_FAILURES.AGENT_OFFLINE}: The agent is not connected`
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      'Wi-Fi key revealed',
      expect.anything()
    );
  });

  it.each([
    [
      'no wireless config',
      (m: RadioSettingsMocks) =>
        m.configRepo.findByDeviceId.mockResolvedValue(
          Result.ok(null)
        ),
      'No wireless polling configuration found for device'
    ],
    [
      'no IP address',
      (m: RadioSettingsMocks) =>
        m.configRepo.findByDeviceId.mockResolvedValue(
          Result.ok(makeConfig(null))
        ),
      'IP address not configured for device'
    ],
    [
      'no vendor',
      (m: RadioSettingsMocks) =>
        m.vendorLookup.findVendorSlug.mockResolvedValue(
          Result.ok(null)
        ),
      'Vendor not configured for device'
    ],
    [
      'no HTTP login',
      (m: RadioSettingsMocks) =>
        m.loginSource.findByDeviceId.mockResolvedValue(
          Result.ok(null)
        ),
      'HTTP credentials not configured for device'
    ]
  ])('fails with %s', async (_name, arrange, message) => {
    arrange(mocks);

    const result = await reveal();

    expect(result.error).toBe(
      `Cannot read the Wi-Fi key — ${message}`
    );
    expect(mocks.gateway.readWirelessSecurity).not.toHaveBeenCalled();
  });

  it('rejects a malformed device id', async () => {
    const result = await useCase.execute({
      deviceId: 'not-a-uuid',
      revealedBy: 'user-1'
    });

    expect(result.error).toContain('Invalid device ID');
  });

  it('requires a device id', async () => {
    const result = await useCase.execute({
      deviceId: ' ',
      revealedBy: 'user-1'
    });

    expect(result.error).toBe('Device ID is required');
  });
});
