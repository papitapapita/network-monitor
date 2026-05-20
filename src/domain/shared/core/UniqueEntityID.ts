import { Identifier } from './Identifier';
import { UUID } from '../utils/UUID';
import { Result } from './Result';

export abstract class UniqueEntityID extends Identifier<string> {
  // Throws on invalid UUID — subclass factory methods must use createId() or
  // parseId() to produce safe values before calling super().
  protected constructor(id: string) {
    if (!UUID.isValid(id)) {
      throw new Error(
        `[UniqueEntityID] Invariant violation: "${id}" is not a valid UUID v4. ` +
          `Use generateId() or parseId() in your subclass factory methods.`
      );
    }
    super(id);
  }

  protected static createId(): string {
    return UUID.create().toValue();
  }

  protected static parseId(id: string): Result<string> {
    const result = UUID.parse(id);
    if (result.isFailure) return Result.fail(result.error);
    return Result.ok(result.value.toValue());
  }

  public static isValid(value: string): boolean {
    return UUID.isValid(value);
  }
}
