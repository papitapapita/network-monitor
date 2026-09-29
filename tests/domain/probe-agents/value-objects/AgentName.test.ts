import { AgentName } from '../../../../src/domain/probe-agents';

describe('AgentName', () => {
  it('trims surrounding whitespace', () => {
    expect(AgentName.create('  Torre Norte  ').value.value).toBe(
      'Torre Norte'
    );
  });

  it('rejects an empty name', () => {
    const result = AgentName.create('   ');

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('cannot be empty');
  });

  it('accepts 60 characters and rejects 61', () => {
    expect(AgentName.create('a'.repeat(60)).isSuccess).toBe(true);
    expect(AgentName.create('a'.repeat(61)).error).toContain(
      'cannot exceed 60'
    );
  });

  it('rejects a non-string', () => {
    expect(AgentName.create(42 as unknown as string).isFailure).toBe(
      true
    );
  });

  it('is equal to another name with the same value', () => {
    expect(
      AgentName.create('POP Centro').value.equals(
        AgentName.create('POP Centro').value
      )
    ).toBe(true);
  });
});
