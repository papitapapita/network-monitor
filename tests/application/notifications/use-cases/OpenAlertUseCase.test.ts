import { OpenAlertUseCase } from '../../../../src/application/notifications/use-cases/OpenAlertUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { OpenAlertDTO } from '../../../../src/application/notifications/dtos/OpenAlertDTO';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440080';

function makeLogger(): ILogger {
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

function makeAlertRepo(): jest.Mocked<IAlertRepository> {
  return {
    save: jest.fn().mockImplementation(async (a) => Result.ok(a)),
    findById: jest.fn(),
    findOpenByDeviceAndType: jest
      .fn()
      .mockResolvedValue(Result.ok(null)),
    findAllByDeviceId: jest.fn(),
    findAll: jest.fn(),
    deleteById: jest.fn(),
    deleteResolvedOlderThan: jest.fn()
  };
}

function makeRequest(
  overrides: Partial<OpenAlertDTO> = {}
): OpenAlertDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    severity: AlertSeverity.CRITICAL,
    source: 'Enlace inalámbrico',
    type: 'wireless:signal_rx_dbm:CRITICAL',
    description: 'Señal crítica',
    details: {
      metric: 'signal_rx_dbm',
      threshold: -80,
      currentValue: -83
    },
    ...overrides
  };
}

describe('OpenAlertUseCase', () => {
  let repo: jest.Mocked<IAlertRepository>;
  let useCase: OpenAlertUseCase;

  beforeEach(() => {
    repo = makeAlertRepo();
    useCase = new OpenAlertUseCase(repo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('should fail on an invalid device id', async () => {
    const result = await useCase.execute(
      makeRequest({ deviceId: 'nope' })
    );
    expect(result.isFailure).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should be a no-op when an alert of that type is already open (dedup)', async () => {
    const existing = Alert.open(
      DeviceId.parse(VALID_DEVICE_UUID).value,
      AlertSeverity.CRITICAL,
      'Enlace inalámbrico',
      'wireless:signal_rx_dbm:CRITICAL',
      'x'
    ).value;
    repo.findOpenByDeviceAndType.mockResolvedValue(
      Result.ok(existing)
    );

    const result = await useCase.execute(makeRequest());
    expect(result.isSuccess).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should create and save a new alert carrying type, source and details', async () => {
    const result = await useCase.execute(makeRequest());
    expect(result.isSuccess).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.type).toBe('wireless:signal_rx_dbm:CRITICAL');
    expect(saved.source).toBe('Enlace inalámbrico');
    expect(saved.details).toMatchObject({ metric: 'signal_rx_dbm' });
  });

  it('should fail when save fails', async () => {
    repo.save.mockResolvedValue(Result.fail('db down'));
    const result = await useCase.execute(makeRequest());
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to save alert');
  });

  // `Alert` raises no domain events, so this hook is the only seam where a
  // newly recorded alert becomes a work order.
  describe('ticket hook', () => {
    let ticketOpener: { openFromAlert: jest.Mock };
    let logger: ILogger;

    beforeEach(() => {
      ticketOpener = {
        openFromAlert: jest.fn().mockResolvedValue(Result.ok())
      };
      logger = makeLogger();
      useCase = new OpenAlertUseCase(repo, logger, ticketOpener);
    });

    it('[TKT-113] opens a ticket for a newly recorded alert', async () => {
      await useCase.execute(makeRequest());

      expect(ticketOpener.openFromAlert).toHaveBeenCalledTimes(1);
      expect(ticketOpener.openFromAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: VALID_DEVICE_UUID,
          severity: AlertSeverity.CRITICAL,
          message: 'Señal crítica'
        })
      );
    });

    it('[TKT-113] passes the saved alert id as the dedupe key', async () => {
      await useCase.execute(makeRequest());

      const savedAlert = repo.save.mock.calls[0][0];
      expect(ticketOpener.openFromAlert).toHaveBeenCalledWith(
        expect.objectContaining({ alertId: savedAlert.id.toString() })
      );
    });

    it('[TKT-110] routes a wireless alert type to WIRELESS_ALERT', async () => {
      await useCase.execute(
        makeRequest({ type: 'wireless:ccq_percent:WARNING' })
      );

      expect(ticketOpener.openFromAlert).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'WIRELESS_ALERT' })
      );
    });

    it('[TKT-110] routes any other alert type to DEVICE_ALERT', async () => {
      await useCase.execute(makeRequest({ type: 'device:down' }));

      expect(ticketOpener.openFromAlert).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'DEVICE_ALERT' })
      );
    });

    it('[TKT-113] does not open a ticket when the alert was already open', async () => {
      const existing = Alert.open(
        DeviceId.parse(VALID_DEVICE_UUID).value,
        AlertSeverity.CRITICAL,
        'Enlace inalámbrico',
        'wireless:signal_rx_dbm:CRITICAL',
        'x'
      ).value;
      repo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(existing)
      );

      await useCase.execute(makeRequest());

      expect(ticketOpener.openFromAlert).not.toHaveBeenCalled();
    });

    it('does not open a ticket when the alert failed to save', async () => {
      repo.save.mockResolvedValue(Result.fail('db down'));

      await useCase.execute(makeRequest());

      expect(ticketOpener.openFromAlert).not.toHaveBeenCalled();
    });

    it('still records the alert when opening a ticket fails', async () => {
      ticketOpener.openFromAlert.mockResolvedValue(
        Result.fail('tickets unavailable')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('still records the alert when the ticket opener throws', async () => {
      ticketOpener.openFromAlert.mockRejectedValue(
        new Error('connection lost')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('records the alert normally when no ticket opener is wired in', async () => {
      const withoutTickets = new OpenAlertUseCase(repo, makeLogger());

      const result = await withoutTickets.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });
});
