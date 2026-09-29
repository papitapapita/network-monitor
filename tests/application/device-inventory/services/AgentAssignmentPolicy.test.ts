import { AGENT_CHOICE_REQUIRED } from '../../../../src/application/device-inventory/services';
import { makeAgentPolicy } from '../agentFixtures';

describe('AgentAssignmentPolicy', () => {
  describe('resolve — an explicit agent', () => {
    it('[DEV-165] accepts a pending or active agent', async () => {
      const { agents, policy } = makeAgentPolicy();
      const id = agents.add();

      const result = await policy.resolve(id);

      expect(result.value.toString()).toBe(id);
    });

    it('[DEV-165] refuses a revoked agent', async () => {
      const { agents, policy } = makeAgentPolicy();
      const id = agents.add('REVOKED');

      expect((await policy.resolve(id)).error).toContain(
        'is revoked'
      );
    });

    it('refuses an unknown agent', async () => {
      const { policy } = makeAgentPolicy();

      const result = await policy.resolve(
        '550e8400-e29b-41d4-a716-446655440099'
      );

      expect(result.error).toContain('Agent not found');
    });

    it('refuses a malformed id', async () => {
      const { policy } = makeAgentPolicy();

      expect((await policy.resolve('nope')).error).toContain(
        'Invalid agentId'
      );
    });

    it('surfaces a lookup failure', async () => {
      const { agents, policy } = makeAgentPolicy();
      agents.failWith = 'db down';

      expect(
        (await policy.resolve('550e8400-e29b-41d4-a716-446655440099'))
          .error
      ).toContain('db down');
    });
  });

  describe('[DEV-166] resolveForNewDevice — when the caller did not say', () => {
    it('keeps the device in-process when there is no agent', async () => {
      const { policy } = makeAgentPolicy();

      expect(
        (await policy.resolveForNewDevice(undefined)).value
      ).toBeNull();
    });

    it('picks the only agent', async () => {
      const { agents, policy } = makeAgentPolicy();
      const id = agents.add();
      agents.add('REVOKED');

      const result = await policy.resolveForNewDevice(undefined);

      expect(result.value!.toString()).toBe(id);
    });

    it('makes the caller choose when there are several', async () => {
      const { agents, policy } = makeAgentPolicy();
      agents.add();
      agents.add();

      expect(
        (await policy.resolveForNewDevice(undefined)).error
      ).toBe(AGENT_CHOICE_REQUIRED);
    });

    it('respects an explicit null even with one agent', async () => {
      const { agents, policy } = makeAgentPolicy();
      agents.add();

      expect(
        (await policy.resolveForNewDevice(null)).value
      ).toBeNull();
    });

    it('validates an explicit id', async () => {
      const { agents, policy } = makeAgentPolicy();
      const id = agents.add('REVOKED');

      expect((await policy.resolveForNewDevice(id)).isFailure).toBe(
        true
      );
    });
  });
});
