// Source: src/presentation/http/controllers/InboxStreamController.ts

import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { InboxStreamController } from '../../../../src/presentation/http/controllers/InboxStreamController';
import { GetUnreadInboxCountUseCase } from '../../../../src/application/notifications/use-cases/GetUnreadInboxCountUseCase';
import {
  ILogger,
  IEventStreamHub
} from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core/Result';

const USER_ID = 'user-1';
const CHANNEL = `inbox:user:${USER_ID}`;

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
  userId = USER_ID
): Request & EventEmitter => {
  const req = new EventEmitter() as Request & EventEmitter;
  Object.assign(req, {
    params: {},
    query: {},
    user: { userId, email: 'a@b.c', role: 'VIEWER' }
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

const createUseCase = (
  result: Result<{ unread: number }> = Result.ok({ unread: 3 })
): jest.Mocked<GetUnreadInboxCountUseCase> =>
  ({
    execute: jest.fn().mockResolvedValue(result)
  }) as unknown as jest.Mocked<GetUnreadInboxCountUseCase>;

describe('InboxStreamController', () => {
  let hub: jest.Mocked<IEventStreamHub>;
  let useCase: jest.Mocked<GetUnreadInboxCountUseCase>;
  let controller: InboxStreamController;

  beforeEach(() => {
    hub = createMockHub();
    useCase = createUseCase();
    controller = new InboxStreamController(
      useCase,
      hub,
      createMockLogger()
    );
  });

  it('[NOT-265] opens with the caller’s unread count and subscribes to their channel', async () => {
    const req = createMockRequest();
    const { res } = createMockResponse();

    await controller.stream(req, res);

    expect(useCase.execute).toHaveBeenCalledWith({ userId: USER_ID });
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'text/event-stream; charset=utf-8'
      })
    );
    expect(res.write).toHaveBeenCalledWith(
      'event: unread\ndata: {"unread":3}\n\n'
    );
    expect(hub.subscribe).toHaveBeenCalledWith(CHANNEL, res);
  });

  it('unsubscribes when the client goes away', async () => {
    const unsubscribe = jest.fn();
    hub.subscribe.mockReturnValue(unsubscribe);
    const req = createMockRequest();
    const { res } = createMockResponse();

    await controller.stream(req, res);
    req.emit('close');

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('answers 500 before opening the stream when the count fails', async () => {
    useCase.execute.mockResolvedValue(Result.fail('db down'));
    const { res, statusMock } = createMockResponse();

    await controller.stream(createMockRequest(), res);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(res.writeHead).not.toHaveBeenCalled();
    expect(hub.subscribe).not.toHaveBeenCalled();
  });

  it('caps the streams one user holds at 10', async () => {
    for (let i = 0; i < 10; i++) {
      await controller.stream(
        createMockRequest(),
        createMockResponse().res
      );
    }
    const { res, statusMock } = createMockResponse();

    await controller.stream(createMockRequest(), res);

    expect(statusMock).toHaveBeenCalledWith(429);
    expect(hub.subscribe).toHaveBeenCalledTimes(10);
  });

  it('frees a slot when a stream closes', async () => {
    const requests = Array.from({ length: 10 }, () =>
      createMockRequest()
    );
    for (const req of requests) {
      await controller.stream(req, createMockResponse().res);
    }
    requests[0].emit('close');
    const { res, statusMock } = createMockResponse();

    await controller.stream(createMockRequest(), res);

    expect(statusMock).not.toHaveBeenCalled();
    expect(hub.subscribe).toHaveBeenCalledTimes(11);
  });

  it('refuses a new stream once the install-wide cap is reached', async () => {
    hub.clientCount.mockReturnValue(200);
    const { res, statusMock } = createMockResponse();

    await controller.stream(createMockRequest(), res);

    expect(statusMock).toHaveBeenCalledWith(429);
    expect(useCase.execute).not.toHaveBeenCalled();
  });
});
