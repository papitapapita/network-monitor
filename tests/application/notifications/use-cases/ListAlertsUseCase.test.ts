// Source: src/application/notifications/use-cases/ListAlertsUseCase.ts

import { ListAlertsUseCase } from '../../../../src/application/notifications/use-cases/ListAlertsUseCase';
import { IAlertListQuery } from '../../../../src/application/notifications/interfaces';
import { AlertListItemDTO } from '../../../../src/application/notifications/dtos';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440020';
const VALID_ALERT_UUID = '550e8400-e29b-41d4-a716-446655440021';

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

function makeQuery(): jest.Mocked<IAlertListQuery> {
  return {
    list: jest.fn().mockResolvedValue(Result.ok([])),
    count: jest.fn().mockResolvedValue(Result.ok(0))
  };
}

function makeItem(): AlertListItemDTO {
  return {
    id: VALID_ALERT_UUID,
    deviceId: VALID_DEVICE_UUID,
    deviceName: 'Router A',
    severity: 'CRITICAL',
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión',
    details: {},
    status: 'OPEN',
    startedAt: '2024-06-01T10:00:00.000Z',
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null,
    durationSecs: null
  };
}

describe('ListAlertsUseCase', () => {
  let query: jest.Mocked<IAlertListQuery>;
  let useCase: ListAlertsUseCase;

  beforeEach(() => {
    query = makeQuery();
    useCase = new ListAlertsUseCase(query, makeLogger());
  });

  describe('pagination', () => {
    it('defaults to limit=50 and offset=0', async () => {
      await useCase.execute({});

      expect(query.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, offset: 0 })
      );
    });

    it('passes the provided limit and offset', async () => {
      await useCase.execute({ limit: 10, offset: 20 });

      expect(query.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('[NOT-134] takes total from the count, not from the page length', async () => {
      query.list.mockResolvedValue(
        Result.ok([makeItem(), makeItem()])
      );
      query.count.mockResolvedValue(Result.ok(30));

      const result = await useCase.execute({ limit: 2, offset: 0 });

      expect(result.value.total).toBe(30);
      expect(result.value.hasMore).toBe(true);
      expect(result.value.alerts).toHaveLength(2);
    });

    it('[NOT-134] counts over the same filters, without limit or offset', async () => {
      await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        status: 'OPEN',
        severity: 'WARNING',
        limit: 5,
        offset: 10
      });

      const counted = query.count.mock.calls[0][0];
      expect(counted.deviceId?.toString()).toBe(VALID_DEVICE_UUID);
      expect(counted.status).toBe('OPEN');
      expect(counted.severity).toBe(AlertSeverity.WARNING);
      expect(counted).not.toHaveProperty('limit');
      expect(counted).not.toHaveProperty('offset');
    });
  });

  describe('[NOT-135] filters', () => {
    it('passes no filters when none are requested', async () => {
      await useCase.execute({});

      const criteria = query.list.mock.calls[0][0];
      expect(criteria.deviceId).toBeUndefined();
      expect(criteria.status).toBeUndefined();
      expect(criteria.severity).toBeUndefined();
    });

    it('parses deviceId into a DeviceId', async () => {
      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(query.list.mock.calls[0][0].deviceId?.toString()).toBe(
        VALID_DEVICE_UUID
      );
    });

    it('passes status and severity through', async () => {
      await useCase.execute({
        status: 'RESOLVED',
        severity: 'CRITICAL'
      });

      const criteria = query.list.mock.calls[0][0];
      expect(criteria.status).toBe('RESOLVED');
      expect(criteria.severity).toBe(AlertSeverity.CRITICAL);
    });

    it.each([
      [{ deviceId: 'not-a-valid-uuid' }, 'Invalid device ID'],
      [{ status: 'CLOSED' }, 'Invalid alert status'],
      [{ severity: 'INFO' }, 'Invalid alert severity']
    ])('rejects %p without querying', async (request, message) => {
      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(message);
      expect(query.list).not.toHaveBeenCalled();
    });
  });

  describe('results', () => {
    it('returns the items the query built, device name included', async () => {
      const item = makeItem();
      query.list.mockResolvedValue(Result.ok([item]));
      query.count.mockResolvedValue(Result.ok(1));

      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      expect(result.value.alerts).toEqual([item]);
    });

    it('fails when list fails', async () => {
      query.list.mockResolvedValue(Result.fail('connection lost'));

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to list alerts');
    });

    it('fails when count fails', async () => {
      query.count.mockResolvedValue(Result.fail('connection lost'));

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to count alerts');
    });
  });
});
