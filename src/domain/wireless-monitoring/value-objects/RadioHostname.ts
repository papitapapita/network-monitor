import { ValueObject, Result, Guard } from 'domain/shared/core';

interface RadioHostnameProps {
  readonly value: string;
}

const MAX_LENGTH = 32;
// WLS-223: plain ASCII only. The name is written into the radio's
// configuration file and set as its host name over a shell, where a quote,
// a slash or an accented letter would not survive.
const ALLOWED = /^[A-Za-z0-9 ._-]+$/;

export class RadioHostname extends ValueObject<RadioHostnameProps> {
  private constructor(props: RadioHostnameProps) {
    super(props);
  }

  get value(): string {
    return this._props.value;
  }

  static create(raw: string): Result<RadioHostname> {
    const guardResult = Guard.againstNullOrUndefined(raw, 'hostname');
    if (!guardResult.succeeded)
      return Result.fail(guardResult.message!);
    if (typeof raw !== 'string')
      return Result.fail('Radio name must be text');

    const value = raw.trim();
    if (value.length === 0)
      return Result.fail('Radio name is required');
    if (value.length > MAX_LENGTH)
      return Result.fail(
        `Radio name must be at most ${MAX_LENGTH} characters`
      );
    if (!ALLOWED.test(value))
      return Result.fail(
        'Radio name must be letters, digits, spaces, dots, dashes or underscores, without accents'
      );

    return Result.ok(new RadioHostname({ value }));
  }
}
