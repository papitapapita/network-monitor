// Source: src/presentation/http/middleware/requireCredentialReveal.ts

import { Request, Response } from 'express';
import { createRequireCredentialRevealMiddleware } from '../../../../src/presentation/http/middleware/requireCredentialReveal';
import {
  CREDENTIAL_REVEAL_LOCKED,
  CredentialRevealGate
} from '../../../../src/application/identity/services/CredentialRevealGate';
import { Result } from '../../../../src/domain/shared/core/Result';

describe('[IDN-086] requireCredentialReveal middleware', () => {
  const run = async (
    checked: Result<void>,
    headers: Record<string, string> = {}
  ) => {
    const gate = {
      check: jest.fn().mockResolvedValue(checked)
    } as unknown as jest.Mocked<CredentialRevealGate>;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const next = jest.fn();
    const req = {
      headers,
      user: { userId: 'u-1', email: 'a@b.c', role: 'OPERATOR' }
    } as unknown as Request;

    await createRequireCredentialRevealMiddleware(gate)(
      req,
      { status } as unknown as Response,
      next
    );
    return { gate, status, json, next };
  };

  it('passes the header token and the session user to the gate', async () => {
    const { gate, next } = await run(Result.ok(), {
      'x-credential-reveal-token': 'reveal.token'
    });

    expect(gate.check).toHaveBeenCalledWith('reveal.token', 'u-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('answers 403 while locked', async () => {
    const { gate, status, json, next } = await run(
      Result.fail(CREDENTIAL_REVEAL_LOCKED)
    );

    expect(gate.check).toHaveBeenCalledWith(null, 'u-1');
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: CREDENTIAL_REVEAL_LOCKED
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 500 when the account cannot be read', async () => {
    const { status, json } = await run(
      Result.fail('Failed to look up user: db down')
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error'
    });
  });
});
