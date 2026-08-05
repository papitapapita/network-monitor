import { ValueObject, Result, Guard } from 'domain/shared/core';
import { TicketCategoryProps } from '../props';

export class TicketCategory extends ValueObject<TicketCategoryProps> {
  static readonly CONNECTIVITY = 'CONNECTIVITY';
  static readonly INSTALLATION = 'INSTALLATION';
  static readonly HARDWARE_FAILURE = 'HARDWARE_FAILURE';
  static readonly MAINTENANCE = 'MAINTENANCE';
  static readonly RELOCATION = 'RELOCATION';
  static readonly OTHER = 'OTHER';

  private static readonly VALID_CATEGORIES = [
    TicketCategory.CONNECTIVITY,
    TicketCategory.INSTALLATION,
    TicketCategory.HARDWARE_FAILURE,
    TicketCategory.MAINTENANCE,
    TicketCategory.RELOCATION,
    TicketCategory.OTHER
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: TicketCategoryProps) {
    super(props);
  }

  public static create(category: string): Result<TicketCategory> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(category, 'category'),
      Guard.isString(category, 'category')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<TicketCategory>(guardResult.message!);
    }

    const normalized = category.trim().toUpperCase();

    if (!TicketCategory.isValid(normalized)) {
      return Result.fail<TicketCategory>(
        `Invalid ticket category: ${category}. Must be one of: ${TicketCategory.VALID_CATEGORIES.join(', ')}`
      );
    }

    return Result.ok<TicketCategory>(
      new TicketCategory({ value: normalized })
    );
  }

  public static reconstitute(category: string): TicketCategory {
    return new TicketCategory({ value: category });
  }

  private static isValid(value: string): boolean {
    return TicketCategory.VALID_CATEGORIES.includes(
      value as (typeof TicketCategory.VALID_CATEGORIES)[number]
    );
  }

  public toString(): string {
    return this._props.value;
  }
}
