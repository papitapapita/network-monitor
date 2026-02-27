import {
  ValueObject,
  Result,
  Guard,
  ManagementProtocolProps
} from '..';

/**
 * ManagementProtocol Value Object
 *
 * Represents the network management protocol used to communicate with a device.
 * This value object encapsulates the protocol type and provides domain-specific
 * operations for protocol handling.
 *
 * Business Rules:
 * - Protocol must be one of the predefined valid types
 * - Protocol cannot be null or empty
 * - Protocol values are case-insensitive (normalized to uppercase)
 *
 * @example
 * const protocolResult = ManagementProtocol.create('SNMP');
 * if (protocolResult.isSuccess) {
 *   const protocol = protocolResult.value;
 *   console.log(protocol.getDisplayName()); // 'SNMP'
 *   console.log(protocol.getDefaultPort()); // 161
 *   console.log(protocol.isSecure()); // false
 * }
 */
export class ManagementProtocol extends ValueObject<ManagementProtocolProps> {
  /**
   * Protocol type constants for type-safe values
   */
  public static readonly SNMP = 'SNMP';
  public static readonly SSH = 'SSH';
  public static readonly TELNET = 'TELNET';
  public static readonly HTTP = 'HTTP';
  public static readonly HTTPS = 'HTTPS';
  public static readonly ICMP = 'ICMP';
  public static readonly OTHER = 'OTHER';

  /**
   * Valid protocol values
   */
  private static readonly VALID_PROTOCOLS = [
    ManagementProtocol.SNMP,
    ManagementProtocol.SSH,
    ManagementProtocol.TELNET,
    ManagementProtocol.HTTP,
    ManagementProtocol.HTTPS,
    ManagementProtocol.ICMP,
    ManagementProtocol.OTHER
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(_props: ManagementProtocolProps) {
    super(_props);
  }

  /**
   * Creates a ManagementProtocol from a string value.
   *
   * @param protocol - Protocol type string
   * @returns Result containing ManagementProtocol or error message
   */
  public static create(protocol: string): Result<ManagementProtocol> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(protocol, 'management protocol'),
      Guard.isString(protocol, 'management protocol')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<ManagementProtocol>(guardResult.message!);
    }

    const trimmedProtocol = protocol.trim().toUpperCase();

    if (trimmedProtocol.length === 0) {
      return Result.fail<ManagementProtocol>(
        'Management protocol cannot be empty'
      );
    }

    if (!this.isValid(trimmedProtocol)) {
      return Result.fail<ManagementProtocol>(
        `Invalid management protocol: ${protocol}. Must be one of: ${this.VALID_PROTOCOLS.join(', ')}`
      );
    }

