import { Request, Response } from 'express';
import { createSubscriptionGuard } from '../../../../src/presentation/http/middleware/subscriptionGuard';
import { GetSubscriptionStatusUseCase } from '../../../../src/application/shared/use-cases/GetSubscriptionStatusUseCase';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../../application/probe-agents/fixtures';

type State = 'ACTIVE' | 'GRACE' | 'READ_ONLY' | 'LOCKED';

function statusOf(state: State) {
  return {
    execute: jest.fn().mockResolvedValue(
      Result.ok({
        state,
        paidThrough: null,
        graceEndsAt: null,
        lockedAt: null,
        readOnly: state === 'READ_ONLY' || state === 'LOCKED',
        locked: state === 'LOCKED'
      })
    )
  } as unknown as GetSubscriptionStatusUseCase;
}

async function run(
  guard: ReturnType<typeof createSubscriptionGuard>,
  method: string,
  path = '/devices'
) {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  } as unknown as Response;
  const next = jest.fn();
  await guard({ method, path } as Request, res, next);
  return { res, next };
}

describe('createSubscriptionGuard', () => {
  it.each(['ACTIVE', 'GRACE'] as const)(
    '[INS-025] lets every request through while %s',
    async (state) => {
      const guard = createSubscriptionGuard(
        statusOf(state),
        makeLogger()
      );

      expect((await run(guard, 'POST')).next).toHaveBeenCalled();
      expect((await run(guard, 'GET')).next).toHaveBeenCalled();
    }
  );

  it('[INS-025] refuses writes with 402 and allows reads while READ_ONLY', async () => {
    const guard = createSubscriptionGuard(
      statusOf('READ_ONLY'),
      makeLogger()
    );

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const { res, next } = await run(guard, method);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(402);
    }
    expect((await run(guard, 'GET')).next).toHaveBeenCalled();
  });

  it('[INS-025] refuses everything with 402 while LOCKED', async () => {
    const guard = createSubscriptionGuard(
      statusOf('LOCKED'),
      makeLogger()
    );

    const { res, next } = await run(guard, 'GET');

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
  });

  it('[INS-025] never blocks an exempt request, and does not even ask', async () => {
    const status = statusOf('LOCKED');
    const guard = createSubscriptionGuard(
      status,
      makeLogger(),
      (req) => req.path.startsWith('/auth/')
    );

    const { next } = await run(guard, 'POST', '/auth/login');

    expect(next).toHaveBeenCalled();
    expect(status.execute).not.toHaveBeenCalled();
  });

  it('[INS-025] lets the request through when the status cannot be read', async () => {
    const status = {
      execute: jest.fn().mockResolvedValue(Result.fail('boom'))
    } as unknown as GetSubscriptionStatusUseCase;
    const logger = makeLogger();

    const { next } = await run(
      createSubscriptionGuard(status, logger),
      'POST'
    );

    expect(next).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
