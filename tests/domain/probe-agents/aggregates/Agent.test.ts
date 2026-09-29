import {
  Agent,
  AgentName,
  AgentProps,
  AgentStatus
} from '../../../../src/domain/probe-agents';
import { AgentId } from '../../../../src/domain/shared/ids';

const CODE_HASH = 'a'.repeat(64);
const NEW_CODE_HASH = 'b'.repeat(64);
const TOKEN_HASH = 'c'.repeat(64);
const NOW = new Date('2026-09-28T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const name = () => AgentName.create('Torre Norte').value;

function makeAgent(): Agent {
  return Agent.create(name(), CODE_HASH, NOW).value;
}

function makeProps(overrides: Partial<AgentProps> = {}): AgentProps {
  return {
    name: name(),
    status: AgentStatus.PENDING,
    pairingCodeHash: CODE_HASH,
    pairingExpiresAt: at(DAY_MS),
    tokenHash: null,
    enrolledAt: null,
    revokedAt: null,
    lastSeenAt: null,
    agentVersion: null,
    clockOffsetMs: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

describe('Agent', () => {
  describe('create', () => {
    it('[AGT-001] starts PENDING with a pairing code valid for 24 hours', () => {
      const agent = makeAgent();

      expect(agent.status).toBe(AgentStatus.PENDING);
      expect(agent.pairingCodeHash).toBe(CODE_HASH);
      expect(agent.pairingExpiresAt).toEqual(at(DAY_MS));
      expect(agent.tokenHash).toBeNull();
    });

    it('rejects a pairing hash that is not a SHA-256 hex digest', () => {
      const result = Agent.create(name(), 'plain-code', NOW);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('SHA-256');
    });
  });

  describe('isPairingExpired', () => {
    it('is false just before and true exactly at the expiry', () => {
      const agent = makeAgent();

      expect(agent.isPairingExpired(at(DAY_MS - 1))).toBe(false);
      expect(agent.isPairingExpired(at(DAY_MS))).toBe(true);
    });
  });

  describe('enroll', () => {
    it('[AGT-003] becomes ACTIVE holding only the token hash', () => {
      const agent = makeAgent();

      const result = agent.enroll(TOKEN_HASH, at(1_000));

      expect(result.isSuccess).toBe(true);
      expect(agent.status).toBe(AgentStatus.ACTIVE);
      expect(agent.tokenHash).toBe(TOKEN_HASH);
      expect(agent.enrolledAt).toEqual(at(1_000));
    });

    it('[AGT-002] consumes the pairing code so it cannot enroll twice', () => {
      const agent = makeAgent();
      agent.enroll(TOKEN_HASH, at(1_000));

      expect(agent.pairingCodeHash).toBeNull();
      expect(agent.pairingExpiresAt).toBeNull();
      expect(agent.enroll('d'.repeat(64), at(2_000)).error).toContain(
        'not awaiting enrollment'
      );
    });

    it('[AGT-001] refuses an expired pairing code', () => {
      const agent = makeAgent();

      const result = agent.enroll(TOKEN_HASH, at(DAY_MS));

      expect(result.error).toContain('expired');
      expect(agent.status).toBe(AgentStatus.PENDING);
    });

    it('refuses a revoked agent', () => {
      const agent = makeAgent();
      agent.revoke(at(1_000));

      expect(agent.enroll(TOKEN_HASH, at(2_000)).isFailure).toBe(
        true
      );
    });
  });

  describe('reissuePairingCode', () => {
    it('[AGT-004] replaces the code and restarts the 24 hours', () => {
      const agent = makeAgent();

      agent.reissuePairingCode(NEW_CODE_HASH, at(DAY_MS * 2));

      expect(agent.pairingCodeHash).toBe(NEW_CODE_HASH);
      expect(agent.pairingExpiresAt).toEqual(at(DAY_MS * 3));
      expect(agent.isPairingExpired(at(DAY_MS * 2))).toBe(false);
    });

    it('[AGT-004] refuses an agent that is no longer pending', () => {
      const agent = makeAgent();
      agent.enroll(TOKEN_HASH, at(1_000));

      const result = agent.reissuePairingCode(
        NEW_CODE_HASH,
        at(2_000)
      );

      expect(result.error).toContain('Only a pending agent');
      expect(agent.pairingCodeHash).toBeNull();
    });
  });

  describe('revoke', () => {
    it('[AGT-005] drops the token of an active agent', () => {
      const agent = makeAgent();
      agent.enroll(TOKEN_HASH, at(1_000));

      agent.revoke(at(2_000));

      expect(agent.status).toBe(AgentStatus.REVOKED);
      expect(agent.tokenHash).toBeNull();
      expect(agent.revokedAt).toEqual(at(2_000));
    });

    it('[AGT-005] cancels the pairing code of a pending agent', () => {
      const agent = makeAgent();

      agent.revoke(at(1_000));

      expect(agent.pairingCodeHash).toBeNull();
      expect(agent.pairingExpiresAt).toBeNull();
    });

    it('[AGT-005] is final — revoking twice fails', () => {
      const agent = makeAgent();
      agent.revoke(at(1_000));

      expect(agent.revoke(at(2_000)).error).toContain(
        'already revoked'
      );
    });
  });

  describe('state consistency', () => {
    it('does not change state when a transition is refused', () => {
      const agent = Agent.reconstitute(AgentId.create(), makeProps());
      const before = agent.updatedAt;

      agent.enroll('not-a-hash', at(1_000));

      expect(agent.status).toBe(AgentStatus.PENDING);
      expect(agent.updatedAt).toBe(before);
    });
  });
});
