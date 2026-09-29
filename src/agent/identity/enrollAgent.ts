import { AGENT_ENROLL_PATH, parsePairingKey } from 'agent/protocol';
import { AgentCredentials } from './CredentialStore';

export type EnrollOutcome =
  | { kind: 'enrolled'; credentials: AgentCredentials }
  // The key will never work: malformed, used, expired or revoked.
  | { kind: 'rejected'; reason: string }
  // Worth trying again with the same key later.
  | { kind: 'retry'; reason: string; subscriptionExpired: boolean };

const ENROLL_TIMEOUT_MS = 15_000;

export async function enrollAgent(
  pairingKey: string,
  fetchFn: typeof fetch = fetch
): Promise<EnrollOutcome> {
  const parts = parsePairingKey(pairingKey);
  if (parts === null) {
    return { kind: 'rejected', reason: 'Not a valid pairing key' };
  }

  let response: Response;
  try {
    response = await fetchFn(
      `${parts.backendUrl}${AGENT_ENROLL_PATH}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingCode: parts.pairingCode }),
        signal: AbortSignal.timeout(ENROLL_TIMEOUT_MS)
      }
    );
  } catch (error) {
    return retry(
      `Backend unreachable: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (response.status === 201) {
    const body = (await response.json().catch(() => null)) as {
      data?: { token?: unknown; agentName?: unknown };
    } | null;
    const token = body?.data?.token;
    const agentName = body?.data?.agentName;
    if (typeof token !== 'string' || typeof agentName !== 'string') {
      return retry('Backend answered enrollment without a token');
    }
    return {
      kind: 'enrolled',
      credentials: { backendUrl: parts.backendUrl, token, agentName }
    };
  }
  if (response.status === 400 || response.status === 401) {
    return {
      kind: 'rejected',
      reason:
        'The backend refused the pairing key (used, expired or revoked)'
    };
  }
  if (response.status === 402) {
    return {
      kind: 'retry',
      reason: 'Subscription expired',
      subscriptionExpired: true
    };
  }
  return retry(`Backend answered ${response.status}`);
}

function retry(reason: string): EnrollOutcome {
  return { kind: 'retry', reason, subscriptionExpired: false };
}