    return Result.ok<ManagementProtocol>(
      new ManagementProtocol({ value: trimmedProtocol })
    );
  }

  /**
   * Factory method to create an SNMP protocol.
   */
  public static createSnmp(): ManagementProtocol {
    return new ManagementProtocol({ value: this.SNMP });
  }

  /**
   * Factory method to create an SSH protocol.
   */
  public static createSsh(): ManagementProtocol {
    return new ManagementProtocol({ value: this.SSH });
  }

  /**
   * Factory method to create a TELNET protocol.
   */
  public static createTelnet(): ManagementProtocol {
    return new ManagementProtocol({ value: this.TELNET });
  }

  /**
   * Factory method to create an HTTP protocol.
   */
  public static createHttp(): ManagementProtocol {
    return new ManagementProtocol({ value: this.HTTP });
  }

  /**
   * Factory method to create an HTTPS protocol.
   */
  public static createHttps(): ManagementProtocol {
    return new ManagementProtocol({ value: this.HTTPS });
  }

  /**
   * Factory method to create an ICMP protocol.
   */
  public static createIcmp(): ManagementProtocol {
    return new ManagementProtocol({ value: this.ICMP });
  }

  /**
   * Factory method to create an OTHER protocol.
   */
  public static createOther(): ManagementProtocol {
    return new ManagementProtocol({ value: this.OTHER });
  }

  /**
   * Validates if a string is a valid ManagementProtocol.
   */
  public static isValid(value: string): boolean {
    return this.VALID_PROTOCOLS.includes(
      value as (typeof this.VALID_PROTOCOLS)[number]
    );
  }

  /**
   * Checks if this protocol is SNMP.
   */
  public isSnmp(): boolean {
    return this._props.value === ManagementProtocol.SNMP;
  }

  /**
   * Checks if this protocol is SSH.
   */
  public isSsh(): boolean {
    return this._props.value === ManagementProtocol.SSH;
  }

  /**
   * Checks if this protocol is TELNET.
   */
  public isTelnet(): boolean {
    return this._props.value === ManagementProtocol.TELNET;
  }

  /**
   * Checks if this protocol is HTTP.
   */
  public isHttp(): boolean {
    return this._props.value === ManagementProtocol.HTTP;
  }

  /**
   * Checks if this protocol is HTTPS.
   */
  public isHttps(): boolean {
    return this._props.value === ManagementProtocol.HTTPS;
  }

  /**
   * Checks if this protocol is ICMP.
   */
  public isIcmp(): boolean {
    return this._props.value === ManagementProtocol.ICMP;
  }

  /**
   * Checks if this protocol is OTHER.
   */
  public isOther(): boolean {
    return this._props.value === ManagementProtocol.OTHER;
  }

  /**
   * Checks if this protocol uses encryption/secure communication.
   *
   * Secure protocols: SSH, HTTPS
   * Insecure protocols: SNMP (v1/v2c), TELNET, HTTP, ICMP, OTHER
   *
   * @returns true if the protocol is secure
   */
  public isSecure(): boolean {
    return (
      this._props.value === ManagementProtocol.SSH ||
      this._props.value === ManagementProtocol.HTTPS
    );
  }

  /**
   * Checks if this protocol is deprecated or considered insecure.
   *
   * TELNET is deprecated due to lack of encryption.
   *
   * @returns true if the protocol is deprecated
   */
  public isDeprecated(): boolean {
    return this._props.value === ManagementProtocol.TELNET;
  }

  /**
   * Gets the default port number for this protocol.
   *
   * Default ports:
   * - SNMP: 161
   * - SSH: 22
   * - TELNET: 23
   * - HTTP: 80
   * - HTTPS: 443
   * - ICMP: N/A (returns 0 as ICMP doesn't use ports)
   * - OTHER: 0 (unknown)
   *
   * @returns Default port number, or 0 if not applicable
   */
  public getDefaultPort(): number {
    switch (this._props.value) {
      case ManagementProtocol.SNMP:
        return 161;
      case ManagementProtocol.SSH:
        return 22;
      case ManagementProtocol.TELNET:
        return 23;
      case ManagementProtocol.HTTP:
        return 80;
      case ManagementProtocol.HTTPS:
        return 443;
      case ManagementProtocol.ICMP:
      case ManagementProtocol.OTHER:
      default:
        return 0;
    }
  }

  /**
   * Gets a user-friendly display name for this protocol.
   *
   * @returns Human-readable name
   */
  public getDisplayName(): string {
    switch (this._props.value) {
      case ManagementProtocol.SNMP:
        return 'SNMP';
      case ManagementProtocol.SSH:
        return 'SSH';
      case ManagementProtocol.TELNET:
        return 'Telnet';
      case ManagementProtocol.HTTP:
        return 'HTTP';
      case ManagementProtocol.HTTPS:
        return 'HTTPS';
      case ManagementProtocol.ICMP:
        return 'ICMP';
      case ManagementProtocol.OTHER:
      default:
        return 'Other';
    }
  }

  public static validProtocols(): string[] {
    return [...ManagementProtocol.VALID_PROTOCOLS];
  }

  /**
   * Returns the string representation of the protocol.
   */
  public toString(): string {
    return this._props.value;
  }

  // equals() inherited from ValueObject base class
}
