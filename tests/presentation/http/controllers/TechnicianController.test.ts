// Source: src/presentation/http/controllers/TechnicianController.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { Request, Response } from 'express';
import { TechnicianController } from '../../../../src/presentation/http/controllers';
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

describe('TechnicianController', () => {
  let create: UseCaseMock;
  let get: UseCaseMock;
  let list: UseCaseMock;
  let update: UseCaseMock;
  let remove: UseCaseMock;
  let logger: ReturnType<typeof makeLogger>;
  let controller: TechnicianController;

  beforeEach(() => {
    create = makeUseCase();
    get = makeUseCase();
    list = makeUseCase();
    update = makeUseCase();
    remove = makeUseCase();
    logger = makeLogger();

    controller = new TechnicianController(
      create as never,
      get as never,
      list as never,
      update as never,
      remove as never,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 201 on create', async () => {
    create.execute.mockResolvedValue(Result.ok({ id: 'x' }));
    const res = makeResponse();

    await controller.create(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { id: 'x' }
    });
  });

  it('returns 200 on getById', async () => {
    get.execute.mockResolvedValue(Result.ok({ id: 'x' }));
    const res = makeResponse();

    await controller.getById(
      makeRequest({ params: { id: 'x' } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(get.execute).toHaveBeenCalledWith({ id: 'x' });
  });

  it('merges the route id into the update payload', async () => {
    update.execute.mockResolvedValue(Result.ok({}));

    await controller.update(
      makeRequest({
        params: { id: 'x' },
        body: { fullName: 'Renamed' }
      }),
      makeResponse()
    );

    expect(update.execute).toHaveBeenCalledWith({
      id: 'x',
      fullName: 'Renamed'
    });
  });

  it('returns 204 with no body on delete', async () => {
    remove.execute.mockResolvedValue(Result.ok(undefined));
    const res = makeResponse();

    await controller.delete(makeRequest({ params: { id: 'x' } }), res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('coerces activeOnly from its string form', async () => {
    list.execute.mockResolvedValue(Result.ok({ technicians: [] }));

    await controller.list(
      makeRequest({ query: { activeOnly: 'true' } }),
      makeResponse()
    );

    expect(list.execute).toHaveBeenCalledWith(
      expect.objectContaining({ activeOnly: true })
    );
  });

  it('leaves an absent activeOnly undefined', async () => {
    list.execute.mockResolvedValue(Result.ok({ technicians: [] }));

    await controller.list(makeRequest(), makeResponse());

    expect(list.execute).toHaveBeenCalledWith(
      expect.objectContaining({ activeOnly: undefined })
    );
  });

  it.each([
    ['Technician not found: abc', 404],
    ['A technician with phone "x" already exists', 409],
    ['Cannot delete a technician with 2 ticket(s)', 409],
    ['Invalid technician ID: bad', 400],
    ['Technician ID is required', 400],
    ['Technician name cannot be empty', 400],
    ['Kaboom', 500]
  ])('maps %s to %i', async (error, status) => {
    get.execute.mockResolvedValue(Result.fail(error));
    const res = makeResponse();

    await controller.getById(
      makeRequest({ params: { id: 'x' } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('returns a generic 500 and logs on an unexpected throw', async () => {
    get.execute.mockRejectedValue(new Error('connection lost'));
    const res = makeResponse();

    await controller.getById(
      makeRequest({ params: { id: 'x' } }),
      res
    );

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error'
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
