// Source: src/presentation/http/controllers/WirelessStreamController.ts

import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { WirelessStreamController } from '../../../../src/presentation/http/controllers/WirelessStreamController';
import { GetWirelessThroughputUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessThroughputUseCase';
import { GetFleetWirelessThroughputUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetFleetWirelessThroughputUseCase';
import {
  ILogger,
  IEventStreamHub
} from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core/Result';
import { WirelessThroughputDTO } from '../../../../src/application/wireless-monitoring/dtos';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockLogger = (): jest.Mocked<ILogger> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis() as jest.Mocked<ILogger>['child'],
  setLevel: jest.fn()
});

const createMockHub = (): jest.Mocked<IEventStreamHub> => ({
  subscribe: jest.fn().mockReturnValue(jest.fn()),
  publish: jest.fn(),
  clientCount: jest.fn().mockReturnValue(0),
  closeAll: jest.fn()
});

// req doubles as the EventEmitter the controller hangs its 'close' teardown on
const createMockRequest = (
  overrides: Partial<Request> = {}
): Request & EventEmitter => {
  const req = new EventEmitter() as Request & EventEmitter;
  Object.assign(req, {
    body: {},
    params: {},
    query: {},
    user: { userId: 'user-1', email: 'a@b.c', role: 'ADMIN' },
    ...overrides
  });
  return req;
};

