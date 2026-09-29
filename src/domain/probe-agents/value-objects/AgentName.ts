import { ValueObject, Result, Guard } from 'domain/shared/core';

const MAX_LENGTH = 60;

interface AgentNameProps {
  readonly value: string;
}

export class AgentName extends ValueObject<AgentNameProps> {
  private constructor(props: AgentNameProps) {
    super(props);
  }

  get value(): string {
    return this._props.value;
  }

  public static create(raw: string): Result<AgentName> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(raw, 'name'),
      Guard.isString(raw, 'name')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<AgentName>(guardResult.message!);
    }

    const value = raw.trim();
    if (value.length === 0) {
      return Result.fail<AgentName>('Agent name cannot be empty');
    }
    if (value.length > MAX_LENGTH) {
      return Result.fail<AgentName>(
        `Agent name cannot exceed ${MAX_LENGTH} characters`
      );
    }
    return Result.ok(new AgentName({ value }));
  }
}
