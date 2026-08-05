import { UniqueEntityID, Result } from '../core';

export class TicketId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): TicketId {
    return new TicketId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<TicketId> {
    const result = TicketId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new TicketId(result.value));
  }
}
