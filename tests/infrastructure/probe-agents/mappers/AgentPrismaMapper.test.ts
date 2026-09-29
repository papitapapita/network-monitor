import { AgentPrismaMapper } from '../../../../src/infrastructure/probe-agents/mappers';
import {
  Agent,
  AgentName
} from '../../../../src/domain/probe-agents';
import { ProbeAgent } from '../../../../src/generated/prisma/client';

const NOW = new Date('2026-09-28T12:00:00.000Z');

describe('AgentPrismaMapper', () => {
  it('round-trips an agent through persistence', () => {
    const agent = Agent.create(
      AgentName.create('Torre Norte').value,
      'a'.repeat(64),
      NOW
    ).value;
    agent.enroll('b'.repeat(64), NOW);

    const row = AgentPrismaMapper.toPersistence(agent);
    const back = AgentPrismaMapper.toDomain(row).value;

    expect(AgentPrismaMapper.toPersistence(back)).toEqual(row);
    expect(back.id.equals(agent.id)).toBe(true);
  });

  it('fails on a row with a malformed id', () => {
    const row = {
      ...AgentPrismaMapper.toPersistence(
        Agent.create(AgentName.create('X').value, 'a'.repeat(64), NOW)
          .value
      ),
      id: 'nope'
    } as ProbeAgent;

    expect(AgentPrismaMapper.toDomain(row).isFailure).toBe(true);
  });
});
