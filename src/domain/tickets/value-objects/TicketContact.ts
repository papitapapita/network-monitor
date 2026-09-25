import { ValueObject, Result, Guard } from 'domain/shared/core';
import { TicketContactProps } from '../props';
import { ContactPhone } from './ContactPhone';

const MAX_NAME = 150;

// The person to ask for on site, snapshotted onto the ticket. Exists for
// prospects who are not customers yet, so it is free text rather than a link —
// the same approach quotations take for the people they quote.
export class TicketContact extends ValueObject<TicketContactProps> {
  get name(): string {
    return this._props.name;
  }

  get phone(): ContactPhone | null {
    return this._props.phone;
  }

  private constructor(props: TicketContactProps) {
    super(props);
  }

  public static create(props: {
    name: string;
    phone?: string | null;
  }): Result<TicketContact> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.name, 'contact name'),
      Guard.isString(props.name, 'contact name')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<TicketContact>(guardResult.message!);
    }

    const name = props.name.trim();
    if (name.length === 0) {
      return Result.fail<TicketContact>(
        'Contact name cannot be empty'
      );
    }
    if (name.length > MAX_NAME) {
      return Result.fail<TicketContact>(
        `Contact name cannot exceed ${MAX_NAME} characters`
      );
    }

    let phone: ContactPhone | null = null;
    if (props.phone !== undefined && props.phone !== null) {
      const phoneResult = ContactPhone.create(props.phone);
      if (phoneResult.isFailure) {
        return Result.fail<TicketContact>(
          `Invalid contact phone: ${phoneResult.error}`
        );
      }
      phone = phoneResult.value;
    }

    return Result.ok<TicketContact>(
      new TicketContact({ name, phone })
    );
  }

  public static reconstitute(
    props: TicketContactProps
  ): TicketContact {
    return new TicketContact(props);
  }
}
