import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { AgentStatus } from '../enums';
import { AgentProps } from '../props';
import { AgentName } from '../value-objects';

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MAX_VERSION_LENGTH = 32;

export class Agent extends AggregateRoot<AgentProps, AgentId> {
  static readonly PAIRING_KEY_TTL_MS = 24 * 60 * 60 * 1000;

  private constructor(props: AgentProps, id: AgentId) {
    super(props, id);
  }

  get name(): AgentName {
    return this.props.name;
  }

  get status(): AgentStatus {
    return this.props.status;
  }

  get pairingCodeHash(): string | null {
    return this.props.pairingCodeHash;
  }

  get pairingExpiresAt(): Date | null {
    return this.props.pairingExpiresAt;
  }

  get tokenHash(): string | null {
    return this.props.tokenHash;
  }

  get enrolledAt(): Date | null {
    return this.props.enrolledAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get lastSeenAt(): Date | null {
    return this.props.lastSeenAt;
  }

  get agentVersion(): string | null {
    return this.props.agentVersion;
  }

  get clockOffsetMs(): number | null {
    return this.props.clockOffsetMs;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    name: AgentName,
    pairingCodeHash: string,
    now: Date = new Date()
  ): Result<Agent> {
    const state: AgentProps = {
      name,
      status: AgentStatus.PENDING,
      pairingCodeHash,
      pairingExpiresAt: Agent.pairingExpiry(now),
      tokenHash: null,
      enrolledAt: null,
      revokedAt: null,
      lastSeenAt: null,
      agentVersion: null,
      clockOffsetMs: null,
      createdAt: now,
      updatedAt: now
    };

    const validationResult = Agent.validate(state);
    if (validationResult.isFailure) {
      return Result.fail<Agent>(validationResult.error);
    }
    return Result.ok(new Agent(state, AgentId.create()));
  }

  // bypasses validation — for repository use only
  public static reconstitute(id: AgentId, props: AgentProps): Agent {
    return new Agent(props, id);
  }

  public isPairingExpired(now: Date = new Date()): boolean {
    return (
      this.props.pairingExpiresAt === null ||
      now.getTime() >= this.props.pairingExpiresAt.getTime()
    );
  }

  // An expired key cannot be extended, only replaced: the old code stops
  // working the moment a new one is issued.
  public reissuePairingCode(
    pairingCodeHash: string,
    now: Date = new Date()
  ): Result<void> {
    if (this.props.status !== AgentStatus.PENDING) {
      return Result.fail(
        'Only a pending agent can be issued a new pairing key'
      );
    }
    return this.apply({
      pairingCodeHash,
      pairingExpiresAt: Agent.pairingExpiry(now),
      updatedAt: now
    });
  }

  // The code is consumed here: an ACTIVE agent holds no pairing code, so the
  // same key can never enroll a second installation.
  public enroll(
    tokenHash: string,
    now: Date = new Date()
  ): Result<void> {
    if (this.props.status !== AgentStatus.PENDING) {
      return Result.fail('Agent is not awaiting enrollment');
    }
    if (this.isPairingExpired(now)) {
      return Result.fail('Pairing code has expired');
    }
    return this.apply({
      status: AgentStatus.ACTIVE,
      pairingCodeHash: null,
      pairingExpiresAt: null,
      tokenHash,
      enrolledAt: now,
      updatedAt: now
    });
  }

  // A hello or heartbeat from the enrolled agent. The offset is the agent's
  // clock minus ours as measured on arrival; correcting for it is the
  // ingest's job (ADR 0002, R12), the agent only remembers the latest.
  public recordContact(
    agentVersion: string,
    clockOffsetMs: number,
    now: Date = new Date()
  ): Result<void> {
    if (this.props.status !== AgentStatus.ACTIVE) {
      return Result.fail('Only an enrolled agent can report in');
    }
    const version = agentVersion?.trim() ?? '';
    if (version.length === 0 || version.length > MAX_VERSION_LENGTH) {
      return Result.fail(
        `Agent version must be 1-${MAX_VERSION_LENGTH} characters`
      );
    }
    if (!Number.isFinite(clockOffsetMs)) {
      return Result.fail('Clock offset must be a finite number');
    }
    return this.apply({
      agentVersion: version,
      clockOffsetMs: Math.round(clockOffsetMs),
      lastSeenAt: now,
      updatedAt: now
    });
  }

  public revoke(now: Date = new Date()): Result<void> {
    if (this.props.status === AgentStatus.REVOKED) {
      return Result.fail('Agent is already revoked');
    }
    return this.apply({
      status: AgentStatus.REVOKED,
      pairingCodeHash: null,
      pairingExpiresAt: null,
      tokenHash: null,
      revokedAt: now,
      updatedAt: now
    });
  }

  private apply(changes: Partial<AgentProps>): Result<void> {
    const candidate: AgentProps = { ...this.props, ...changes };
    const validationResult = Agent.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail(validationResult.error);
    }
    this.props = candidate;
    return Result.ok();
  }

  private static pairingExpiry(now: Date): Date {
    return new Date(now.getTime() + Agent.PAIRING_KEY_TTL_MS);
  }

  private static validate(state: AgentProps): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(state.name, 'name'),
      Guard.againstNullOrUndefined(state.status, 'status')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail(guardResult.message!);
    }

    for (const hash of [state.pairingCodeHash, state.tokenHash]) {
      if (hash !== null && !HASH_PATTERN.test(hash)) {
        return Result.fail(
          'Secret hashes must be SHA-256 hex digests'
        );
      }
    }

    const hasPairing =
      state.pairingCodeHash !== null &&
      state.pairingExpiresAt !== null;
    const noPairing =
      state.pairingCodeHash === null &&
      state.pairingExpiresAt === null;
    const hasToken = state.tokenHash !== null;

    switch (state.status) {
      case AgentStatus.PENDING:
        if (!hasPairing || hasToken) {
          return Result.fail(
            'A pending agent must hold a pairing code and no token'
          );
        }
        break;
      case AgentStatus.ACTIVE:
        if (!noPairing || !hasToken || state.enrolledAt === null) {
          return Result.fail(
            'An active agent must hold a token and no pairing code'
          );
        }
        break;
      case AgentStatus.REVOKED:
        if (!noPairing || hasToken || state.revokedAt === null) {
          return Result.fail(
            'A revoked agent cannot hold a pairing code or a token'
          );
        }
        break;
    }
    return Result.ok();
  }
}
