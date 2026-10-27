import { UniqueEntityID, Result } from '../core';

export class InboxNotificationId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): InboxNotificationId {
    return new InboxNotificationId(UniqueEntityID.createId());
  }

  public static parse(id: string): Result<InboxNotificationId> {
    const result = InboxNotificationId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new InboxNotificationId(result.value));
  }
}
