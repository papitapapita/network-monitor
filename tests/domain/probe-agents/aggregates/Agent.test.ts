import {
  Agent,
  AgentName,
  AgentProps,
  AgentStatus,
  AgentUpdateOutcome
} from '../../../../src/domain/probe-agents';
import {
  AgentCameBackEvent,
  AgentClockCorrectedEvent,
  AgentClockDriftedEvent,
  AgentUpdateFailedEvent,
  AgentWentOfflineEvent
} from '../../../../src/domain/probe-agents/events';
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
    offlineSince: null,
    clockDriftSince: null,
    lastUpdate: null,
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

  describe('recordContact', () => {
    function enrolled(): Agent {
      const agent = makeAgent();
      agent.enroll(TOKEN_HASH, at(1_000));
      return agent;
    }

    it('[AGT-020] records when, which version and the clock offset', () => {
      const agent = enrolled();

      const result = agent.recordContact('1.2.0', -1500.4, at(5_000));

      expect(result.isSuccess).toBe(true);
      expect(agent.lastSeenAt).toEqual(at(5_000));
      expect(agent.agentVersion).toBe('1.2.0');
      expect(agent.clockOffsetMs).toBe(-1500);
    });

    it('refuses an agent that is not enrolled', () => {
      expect(
        makeAgent().recordContact('1.0.0', 0, NOW).isFailure
      ).toBe(true);
    });

    it('refuses a revoked agent', () => {
      const agent = enrolled();
      agent.revoke(at(2_000));

      expect(
        agent.recordContact('1.0.0', 0, at(3_000)).isFailure
      ).toBe(true);
    });

    it.each([
      ['an empty version', '', 0],
      ['a version longer than 32 characters', 'v'.repeat(33), 0],
      ['a non-finite offset', '1.0.0', Number.NaN]
    ])('rejects %s', (_label, version, offset) => {
      expect(
        enrolled().recordContact(version, offset, NOW).isFailure
      ).toBe(true);
    });
  });

  describe('liveness', () => {
    const OFFLINE = Agent.OFFLINE_AFTER_MS;

    function enrolled(): Agent {
      const agent = makeAgent();
      agent.enroll(TOKEN_HASH, NOW);
      agent.clearEvents();
      return agent;
    }

    function offline(): Agent {
      const agent = enrolled();
      agent.markOffline(at(OFFLINE));
      agent.clearEvents();
      return agent;
    }

    it('[AGT-021] is overdue 5 minutes after the last contact, not before', () => {
      const agent = enrolled();
      agent.recordContact('1.0.0', 0, at(10_000));

      expect(agent.isOverdue(at(10_000 + OFFLINE - 1))).toBe(false);
      expect(agent.isOverdue(at(10_000 + OFFLINE))).toBe(true);
    });

    it('[AGT-021] counts from enrollment for an agent that never reported in', () => {
      const agent = enrolled();

      expect(agent.isOverdue(at(OFFLINE - 1))).toBe(false);
      expect(agent.isOverdue(at(OFFLINE))).toBe(true);
    });

    it('[AGT-021] never considers a pending or revoked agent overdue', () => {
      const revoked = enrolled();
      revoked.revoke(at(1_000));

      expect(makeAgent().isOverdue(at(DAY_MS))).toBe(false);
      expect(revoked.isOverdue(at(DAY_MS))).toBe(false);
    });

    it('[AGT-021] goes offline once, raising AgentWentOffline with the silence start', () => {
      const agent = enrolled();
      agent.recordContact('1.0.0', 0, at(10_000));
      agent.clearEvents();

      const result = agent.markOffline(at(10_000 + OFFLINE));

      expect(result.isSuccess).toBe(true);
      expect(agent.isOffline).toBe(true);
      expect(agent.offlineSince).toEqual(at(10_000 + OFFLINE));
      expect(agent.domainEvents).toHaveLength(1);
      const event = agent.domainEvents[0] as AgentWentOfflineEvent;
      expect(event).toBeInstanceOf(AgentWentOfflineEvent);
      expect(event.agentName).toBe('Torre Norte');
      expect(event.silentSince).toEqual(at(10_000));
      expect(event.aggregateId.equals(agent.id)).toBe(true);
    });

    it('[AGT-021] refuses to go offline twice or before the threshold', () => {
      expect(offline().markOffline(at(DAY_MS)).isFailure).toBe(true);
      expect(enrolled().markOffline(at(OFFLINE - 1)).isFailure).toBe(
        true
      );
      expect(offline().isOverdue(at(DAY_MS))).toBe(false);
    });

    it('[AGT-022] comes back on its next contact, raising AgentCameBack once', () => {
      const agent = offline();

      agent.recordContact('1.0.0', 0, at(OFFLINE + 60_000));

      expect(agent.isOffline).toBe(false);
      expect(agent.offlineSince).toBeNull();
      expect(agent.domainEvents).toHaveLength(1);
      const event = agent.domainEvents[0] as AgentCameBackEvent;
      expect(event).toBeInstanceOf(AgentCameBackEvent);
      expect(event.offlineSince).toEqual(at(OFFLINE));
      expect(event.dateTimeOccurred).toEqual(at(OFFLINE + 60_000));

      agent.clearEvents();
      agent.recordContact('1.0.0', 0, at(OFFLINE + 90_000));
      expect(agent.domainEvents).toHaveLength(0);
    });

    it('[AGT-022] raises nothing for a contact while online', () => {
      const agent = enrolled();

      agent.recordContact('1.0.0', 0, at(1_000));

      expect(agent.domainEvents).toHaveLength(0);
    });

    it('[AGT-021] revoking an offline agent clears its offline state', () => {
      const agent = offline();

      expect(agent.revoke(at(DAY_MS)).isSuccess).toBe(true);
      expect(agent.offlineSince).toBeNull();
      expect(agent.domainEvents).toHaveLength(0);
    });
  });

  describe('[AGT-025] clock drift', () => {
    function enrolled(): Agent {
      const agent = makeAgent();
      agent.enroll(TOKEN_HASH, NOW);
      agent.clearEvents();
      return agent;
    }

    const contact = (agent: Agent, offsetMs: number, at_ = NOW) =>
      agent.recordContact('1.0.0', offsetMs, at_);

    it('warns once when the clock is more than a minute off, either way', () => {
      for (const offset of [60_001, -60_001]) {
        const agent = enrolled();

        contact(agent, offset);
        contact(agent, offset * 2, at(30_000));

        expect(agent.clockDriftSince).toEqual(NOW);
        expect(agent.domainEvents).toHaveLength(1);
        const event = agent.domainEvents[0] as AgentClockDriftedEvent;
        expect(event).toBeInstanceOf(AgentClockDriftedEvent);
        expect(event.clockOffsetMs).toBe(offset);
      }
    });

    it('does not warn at exactly a minute', () => {
      const agent = enrolled();

      contact(agent, 60_000);

      expect(agent.clockDriftSince).toBeNull();
      expect(agent.domainEvents).toHaveLength(0);
    });

    it('stays warned until the clock is back within 30 seconds', () => {
      const agent = enrolled();
      contact(agent, 90_000);
      agent.clearEvents();

      contact(agent, 45_000, at(30_000));
      expect(agent.clockDriftSince).toEqual(NOW);
      expect(agent.domainEvents).toHaveLength(0);

      contact(agent, 30_000, at(60_000));
      expect(agent.clockDriftSince).toBeNull();
      expect(agent.domainEvents).toEqual([
        expect.any(AgentClockCorrectedEvent)
      ]);
    });

    it('does not flap for an offset hovering at the threshold', () => {
      const agent = enrolled();

      for (const [i, offset] of [
        61_000, 59_000, 61_000, 59_000
      ].entries()) {
        contact(agent, offset, at(i * 30_000));
      }

      expect(agent.domainEvents).toHaveLength(1);
    });

    it('revoking clears the warning', () => {
      const agent = enrolled();
      contact(agent, 90_000);

      agent.revoke(at(1_000));

      expect(agent.clockDriftSince).toBeNull();
    });
  });

  describe('[AGT-084] update outcome', () => {
    function running(version = '0.2.0'): Agent {
      const agent = makeAgent();
      agent.enroll(TOKEN_HASH, at(1_000));
      agent.recordContact(version, 0, at(2_000));
      agent.clearEvents();
      return agent;
    }

    it('records an installed update without alerting anyone', () => {
      const agent = running('0.2.1');

      const result = agent.recordUpdateOutcome(
        '0.2.1',
        AgentUpdateOutcome.INSTALLED,
        'ignored',
        at(5_000)
      );

      expect(result.isSuccess).toBe(true);
      expect(agent.lastUpdate).toEqual({
        version: '0.2.1',
        outcome: AgentUpdateOutcome.INSTALLED,
        reason: null,
        at: at(5_000)
      });
      expect(agent.domainEvents).toHaveLength(0);
    });

    it.each([
      AgentUpdateOutcome.ROLLED_BACK,
      AgentUpdateOutcome.REJECTED
    ])(
      'records a %s update with its reason and raises one event',
      (outcome) => {
        const agent = running('0.2.0');

        agent.recordUpdateOutcome(
          '0.2.1',
          outcome,
          '  No connection within 2 minutes  ',
          at(5_000)
        );

        expect(agent.lastUpdate?.reason).toBe(
          'No connection within 2 minutes'
        );
        expect(agent.domainEvents).toHaveLength(1);
        const event = agent.domainEvents[0] as AgentUpdateFailedEvent;
        expect(event).toBeInstanceOf(AgentUpdateFailedEvent);
        expect(event.runningVersion).toBe('0.2.0');
        expect(event.targetVersion).toBe('0.2.1');
        expect(event.outcome).toBe(outcome);
        expect(event.reason).toBe('No connection within 2 minutes');
      }
    );

    it('ignores the same report sent again', () => {
      const agent = running();
      agent.recordUpdateOutcome(
        '0.2.1',
        AgentUpdateOutcome.ROLLED_BACK,
        'timeout',
        at(5_000)
      );
      agent.clearEvents();

      const result = agent.recordUpdateOutcome(
        '0.2.1',
        AgentUpdateOutcome.ROLLED_BACK,
        'timeout',
        at(9_000)
      );

      expect(result.isSuccess).toBe(true);
      expect(agent.lastUpdate?.at).toEqual(at(5_000));
      expect(agent.domainEvents).toHaveLength(0);
    });

    it('[AGT-082] remembers a version that failed, until another outcome replaces it', () => {
      const agent = running();
      agent.recordUpdateOutcome(
        '0.2.1',
        AgentUpdateOutcome.REJECTED,
        'Signature does not verify',
        at(5_000)
      );

      expect(agent.hasFailedUpdateTo('0.2.1')).toBe(true);
      expect(agent.hasFailedUpdateTo('0.2.2')).toBe(false);

      agent.recordUpdateOutcome(
        '0.2.1',
        AgentUpdateOutcome.INSTALLED,
        null,
        at(9_000)
      );
      expect(agent.hasFailedUpdateTo('0.2.1')).toBe(false);
    });

    it.each([
      ['a version that is not major.minor.patch', 'v0.2', 'x'],
      ['a failure with no reason', '0.2.1', '   '],
      ['a reason over 500 characters', '0.2.1', 'x'.repeat(501)]
    ])('rejects %s', (_label, version, reason) => {
      const agent = running();

      const result = agent.recordUpdateOutcome(
        version,
        AgentUpdateOutcome.REJECTED,
        reason,
        at(5_000)
      );

      expect(result.isFailure).toBe(true);
      expect(agent.lastUpdate).toBeNull();
      expect(agent.domainEvents).toHaveLength(0);
    });

    it('refuses an agent that is not enrolled', () => {
      expect(
        makeAgent().recordUpdateOutcome(
          '0.2.1',
          AgentUpdateOutcome.INSTALLED,
          null,
          NOW
        ).isFailure
      ).toBe(true);
    });
  });
});
