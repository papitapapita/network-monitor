import { ValueObject, Result, Guard } from 'domain/shared/core';

interface CedulaProps {
  value: string;
}

export class Cedula extends ValueObject<CedulaProps> {
  static readonly MIN_LENGTH = 6;
  static readonly MAX_LENGTH = 10;
  private static readonly DIGITS_ONLY = /^\d+$/;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: CedulaProps) {
    super(props);
  }

  public static create(cedula: string): Result<Cedula> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(cedula, 'cedula'),
      Guard.isString(cedula, 'cedula')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<Cedula>(guardResult.message!);
    }

    const normalized = cedula.trim().replace(/[.\s]/g, '');

    if (normalized.length === 0) {
      return Result.fail<Cedula>('Cedula cannot be empty');
    }

    if (!Cedula.DIGITS_ONLY.test(normalized)) {
      return Result.fail<Cedula>('Cedula must contain only digits');
    }

    if (
      normalized.length < Cedula.MIN_LENGTH ||
      normalized.length > Cedula.MAX_LENGTH
    ) {
      return Result.fail<Cedula>(
        `Cedula must be between ${Cedula.MIN_LENGTH} and ${Cedula.MAX_LENGTH} digits`
      );
    }

    return Result.ok<Cedula>(new Cedula({ value: normalized }));
  }

  public static reconstitute(cedula: string): Cedula {
    return new Cedula({ value: cedula });
  }

  public toString(): string {
    return this._props.value;
  }
}