const createMockResponse = () => {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  const res = {
    status: statusMock,
    json: jsonMock,
    writeHead: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    headersSent: false
  } as unknown as Response;
  return { res, statusMock, jsonMock };
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const DEVICE_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const DEVICE_CHANNEL = `throughput:device:${DEVICE_UUID}`;
const FLEET_CHANNEL = 'throughput:fleet';

const mockThroughputDTO: WirelessThroughputDTO = {
  deviceId: DEVICE_UUID,
  deviceType: 'STATION',
  collectedAt: '2026-08-12T10:00:00.000Z',
  ageSeconds: 12,
  stale: false,
  throughputTxBps: 8_000_000,
  throughputRxBps: 2_000_000,
  throughputTotalBps: 10_000_000,
  linkCapacityKbps: 50_000,
  utilisationPercent: 20
};

// ---------------------------------------------------------------------------

describe('[WLS-146] WirelessStreamController', () => {
  let getThroughput: { execute: jest.Mock };
  let getFleetThroughput: { execute: jest.Mock };
  let hub: jest.Mocked<IEventStreamHub>;
  let logger: jest.Mocked<ILogger>;
  let controller: WirelessStreamController;

  beforeEach(() => {
    getThroughput = { execute: jest.fn() };
    getFleetThroughput = { execute: jest.fn() };
    hub = createMockHub();
    logger = createMockLogger();

    controller = new WirelessStreamController(
      getThroughput as unknown as GetWirelessThroughputUseCase,
      getFleetThroughput as unknown as GetFleetWirelessThroughputUseCase,
      hub,
      logger
    );
  });

  describe('streamDeviceThroughput', () => {
    it('opens the stream with SSE headers and the current reading', async () => {
      getThroughput.execute.mockResolvedValue(
        Result.ok(mockThroughputDTO)
      );
      const req = createMockRequest({ params: { id: DEVICE_UUID } });
      const { res } = createMockResponse();

      await controller.streamDeviceThroughput(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no'
        })
      );
      expect(res.flushHeaders).toHaveBeenCalled();

      const written = (res.write as jest.Mock).mock.calls.map(
        (c) => c[0]
      );
      expect(written[0]).toBe('retry: 5000\n\n');
      expect(written[1]).toBe(
        `event: throughput\ndata: ${JSON.stringify(mockThroughputDTO)}\n\n`
      );
    });

    it('subscribes the response to the device channel', async () => {
      getThroughput.execute.mockResolvedValue(
        Result.ok(mockThroughputDTO)
      );
      const req = createMockRequest({ params: { id: DEVICE_UUID } });
      const { res } = createMockResponse();

      await controller.streamDeviceThroughput(req, res);

      expect(hub.subscribe).toHaveBeenCalledWith(DEVICE_CHANNEL, res);
    });

    it('unsubscribes when the client disconnects', async () => {
      const unsubscribe = jest.fn();
      hub.subscribe.mockReturnValue(unsubscribe);
      getThroughput.execute.mockResolvedValue(
        Result.ok(mockThroughputDTO)
      );
      const req = createMockRequest({ params: { id: DEVICE_UUID } });
      const { res } = createMockResponse();

      await controller.streamDeviceThroughput(req, res);
      req.emit('close');

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    // the status code cannot be taken back once the stream opens
    describe('failures answer as JSON before the stream opens', () => {
      it('maps a never-polled device to 404', async () => {
        getThroughput.execute.mockResolvedValue(
          Result.fail('No wireless data found for device')
        );
        const req = createMockRequest({
          params: { id: DEVICE_UUID }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        await controller.streamDeviceThroughput(req, res);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'No wireless data found for device'
        });
        expect(res.writeHead).not.toHaveBeenCalled();
        expect(hub.subscribe).not.toHaveBeenCalled();
      });

      it('maps an invalid id to 400', async () => {
        getThroughput.execute.mockResolvedValue(
          Result.fail('Invalid device ID: malformed')
        );
        const req = createMockRequest({ params: { id: 'bad' } });
        const { res, statusMock } = createMockResponse();

        await controller.streamDeviceThroughput(req, res);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('maps anything else to 500', async () => {
        getThroughput.execute.mockResolvedValue(
          Result.fail('Failed to load wireless throughput: reset')
        );
        const req = createMockRequest({
          params: { id: DEVICE_UUID }
        });
        const { res, statusMock } = createMockResponse();

        await controller.streamDeviceThroughput(req, res);

        expect(statusMock).toHaveBeenCalledWith(500);
      });

      it('answers 500 when the use case throws', async () => {
        getThroughput.execute.mockRejectedValue(new Error('boom'));
        const req = createMockRequest({
          params: { id: DEVICE_UUID }
        });
        const { res, statusMock } = createMockResponse();

        await controller.streamDeviceThroughput(req, res);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(logger.error).toHaveBeenCalled();
      });
    });
  });

  describe('streamFleetThroughput', () => {
    const fleetPayload = {
      devices: [mockThroughputDTO],
      total: 1
    };

    // the opening frame is the whole fleet; later frames are per-device deltas
    it('opens with a throughput-snapshot frame carrying the full list', async () => {
      getFleetThroughput.execute.mockResolvedValue(
        Result.ok(fleetPayload)
      );
      const req = createMockRequest();
      const { res } = createMockResponse();

      await controller.streamFleetThroughput(req, res);

      const written = (res.write as jest.Mock).mock.calls.map(
        (c) => c[0]
      );
      expect(written[1]).toBe(
        `event: throughput-snapshot\ndata: ${JSON.stringify(fleetPayload)}\n\n`
      );
      expect(hub.subscribe).toHaveBeenCalledWith(FLEET_CHANNEL, res);
    });

    it('answers JSON on failure without opening the stream', async () => {
      getFleetThroughput.execute.mockResolvedValue(
        Result.fail('Failed to load fleet throughput: reset')
      );
      const req = createMockRequest();
      const { res, statusMock } = createMockResponse();

      await controller.streamFleetThroughput(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(res.writeHead).not.toHaveBeenCalled();
    });
  });

  describe('[WLS-150] connection caps', () => {
    async function openDeviceStream(
      req: Request & EventEmitter
    ): Promise<ReturnType<typeof createMockResponse>> {
      const mock = createMockResponse();
      await controller.streamDeviceThroughput(req, mock.res);
      return mock;
    }

    beforeEach(() => {
      getThroughput.execute.mockResolvedValue(
        Result.ok(mockThroughputDTO)
      );
    });

    it('rejects the sixth concurrent stream for one user with 429', async () => {
      const opened = [];
      for (let i = 0; i < 5; i++) {
        opened.push(
          await openDeviceStream(
            createMockRequest({ params: { id: DEVICE_UUID } })
          )
        );
      }
      expect(
        opened.every((o) => o.statusMock.mock.calls.length === 0)
      ).toBe(true);

      const sixth = await openDeviceStream(
        createMockRequest({ params: { id: DEVICE_UUID } })
      );

      expect(sixth.statusMock).toHaveBeenCalledWith(429);
      expect(sixth.jsonMock).toHaveBeenCalledWith({
        error: 'Too many streams'
      });
    });

    it('frees the slot when a stream closes', async () => {
      const requests: (Request & EventEmitter)[] = [];
      for (let i = 0; i < 5; i++) {
        const req = createMockRequest({
          params: { id: DEVICE_UUID }
        });
        requests.push(req);
        await openDeviceStream(req);
      }

      requests[0].emit('close');

      const next = await openDeviceStream(
        createMockRequest({ params: { id: DEVICE_UUID } })
      );
      expect(next.statusMock).not.toHaveBeenCalled();
    });

    it('counts users separately', async () => {
      for (let i = 0; i < 5; i++) {
        await openDeviceStream(
          createMockRequest({ params: { id: DEVICE_UUID } })
        );
      }

      const other = await openDeviceStream(
        createMockRequest({
          params: { id: DEVICE_UUID },
          user: { userId: 'user-2', email: 'x@y.z', role: 'ADMIN' }
        })
      );

      expect(other.statusMock).not.toHaveBeenCalled();
    });

    it('rejects with 429 once the fleet-wide total is reached', async () => {
      hub.clientCount.mockReturnValue(200);

      const mock = await openDeviceStream(
        createMockRequest({ params: { id: DEVICE_UUID } })
      );

      expect(mock.statusMock).toHaveBeenCalledWith(429);
      expect(logger.warn).toHaveBeenCalled();
    });

    // a rejected use case must give its reserved slot back
    it('releases the slot when the initial read fails', async () => {
      getThroughput.execute.mockResolvedValue(
        Result.fail('No wireless data found for device')
      );

      for (let i = 0; i < 6; i++) {
        await openDeviceStream(
          createMockRequest({ params: { id: DEVICE_UUID } })
        );
      }

      getThroughput.execute.mockResolvedValue(
        Result.ok(mockThroughputDTO)
      );
      const next = await openDeviceStream(
        createMockRequest({ params: { id: DEVICE_UUID } })
      );

      expect(next.statusMock).not.toHaveBeenCalled();
    });
  });
});
