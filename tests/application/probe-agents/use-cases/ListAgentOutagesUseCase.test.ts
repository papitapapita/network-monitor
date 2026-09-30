import { ListAgentOutagesUseCase } from '../../../../src/application/probe-agents/use-cases';
import { IAgentOutageQuery } from '../../../../src/application/probe-agents/interfaces';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeLogger,
  makePendingAgent
} from '../fixtures';

const GHOST_ID = '00000000-0000-4000-8000-000000000001';

describe('ListAgentOutagesUseCase', () => {
  let repo: InMemoryAgentRepository;
  let query: jest.Mocked<IAgentOutageQuery>;
  let useCase: ListAgentOutagesUseCase;
  let agentId: string;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    query = {
      list: jest
        .fn()
        .mockResolvedValue(Result.ok({ outages: [], total: 0 }))
    };
    useCase = new ListAgentOutagesUseCase(repo, query, makeLogger());
    agentId = repo
      .seed(makePendingAgent(new FakeAgentSecretService(), 'code'))
      .id.toString();
  });

  it('[AGT-026] pages 20 at a time by default and caps a page at 100', async () => {
    await useCase.execute({ id: agentId });
    await useCase.execute({ id: agentId, limit: 500, offset: 40 });

    expect(query.list.mock.calls[0][1]).toEqual({
      limit: 20,
      offset: 0
    });
    expect(query.list.mock.calls[1][1]).toEqual({
      limit: 100,
      offset: 40
    });
  });

  it('[AGT-026] says whether more outages follow the page', async () => {
    const outage = {
      id: 'o',
      silentSince: '2026-09-28T10:00:00.000Z',
      offlineSince: '2026-09-28T10:05:00.000Z',
      endedAt: null,
      endReason: null
    };
    query.list.mockResolvedValue(
      Result.ok({ outages: [outage], total: 2 })
    );

    const result = await useCase.execute({ id: agentId, limit: 1 });

    expect(result.value).toEqual({
      outages: [outage],
      total: 2,
      limit: 1,
      offset: 0,
      hasMore: true
    });
  });

  it('fails for an unknown agent without querying outages', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.error).toBe(`Agent not found: ${GHOST_ID}`);
    expect(query.list).not.toHaveBeenCalled();
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: 'nope' });

    expect(result.error).toMatch(/^Invalid agent ID/);
  });
});
