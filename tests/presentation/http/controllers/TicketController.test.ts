// Source: src/presentation/http/controllers/TicketController.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { Request, Response } from 'express';
import { TicketController } from '../../../../src/presentation/http/controllers';
import { Result } from '../../../../src/domain/shared/core';

// `as any` on the mock fn matches the repo idiom and keeps mockResolvedValue
// from being inferred as `never`.
type UseCaseMock = { execute: any };

function makeUseCase(): UseCaseMock {
  return { execute: jest.fn() as any };
}

function makeLogger() {
  const logger: any = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
    setLevel: jest.fn()
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

function makeResponse() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as never;
  res.json = jest.fn().mockReturnValue(res) as never;
  res.send = jest.fn().mockReturnValue(res) as never;
  return res as Response;
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides
  } as Request;
}

describe('TicketController', () => {
  let create: UseCaseMock;
  let get: UseCaseMock;
  let list: UseCaseMock;
  let technicianDay: UseCaseMock;
  let update: UseCaseMock;
  let assign: UseCaseMock;
  let schedule: UseCaseMock;
  let start: UseCaseMock;
  let resolve: UseCaseMock;
  let cancel: UseCaseMock;
  let remove: UseCaseMock;
  let logger: ReturnType<typeof makeLogger>;
  let controller: TicketController;

  beforeEach(() => {
    create = makeUseCase();
    get = makeUseCase();
    list = makeUseCase();
    technicianDay = makeUseCase();
    update = makeUseCase();
    assign = makeUseCase();
    schedule = makeUseCase();
    start = makeUseCase();
    resolve = makeUseCase();
    cancel = makeUseCase();
    remove = makeUseCase();
    logger = makeLogger();

    controller = new TicketController(
      create as never,
      get as never,
      list as never,
      technicianDay as never,
      update as never,
      assign as never,
      schedule as never,
      start as never,
      resolve as never,
      cancel as never,
      remove as never,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('returns 201 with the envelope on success', async () => {
      create.execute.mockResolvedValue(Result.ok({ id: 't1' }));
      const res = makeResponse();

      await controller.create(makeRequest(), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 't1' }
      });
    });

    it('takes the author from the token, never the payload', async () => {
      create.execute.mockResolvedValue(Result.ok({ id: 't1' }));
      const req = makeRequest({
        body: { title: 'x', createdBy: 'spoofed' },
        user: { userId: 'real-user', email: 'a@b.c', role: 'ADMIN' }
      } as never);

      await controller.create(req, makeResponse());

      expect(create.execute).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: 'real-user' })
      );
    });

    it('passes null authorship when there is no user on the request', async () => {
      create.execute.mockResolvedValue(Result.ok({ id: 't1' }));

      await controller.create(makeRequest(), makeResponse());

      expect(create.execute).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: null })
      );
    });
  });

  describe('list', () => {
    it('coerces boolean query flags that validateRequest leaves as strings', async () => {
      list.execute.mockResolvedValue(Result.ok({ tickets: [] }));
      const req = makeRequest({
        query: { unassignedOnly: 'true', openOnly: 'false' }
      });

      await controller.list(req, makeResponse());

      expect(list.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          unassignedOnly: true,
          openOnly: false
        })
      );
    });

    it('leaves absent flags undefined rather than false', async () => {
      list.execute.mockResolvedValue(Result.ok({ tickets: [] }));

      await controller.list(makeRequest(), makeResponse());

      expect(list.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          unassignedOnly: undefined,
          openOnly: undefined
        })
      );
    });

    it('coerces limit and offset to numbers', async () => {
      list.execute.mockResolvedValue(Result.ok({ tickets: [] }));
      const req = makeRequest({ query: { limit: '25', offset: '5' } });

      await controller.list(req, makeResponse());

      expect(list.execute).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25, offset: 5 })
      );
    });
  });

  describe('myDay', () => {
    it('returns 200 with the day sheet', async () => {
      technicianDay.execute.mockResolvedValue(
        Result.ok({ tickets: [], total: 0 })
      );
      const res = makeResponse();

      await controller.myDay(
        makeRequest({ query: { technicianId: 't1' } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('forwards the technician and date from the query', async () => {
      technicianDay.execute.mockResolvedValue(Result.ok({}));

      await controller.myDay(
        makeRequest({
          query: { technicianId: 't1', date: '2026-08-04' }
        }),
        makeResponse()
      );

      expect(technicianDay.execute).toHaveBeenCalledWith({
        technicianId: 't1',
        date: '2026-08-04'
      });
    });
  });

  describe('delete', () => {
    it('returns 204 with no body', async () => {
      remove.execute.mockResolvedValue(Result.ok(undefined));
      const res = makeResponse();

      await controller.delete(
        makeRequest({ params: { id: 't1' } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('error status mapping', () => {
    it.each([
      ['Ticket not found: abc', 404],
      ['A technician with phone "x" already exists', 409],
      ['Cannot modify a resolved ticket', 409],
      ['Cannot cancel a resolved ticket', 409],
      ['Cannot reassign a ticket that is already in progress', 409],
      ['Ticket is already in progress', 409],
      ['Ticket is already cancelled', 409],
      ['Only an assigned ticket can be started', 409],
      ['Cannot delete a technician with 2 ticket(s)', 409],
      ['Invalid ticket ID: bad uuid', 400],
      ['Ticket ID is required', 400],
      ['Ticket title cannot be empty', 400],
      ['Ticket title cannot exceed 150 characters', 400],
      ['Something exploded', 500]
    ])('maps %s to %i', async (error, status) => {
      get.execute.mockResolvedValue(Result.fail(error));
      const res = makeResponse();

      await controller.getById(
        makeRequest({ params: { id: 't1' } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error
      });
    });
  });

  describe('unexpected errors', () => {
    it('returns a generic 500 and logs the detail', async () => {
      get.execute.mockRejectedValue(new Error('connection lost'));
      const res = makeResponse();

      await controller.getById(
        makeRequest({ params: { id: 't1' } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('action handlers', () => {
    it.each([
      ['assign', () => assign],
      ['schedule', () => schedule],
      ['start', () => start],
      ['resolve', () => resolve],
      ['cancel', () => cancel]
    ])('%s returns 200 on success', async (name, useCase) => {
      useCase().execute.mockResolvedValue(Result.ok({ id: 't1' }));
      const res = makeResponse();

      await (controller as never as Record<string, Function>)[name](
        makeRequest({ params: { id: 't1' }, body: {} }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('passes the route id into the use case', async () => {
      assign.execute.mockResolvedValue(Result.ok({}));

      await controller.assign(
        makeRequest({
          params: { id: 't1' },
          body: { technicianId: 'tech1' }
        }),
        makeResponse()
      );

      expect(assign.execute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1', technicianId: 'tech1' })
      );
    });
  });
});
