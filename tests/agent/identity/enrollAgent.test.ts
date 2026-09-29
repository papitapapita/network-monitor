import { enrollAgent } from '../../../src/agent/identity/enrollAgent';
import { formatPairingKey } from '../../../src/agent/protocol';

const key = formatPairingKey({
  backendUrl: 'https://api.example.com',
  pairingCode: 'code-1'
});

function fetchAnswering(status: number, body: unknown = {}) {
  return jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  );
}

describe('enrollAgent', () => {
  it('[AGT-060] posts only the pairing code to the backend named in the key', async () => {
    const fetchFn = fetchAnswering(201, {
      success: true,
      data: { token: 'tok', agentName: 'Torre Norte' }
    });

    const outcome = await enrollAgent(key, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.example.com/agent/v1/enroll',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pairingCode: 'code-1' })
      })
    );
    expect(outcome).toEqual({
      kind: 'enrolled',
      credentials: {
        backendUrl: 'https://api.example.com',
        token: 'tok',
        agentName: 'Torre Norte'
      }
    });
  });

  it('[AGT-060] a malformed key is refused without calling anyone', async () => {
    const fetchFn = jest.fn();

    const outcome = await enrollAgent('not-a-key', fetchFn);

    expect(outcome.kind).toBe('rejected');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([400, 401])(
    '[AGT-060] %i means the key will never work',
    async (status) => {
      const outcome = await enrollAgent(key, fetchAnswering(status));

      expect(outcome.kind).toBe('rejected');
    }
  );

  it('[AGT-060] an unreachable backend is retried later', async () => {
    const outcome = await enrollAgent(
      key,
      jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    );

    expect(outcome).toMatchObject({
      kind: 'retry',
      subscriptionExpired: false
    });
  });

  it('[AGT-065] 402 is an expired subscription, retried later', async () => {
    const outcome = await enrollAgent(key, fetchAnswering(402));

    expect(outcome).toMatchObject({
      kind: 'retry',
      subscriptionExpired: true
    });
  });

  it.each([429, 500, 503])(
    '[AGT-060] %i is retried later',
    async (status) => {
      const outcome = await enrollAgent(key, fetchAnswering(status));

      expect(outcome.kind).toBe('retry');
    }
  );

  it('a 201 without a token is retried, not trusted', async () => {
    const outcome = await enrollAgent(
      key,
      fetchAnswering(201, { data: {} })
    );

    expect(outcome.kind).toBe('retry');
  });
});
