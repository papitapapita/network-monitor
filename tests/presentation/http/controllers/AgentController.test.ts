import { Request, Response } from 'express';
import { AgentController } from '../../../../src/presentation/http/controllers/AgentController';
import { AGENT_PUBLIC_URL_MISSING } from '../../../../src/application/probe-agents/use-cases';
import { Result } from '../../../../src/domain/shared/core/Result';

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
  return res as unknown as Response & typeof res;
}

function makeController(createResult: Result<unknown>) {
  const execute = jest.fn().mockResolvedValue(createResult);
  const useCase = { execute } as never;
  const logger = { error: jest.fn() } as never;
  return new AgentController(
    useCase,
    useCase,
    useCase,
    useCase,
    useCase,
    useCase,
    logger
  );
}

describe('AgentController — error status mapping', () => {
  it.each([
    [AGENT_PUBLIC_URL_MISSING, 503],
    ['Agent not found: x', 404],
    ['An agent named "x" already exists', 409],
    ['Agent is already revoked', 409],
    ['Only a pending agent can be issued a new pairing key', 409],
    ['Invalid agent ID: bad', 400],
    ['Database error saving agent: boom', 500]
  ])('maps "%s" to %i', async (error, status) => {
    const res = makeRes();

    await makeController(Result.fail(error)).create(
      { body: { name: 'x' } } as Request,
      res
    );

    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('answers 201 with the envelope on success', async () => {
    const res = makeRes();

    await makeController(Result.ok({ id: '1' })).create(
      { body: { name: 'x' } } as Request,
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { id: '1' }
    });
  });
});
