// Source: src/presentation/http/controllers/WirelessController.ts

import { Request, Response } from 'express';
import { WirelessController } from '../../../../src/presentation/http/controllers/WirelessController';
import { GetWirelessDeviceStatusUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessDeviceStatusUseCase';
import { GetWirelessDeviceHistoryUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessDeviceHistoryUseCase';
import { GetWirelessClientsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessClientsUseCase';
import { GetActiveWirelessAlertsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetActiveWirelessAlertsUseCase';
import { GetWirelessAlertHistoryUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessAlertHistoryUseCase';
import { TriggerWirelessPollUseCase } from '../../../../src/application/wireless-monitoring/use-cases/TriggerWirelessPollUseCase';
import { CreateWirelessConfigUseCase } from '../../../../src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase';
import { GetWirelessConfigUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessConfigUseCase';
import { UpdateWirelessConfigUseCase } from '../../../../src/application/wireless-monitoring/use-cases/UpdateWirelessConfigUseCase';
import { DeleteWirelessConfigUseCase } from '../../../../src/application/wireless-monitoring/use-cases/DeleteWirelessConfigUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal wireless status snapshot shape. */
interface WirelessStatusDTO {
  deviceId: string;
  ssid: string;
  channel: number;
  frequency: number;
  txPower: number;
  connectedClients: number;
  snapshotAt: string;
}

/** Minimal wireless client shape. */
interface WirelessClientDTO {
  mac: string;
  ipAddress: string;
  signal: number;
  connectedSince: string;
}

/** Minimal wireless alert shape. */
interface WirelessAlertDTO {
  id: string;
  deviceId: string;
  type: string;
  triggeredAt: string;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockGetStatusUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetWirelessDeviceStatusUseCase;

const createMockGetHistoryUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetWirelessDeviceHistoryUseCase;

const createMockGetClientsUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetWirelessClientsUseCase;

const createMockGetActiveAlertsUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetActiveWirelessAlertsUseCase;

const createMockGetAlertHistoryUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetWirelessAlertHistoryUseCase;

const createMockTriggerPollUseCase = () =>
  ({ execute: jest.fn() }) as unknown as TriggerWirelessPollUseCase;

const createMockCreateWirelessConfigUseCase = () =>
  ({ execute: jest.fn() }) as unknown as CreateWirelessConfigUseCase;

const createMockGetWirelessConfigUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetWirelessConfigUseCase;

const createMockUpdateWirelessConfigUseCase = () =>
  ({ execute: jest.fn() }) as unknown as UpdateWirelessConfigUseCase;

const createMockDeleteWirelessConfigUseCase = () =>
  ({ execute: jest.fn() }) as unknown as DeleteWirelessConfigUseCase;

const createMockLogger = (): jest.Mocked<ILogger> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis() as jest.Mocked<ILogger>['child'],
  setLevel: jest.fn()
});

const createMockRequest = (
  overrides: Partial<Request> = {}
): Partial<Request> => ({
  body: {},
  params: {},
  query: {},
  ...overrides
});

const createMockResponse = (): {
  res: Partial<Response>;
  statusMock: jest.Mock;
  jsonMock: jest.Mock;
} => {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock }, statusMock, jsonMock };
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const DEVICE_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const mockStatusDTO: WirelessStatusDTO = {
  deviceId: DEVICE_UUID,
  ssid: 'MyNetwork',
  channel: 6,
  frequency: 2437,
  txPower: 20,
  connectedClients: 3,
  snapshotAt: '2024-01-15T10:30:00.000Z'
};

const mockHistoryDTO = [mockStatusDTO];

const mockClientDTO: WirelessClientDTO = {
  mac: 'AA:BB:CC:DD:EE:FF',
  ipAddress: '192.168.1.100',
  signal: -65,
  connectedSince: '2024-01-15T09:00:00.000Z'
};

const mockClientsDTO = [mockClientDTO];

const mockAlertDTO: WirelessAlertDTO = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  deviceId: DEVICE_UUID,
  type: 'HIGH_INTERFERENCE',
  triggeredAt: '2024-01-15T10:00:00.000Z'
};

const mockAlertsDTO = [mockAlertDTO];

const mockTriggerPollResult = {
  deviceId: DEVICE_UUID,
  accepted: true,
  queuedAt: '2024-01-15T10:30:00.000Z'
};

// ---------------------------------------------------------------------------

describe('WirelessController', () => {
  let controller: WirelessController;
  let mockGetStatusUseCase: GetWirelessDeviceStatusUseCase;
  let mockGetHistoryUseCase: GetWirelessDeviceHistoryUseCase;
  let mockGetClientsUseCase: GetWirelessClientsUseCase;
  let mockGetActiveAlertsUseCase: GetActiveWirelessAlertsUseCase;
  let mockGetAlertHistoryUseCase: GetWirelessAlertHistoryUseCase;
  let mockTriggerPollUseCase: TriggerWirelessPollUseCase;
  let mockCreateWirelessConfigUseCase: CreateWirelessConfigUseCase;
  let mockGetWirelessConfigUseCase: GetWirelessConfigUseCase;
  let mockUpdateWirelessConfigUseCase: UpdateWirelessConfigUseCase;
  let mockDeleteWirelessConfigUseCase: DeleteWirelessConfigUseCase;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockGetStatusUseCase = createMockGetStatusUseCase();
    mockGetHistoryUseCase = createMockGetHistoryUseCase();
    mockGetClientsUseCase = createMockGetClientsUseCase();
    mockGetActiveAlertsUseCase = createMockGetActiveAlertsUseCase();
    mockGetAlertHistoryUseCase = createMockGetAlertHistoryUseCase();
    mockTriggerPollUseCase = createMockTriggerPollUseCase();
    mockCreateWirelessConfigUseCase = createMockCreateWirelessConfigUseCase();
    mockGetWirelessConfigUseCase = createMockGetWirelessConfigUseCase();
    mockUpdateWirelessConfigUseCase = createMockUpdateWirelessConfigUseCase();
    mockDeleteWirelessConfigUseCase = createMockDeleteWirelessConfigUseCase();
    mockLogger = createMockLogger();

    controller = new WirelessController(
      mockGetStatusUseCase,
      mockGetHistoryUseCase,
      mockGetClientsUseCase,
      mockGetActiveAlertsUseCase,
      mockGetAlertHistoryUseCase,
      mockTriggerPollUseCase,
      mockCreateWirelessConfigUseCase,
      mockGetWirelessConfigUseCase,
      mockUpdateWirelessConfigUseCase,
      mockDeleteWirelessConfigUseCase,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('getStatus (GET /api/devices/:id/wireless/status)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with the wireless status snapshot directly (no wrapper)', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockStatusDTO)
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockStatusDTO);
      });

      it('should pass deviceId to the use case', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res } = createMockResponse();

        (mockGetStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockStatusDTO)
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(mockGetStatusUseCase.execute).toHaveBeenCalledWith({
          deviceId: DEVICE_UUID
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });

      it('should return 404 when the use case fails with "NOT_FOUND"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockGetStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('NOT_FOUND')
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a non-404 error', async () => {
        const mockReq = createMockRequest({ params: { id: 'bad-id' } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid device ID format')
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Invalid device ID format'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Unexpected DB crash');
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetStatusUseCase.execute as jest.Mock).mockRejectedValue(thrownError);

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in WirelessController',
          thrownError,
          { error: 'Unexpected DB crash' }
        );
      });

      it('should not leak sensitive error details in the response body', async () => {
        const sensitiveError = new Error('SELECT * FROM wireless; -- injected');
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, jsonMock } = createMockResponse();

        (mockGetStatusUseCase.execute as jest.Mock).mockRejectedValue(
          sensitiveError
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(jsonMock).not.toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining('SELECT')
          })
        );
      });

      it('should handle non-Error thrown values by converting them to strings', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockGetStatusUseCase.execute as jest.Mock).mockRejectedValue(
          'string exception'
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in WirelessController',
          'string exception',
          { error: 'string exception' }
        );
      });
    });
  });

  // =========================================================================
  describe('getHistory (GET /api/devices/:id/wireless/history)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with the history array directly (no wrapper)', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {
            from: '2024-01-01T00:00:00.000Z',
            to: '2024-01-31T23:59:59.999Z'
          }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockHistoryDTO)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockHistoryDTO);
      });

      it('should convert from and to query strings to Date objects before calling the use case', async () => {
        const fromStr = '2024-01-01T00:00:00.000Z';
        const toStr = '2024-01-31T23:59:59.999Z';
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: { from: fromStr, to: toStr }
        });
        const { res } = createMockResponse();

        (mockGetHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockHistoryDTO)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        const call = (mockGetHistoryUseCase.execute as jest.Mock).mock
          .calls[0][0];
        expect(call.from).toBeInstanceOf(Date);
        expect(call.to).toBeInstanceOf(Date);
        expect(call.deviceId).toBe(DEVICE_UUID);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {
            from: '2024-01-01T00:00:00.000Z',
            to: '2024-01-31T23:59:59.999Z'
          }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });

      it('should return 404 when the use case fails with "NOT_FOUND"', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {
            from: '2024-01-01T00:00:00.000Z',
            to: '2024-01-31T23:59:59.999Z'
          }
        });
        const { res, statusMock } = createMockResponse();

        (mockGetHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('NOT_FOUND')
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a non-404 error', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {
            from: 'not-a-date',
            to: '2024-01-31T23:59:59.999Z'
          }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid date range')
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Invalid date range'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('History fetch failed');
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {
            from: '2024-01-01T00:00:00.000Z',
            to: '2024-01-31T23:59:59.999Z'
          }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetHistoryUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in WirelessController',
          thrownError,
          { error: 'History fetch failed' }
        );
      });
    });
  });

  // =========================================================================
  describe('getClients (GET /api/devices/:id/wireless/clients)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with the clients list directly (no wrapper)', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetClientsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockClientsDTO)
        );

        await controller.getClients(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockClientsDTO);
      });

      it('should pass deviceId to the use case', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res } = createMockResponse();

        (mockGetClientsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockClientsDTO)
        );

        await controller.getClients(mockReq as Request, res as Response);

        expect(mockGetClientsUseCase.execute).toHaveBeenCalledWith({
          deviceId: DEVICE_UUID
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetClientsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.getClients(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });

      it('should return 404 when the use case fails with "NOT_AP"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockGetClientsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('NOT_AP: device is not an access point')
        );

        await controller.getClients(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it('should return 404 when the use case fails with "NOT_FOUND"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockGetClientsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('NOT_FOUND')
        );

        await controller.getClients(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a non-404 error', async () => {
        const mockReq = createMockRequest({ params: { id: 'bad-id' } });
        const { res, statusMock } = createMockResponse();

        (mockGetClientsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid device ID format')
        );

        await controller.getClients(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });
  });

  // =========================================================================
  describe('getDeviceActiveAlerts (GET /api/devices/:id/wireless/alerts)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with the active alerts directly (no wrapper)', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getDeviceActiveAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockAlertsDTO);
      });

      it('should pass deviceId to the use case', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getDeviceActiveAlerts(
          mockReq as Request,
          res as Response
        );

        expect(mockGetActiveAlertsUseCase.execute).toHaveBeenCalledWith({
          deviceId: DEVICE_UUID
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.getDeviceActiveAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });

      it('should return 404 when the use case fails with "NOT_FOUND"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('NOT_FOUND')
        );

        await controller.getDeviceActiveAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a non-404 error', async () => {
        const mockReq = createMockRequest({ params: { id: 'bad-id' } });
        const { res, statusMock } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid device ID')
        );

        await controller.getDeviceActiveAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });
  });

  // =========================================================================
  describe('getDeviceAlertHistory (GET /api/devices/:id/wireless/alerts/history)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with the alert history directly (no wrapper)', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {
            from: '2024-01-01T00:00:00.000Z',
            to: '2024-01-31T23:59:59.999Z',
            limit: '50'
          }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getDeviceAlertHistory(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockAlertsDTO);
      });

      it('should pass deviceId and optional query params to the use case', async () => {
        const fromStr = '2024-01-01T00:00:00.000Z';
        const toStr = '2024-01-31T23:59:59.999Z';
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: { from: fromStr, to: toStr, limit: '25' }
        });
        const { res } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getDeviceAlertHistory(
          mockReq as Request,
          res as Response
        );

        const call = (mockGetAlertHistoryUseCase.execute as jest.Mock).mock
          .calls[0][0];
        expect(call.deviceId).toBe(DEVICE_UUID);
        expect(call.from).toBeInstanceOf(Date);
        expect(call.to).toBeInstanceOf(Date);
        expect(call.limit).toBe(25);
      });

      it('should pass undefined for optional params when absent from query', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {}
        });
        const { res } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getDeviceAlertHistory(
          mockReq as Request,
          res as Response
        );

        expect(mockGetAlertHistoryUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceId: DEVICE_UUID,
            from: undefined,
            to: undefined,
            limit: undefined
          })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {}
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.getDeviceAlertHistory(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a non-404 error', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {}
        });
        const { res, statusMock } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid date range provided')
        );

        await controller.getDeviceAlertHistory(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });
  });

  // =========================================================================
  describe('triggerPoll (POST /api/devices/:id/wireless/poll)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 202 with the poll acknowledgement directly (no wrapper)', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockTriggerPollUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockTriggerPollResult)
        );

        await controller.triggerPoll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(202);
        expect(jsonMock).toHaveBeenCalledWith(mockTriggerPollResult);
      });

      it('should pass deviceId to the use case', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res } = createMockResponse();

        (mockTriggerPollUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockTriggerPollResult)
        );

        await controller.triggerPoll(mockReq as Request, res as Response);

        expect(mockTriggerPollUseCase.execute).toHaveBeenCalledWith({
          deviceId: DEVICE_UUID
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockTriggerPollUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.triggerPoll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });

      it('should return 404 when the use case fails with "NOT_FOUND"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockTriggerPollUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('NOT_FOUND')
        );

        await controller.triggerPoll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a non-404 error', async () => {
        const mockReq = createMockRequest({ params: { id: 'bad-id' } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockTriggerPollUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Device is not configured for wireless monitoring')
        );

        await controller.triggerPoll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Device is not configured for wireless monitoring'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Poll trigger failed');
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockTriggerPollUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.triggerPoll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in WirelessController',
          thrownError,
          { error: 'Poll trigger failed' }
        );
      });
    });
  });

  // =========================================================================
  describe('getAllActiveAlerts (GET /api/wireless/alerts)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with all active alerts directly (no wrapper)', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getAllActiveAlerts(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockAlertsDTO);
      });

      it('should pass deviceId query param to the use case when provided', async () => {
        const mockReq = createMockRequest({
          query: { deviceId: DEVICE_UUID }
        });
        const { res } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getAllActiveAlerts(mockReq as Request, res as Response);

        expect(mockGetActiveAlertsUseCase.execute).toHaveBeenCalledWith({
          deviceId: DEVICE_UUID
        });
      });

      it('should pass undefined deviceId when absent from query', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getAllActiveAlerts(mockReq as Request, res as Response);

        expect(mockGetActiveAlertsUseCase.execute).toHaveBeenCalledWith({
          deviceId: undefined
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails', async () => {
        const mockReq = createMockRequest({
          query: { deviceId: 'not-a-uuid' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid device ID: not-a-uuid')
        );

        await controller.getAllActiveAlerts(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Invalid device ID: not-a-uuid'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Active alerts query failed');
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetActiveAlertsUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.getAllActiveAlerts(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in WirelessController',
          thrownError,
          { error: 'Active alerts query failed' }
        );
      });
    });
  });

  // =========================================================================
  describe('getAllAlertHistory (GET /api/wireless/alerts/history)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with alert history directly (no wrapper)', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getAllAlertHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockAlertsDTO);
      });

      it('should pass deviceId, from, to, and limit query params to the use case', async () => {
        const fromStr = '2024-01-01T00:00:00.000Z';
        const toStr = '2024-01-31T23:59:59.999Z';
        const mockReq = createMockRequest({
          query: {
            deviceId: DEVICE_UUID,
            from: fromStr,
            to: toStr,
            limit: '10'
          }
        });
        const { res } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getAllAlertHistory(mockReq as Request, res as Response);

        const call = (mockGetAlertHistoryUseCase.execute as jest.Mock).mock
          .calls[0][0];
        expect(call.deviceId).toBe(DEVICE_UUID);
        expect(call.from).toBeInstanceOf(Date);
        expect(call.to).toBeInstanceOf(Date);
        expect(call.limit).toBe(10);
      });

      it('should pass undefined for optional params when absent from query', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockAlertsDTO)
        );

        await controller.getAllAlertHistory(mockReq as Request, res as Response);

        expect(mockGetAlertHistoryUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceId: undefined,
            from: undefined,
            to: undefined,
            limit: undefined
          })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails', async () => {
        const mockReq = createMockRequest({ query: { limit: '-5' } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Limit must be a positive integer')
        );

        await controller.getAllAlertHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Limit must be a positive integer'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Alert history query failed');
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetAlertHistoryUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.getAllAlertHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in WirelessController',
          thrownError,
          { error: 'Alert history query failed' }
        );
      });
    });
  });
});
