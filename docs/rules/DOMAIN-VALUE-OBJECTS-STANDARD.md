# DOMAIN VALUE OBJECTS STANDARD

## Table of Contents

1. [Purpose of Value Objects in DDD](#1-purpose-of-value-objects-in-ddd)
2. [Responsibilities of a Value Object](#2-responsibilities-of-a-value-object)
3. [Boundaries of a Value Object](#3-boundaries-of-a-value-object)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Value Object Lifetime & Lifecycle](#5-value-object-lifetime--lifecycle)
6. [Value Object Structure Template](#6-value-object-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Equality and Immutability](#10-equality-and-immutability)
11. [Testing Strategy](#11-testing-strategy)
12. [Examples](#12-examples)

---

## 1. Purpose of Value Objects in DDD

**Value Objects are immutable objects that represent a descriptive aspect of the domain with no conceptual identity.**

### Core Characteristics:

- **Immutable**: Once created, their state cannot change
- **No Identity**: Defined entirely by their attributes, not by an ID
- **Replaceable**: If you need to change a value, you create a new instance
- **Self-Validating**: Always in a valid state (validation happens at creation)
- **Comparable by Value**: Two instances with the same values are considered equal

### Why Value Objects?

1. **Domain Clarity**: Makes domain concepts explicit (IPAddress, not string)
2. **Type Safety**: Prevents invalid states through compile-time and runtime validation
3. **Encapsulation**: Business rules live with the data they protect
4. **Reusability**: Used across multiple entities and aggregates
5. **Expressiveness**: `order.total` is clearer than `order.totalAmount`

---

## 2. Responsibilities of a Value Object

### MUST DO:

1. **Represent a domain concept**

   - Model a measurable, quantifiable, or descriptive attribute
   - Examples: Money, Address, DateRange, Temperature, Coordinates

2. **Validate its own invariants**

   - All business rules for that value
   - Format validation (e.g., email pattern, IP format)
   - Range validation (e.g., age between 0-150)
   - Business constraints (e.g., start date before end date)

3. **Be immutable**

   - All properties readonly
   - No setter methods
   - Create new instances for transformations

4. **Implement value equality**

   - Two instances with same values are equal
   - Implement equals() or comparison methods
   - Consider implementing hash code for use in collections

5. **Provide meaningful operations**

   - Domain-specific transformations
   - Calculations and derivations
   - Formatting and parsing

6. **Fail fast on invalid construction**
   - Return Result<T> with clear error messages
   - Never allow invalid state

---

## 3. Boundaries of a Value Object

### MUST NOT DO:

1. **❌ Have Identity**

   - No ID or unique identifier
   - Identity belongs to Entities and Aggregates

2. **❌ Be Mutable**

   - No methods that change internal state
   - No setters or mutation methods

3. **❌ Contain orchestration or process logic**

   - Multi-step operations belong in Use Cases
   - Cross-aggregate logic belongs in Domain Services

4. **❌ Depend on Infrastructure**

   - No database access
   - No external API calls
   - No file system operations
   - No framework dependencies

5. **❌ Reference Entities or Aggregates**

   - Value Objects are leaves in the dependency tree
   - Can contain other Value Objects
   - Cannot hold references to Entities

6. **❌ Dispatch Domain Events**

   - Events are dispatched by Aggregates

7. **❌ Have Side Effects**
   - All methods should be pure functions
   - Given same inputs, always return same output

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  - DTOs receive primitive values (strings, numbers)         │
│  - Never expose Value Objects directly to API               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                         │
│  - Use Cases create Value Objects from primitives           │
│  - Mappers extract primitives from Value Objects            │
│  - Validation happens here (create Value Objects)           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                            │
│  ┌───────────────────────────────────────────────────┐      │
│  │              VALUE OBJECTS (You are here)         │      │
│  │  - IPAddress, MACAddress, Email, Money, etc.      │      │
│  │  - Encapsulate validation and domain rules        │      │
│  │  - Provide domain operations (compare, format)    │      │
│  │  - Used by: Entities, Aggregates, Domain Services │      │
│  └───────────────────────────────────────────────────┘      │
│         ▲                          ▲                        │
│         │                          │                        │
│  ┌──────┴──────┐           ┌───────┴──────┐                 │
│  │  Entities   │           │  Aggregates  │                 │
│  │             │           │              │                 │
│  │ - Contain   │           │ - Contain    │                 │
│  │   Value     │           │   Value      │                 │
│  │   Objects   │           │   Objects    │                 │
│  └─────────────┘           └──────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                       │
│  - Infrastructure Mappers extract primitives for DB         │
│  - Infrastructure Mappers recreate Value Objects from DB    │
│  - Value Objects never know about persistence               │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rules:

✅ **Value Objects CAN depend on:**

- Other Value Objects (composition)
- Domain primitives (Typescript primitives)
- Shared kernel types (Result<T>)

❌ **Value Objects CANNOT depend on:**

- Entities or Aggregates
- Repositories
- Use Cases
- Infrastructure
- Application Services

---

## 5. Value Object Lifetime & Lifecycle

### Creation Flow:

```typescript
// 1. Receive primitive value (from DTO, database, or domain operation)
const ipString = '192.168.1.1';

// 2. Call static factory method
const ipAddressResult = IPAddress.create(ipString);

// 3. Check if creation succeeded
if (ipAddressResult.isFailure) {
  // Handle validation error
  return Result.fail(ipAddressResult.error);
}

// 4. Extract value (guaranteed valid)
const ipAddress = ipAddressResult.value;

// 5. Use in domain operations
const subnet = ipAddress.getSubnet(24);
const formatted = ipAddress.toString();

// 6. If change needed, create new instance (immutability)
const newIpResult = IPAddress.create('10.0.0.1');
```

### Lifecycle Characteristics:

1. **Short-lived**: Created when needed, discarded when no longer referenced
2. **No persistence lifecycle**: No separate "save" or "load" - they're part of entities
3. **Thread-safe**: Immutability makes them inherently thread-safe
4. **Garbage collected**: No manual cleanup needed
5. **Stateless operations**: Methods don't change internal state

---

## 6. Value Object Structure Template

### Base Class Pattern

**All Value Objects extend the base `ValueObject<T>` class**, which provides:

- Runtime immutability via `Object.freeze()`
- Consistent props-based pattern
- Built-in `equals()` method using deep comparison

**Base ValueObject class** (src/domain/core/ValueObject.ts):

```typescript
import { ValueObjectProps } from '../shared/props/ValueObjectProps';

export abstract class ValueObject<T extends ValueObjectProps> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props); // Runtime immutability
  }

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (!(vo instanceof ValueObject)) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
```

### Simple Value Object (Single Property):

```typescript
import { ValueObject, Result, Guard } from '../';

/**
 * Represents [DOMAIN CONCEPT].
 *
 * Business Rules:
 * - [Rule 1]
 * - [Rule 2]
 *
 * @example
 * const result = ValueObjectName.create("value");
 * if (result.isSuccess) {
 *   const vo = result.value;
 *   console.log(vo.toString());
 * }
 */

interface ValueObjectNameProps {
  value: string; // Or number, boolean, etc.
}

export class ValueObjectName extends ValueObject<ValueObjectNameProps> {
  /**
   * Public getter for the value.
   * Accesses the frozen props object.
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Private constructor enforces factory method usage.
   * Guarantees all instances are valid.
   */
  private constructor(props: ValueObjectNameProps) {
    super(props); // Props are frozen in base class
  }

  /**
   * Factory method for creating a ValueObjectName.
   *
   * @param value - The raw value to validate and encapsulate
   * @returns Result<ValueObjectName> - Success with valid instance or failure with error
   */
  public static create(value: string): Result<ValueObjectName> {
    // Guard clauses for null/undefined/type checking
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(value, 'value'),
      Guard.isString(value, 'value')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<ValueObjectName>(guardResult.message!);
    }

    // Trim whitespace (if applicable)
    const trimmedValue = value.trim();

    // Empty check
    if (trimmedValue.length === 0) {
      return Result.fail<ValueObjectName>('Value cannot be empty');
    }

    // Business rule validation
    if (!this.isValid(trimmedValue)) {
      return Result.fail<ValueObjectName>(
        'Invalid value: [specific reason]'
      );
    }

    return Result.ok<ValueObjectName>(
      new ValueObjectName({ value: trimmedValue })
    );
  }

  /**
   * Validation logic encapsulated in private method.
   */
  private static isValid(value: string): boolean {
    // Implement validation logic
    return true; // Example
  }

  /**
   * String representation for logging, debugging, and serialization.
   */
  public toString(): string {
    return this.props.value;
  }

  // Note: equals() is inherited from ValueObject base class
}
```

### Complex Value Object (Multiple Properties):

```typescript
import { ValueObject, Result, Guard } from '../';

interface PollingIntervalProps {
  seconds: number;
}

/**
 * Represents the time interval between consecutive polls.
 *
 * Business Rules:
 * - Must be between 1 second and 86400 seconds (24 hours)
 * - Must be an integer value
 */
export class PollingInterval extends ValueObject<PollingIntervalProps> {
  public static readonly MIN_SECONDS = 1;
  public static readonly MAX_SECONDS = 86400; // 24 hours

  get seconds(): number {
    return this.props.seconds;
  }

  private constructor(props: PollingIntervalProps) {
    super(props); // Props are frozen in base class
  }

  public static create(seconds: number): Result<PollingInterval> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        seconds,
        'polling interval seconds'
      ),
      Guard.isNumber(seconds, 'polling interval seconds'),
      Guard.inRange(
        seconds,
        this.MIN_SECONDS,
        this.MAX_SECONDS,
        'polling interval'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingInterval>(guardResult.message!);
    }

    // Ensure it's an integer
    const roundedSeconds = Math.round(seconds);

    return Result.ok<PollingInterval>(
      new PollingInterval({ seconds: roundedSeconds })
    );
  }

  /**
   * Domain operation: Convert to milliseconds.
   */
  public toMilliseconds(): number {
    return this.props.seconds * 1000;
  }

  /**
   * Domain operation: Human-readable format.
   */
  public toDisplayString(): string {
    const { seconds } = this.props;

    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }

    if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  public toString(): string {
    return this.props.seconds.toString();
  }

  // Note: equals() is inherited from ValueObject base class
}
```

### Value Object with Nested Value Objects:

```typescript
import { Result, IPAddress, MACAddress } from '../';

interface NetworkInterfaceProps {
  ipAddress: IPAddress;
  macAddress: MACAddress;
  interfaceName: string;
}

/**
 * Represents a network interface configuration.
 * Composed of other Value Objects.
 */
export class NetworkInterface extends ValueObject<NetworkInterfaceProps> {
  private constructor(props: NetworkInterfaceProps) {
    super(props);
  }

  // Getters expose Value Objects (safe because they're immutable)
  get ipAddress(): IPAddress {
    return this.props.ipAddress;
  }

  get macAddress(): MACAddress {
    return this.props.macAddress;
  }

  get interfaceName(): string {
    return this.props.interfaceName;
  }

  public static create(
    props: NetworkInterfaceProps
  ): Result<NetworkInterface> {
    // Validate composed Value Objects exist (already validated)
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefinedBulk([
        { argument: props.ipAddress, argumentName: 'ipAddress' },
        { argument: props.macAddress, argumentName: 'macAddress' },
        {
          argument: props.interfaceName,
          argumentName: 'interfaceName'
        }
      ])
    ]);

    // Validate interface name
    if (
      !props.interfaceName ||
      props.interfaceName.trim().length === 0
    ) {
      return Result.fail<NetworkInterface>(
        'Interface name is required'
      );
    }

    return Result.ok<NetworkInterface>(new NetworkInterface(props));
  }

  // Note: equals() is inherited from ValueObject base class
  // It performs deep comparison of all props automatically
}
```

**Note on equals()**: The base `ValueObject` class provides automatic deep comparison via JSON serialization. For value objects with nested VOs or complex equality logic, you can override the `equals()` method if needed:

```typescript
// Optional: Custom equals implementation
public equals(other: NetworkInterface | null | undefined): boolean {
  if (other == null || !(other instanceof NetworkInterface)) {
    return false;
  }
  return (
    this.props.ipAddress.equals(other.props.ipAddress) &&
    this.props.macAddress.equals(other.props.macAddress) &&
    this.props.interfaceName === other.props.interfaceName
  );
}
```

---

## 7. Orthogonality Principles

### 1. Single Responsibility

Each Value Object represents ONE domain concept:

```typescript
// ✅ GOOD - Each VO has single responsibility
interface EmailProps {
  value: string;
}

class Email extends ValueObject<EmailProps> {
  // Only email validation and operations
}

interface PhoneNumberProps {
  value: string;
}

class PhoneNumber extends ValueObject<PhoneNumberProps> {
  // Only phone validation and operations
}

// ❌ BAD - Mixed responsibilities
interface ContactInfoProps {
  email: string;
  phone: string;
}

class ContactInfo extends ValueObject<ContactInfoProps> {
  // Too broad, should be composed VOs (Email + PhoneNumber)
}
```

### 2. Independence

Value Objects should not depend on external state:

```typescript
// ✅ GOOD - Self-contained
interface TemperatureProps {
  celsius: number;
}

class Temperature extends ValueObject<TemperatureProps> {
  public static create(celsius: number): Result<Temperature> {
    if (celsius < -273.15) {
      return Result.fail('Temperature below absolute zero');
    }
    return Result.ok(new Temperature({ celsius }));
  }
}

// ❌ BAD - Depends on external config
class Temperature extends ValueObject<TemperatureProps> {
  public static create(value: number): Result<Temperature> {
    const config = ConfigService.get(); // External dependency!
    if (value < config.minTemp) {
      return Result.fail('Invalid temperature');
    }
    return Result.ok(new Temperature({ celsius: value }));
  }
}
```

### 3. Replaceability

Value Objects are easily replaceable:

```typescript
// Correct usage - replace entire instance
let deviceIp = IPAddress.create('192.168.1.1').value;

// Need to change? Create new instance
deviceIp = IPAddress.create('192.168.1.2').value;

// ❌ WRONG - attempting mutation
deviceIp.setValue('192.168.1.2'); // Doesn't exist! VOs are immutable
```

---

## 8. Naming Conventions

### Class Names:

- Use **nouns** that represent domain concepts
- Use **PascalCase**
- Be specific and descriptive
- Avoid generic names like `Value`, `Data`, `Info`

```typescript
// ✅ GOOD
class IPAddress {}
class EmailAddress {}
class MoneyAmount {}
class DateRange {}
class Percentage {}

// ❌ BAD
class IP {} // Too abbreviated
class Address {} // Too generic
class Value {} // Meaningless
class Data {} // Meaningless
```

### Property Names:

- Use an interface with the props `VOProps`
- Provide **public getters** without `get` prefix

```typescript
interface EmailProps {
  // ✅
  value: string;
}

class Email extends ValueObject<AddressProps> {
  constructor(props: EmailProps) {
    super(props); // ✅
  }

  public get value(): string {
    // ✅
    return this.props.value;
  }
}
```

### Method Names:

```typescript
class Money {
  // Factory methods: create, from, of
  public static create(
    amount: number,
    currency: string
  ): Result<Money>;
  public static fromCents(cents: number): Result<Money>;
  public static zero(currency: string): Money;

  // Transformations: Return new instances
  public add(other: Money): Result<Money>;
  public subtract(other: Money): Result<Money>;
  public multiply(factor: number): Money;

  // Queries: Return derived values
  public isZero(): boolean;
  public isPositive(): boolean;
  public hasSameCurrency(other: Money): boolean;

  // Conversions: to[Type]
  public toString(): string;
  public toCents(): number;

  // Comparison: equals, compare
  public equals(other: Money): boolean;
}
```

---

## 9. Error Handling Patterns

### Pattern 1: Result<T> for Factory Methods

All creation methods MUST return `Result<T>`:

```typescript
class Age {
  public static create(years: number): Result<Age> {
    if (years < 0) {
      return Result.fail<Age>('Age cannot be negative');
    }
    if (years > 150) {
      return Result.fail<Age>('Age cannot exceed 150 years');
    }
    return Result.ok<Age>(new Age(years));
  }
}

// Usage
const ageResult = Age.create(25);
if (ageResult.isFailure) {
  console.error(ageResult.error);
  return;
}
const age = ageResult.value;
```

### Pattern 2: Specific Error Messages

Provide clear, actionable error messages:

```typescript
// ✅ GOOD - Specific and actionable
return Result.fail<Email>(
  'Email format is invalid. Expected format: user@domain.com'
);
return Result.fail<IPAddress>(
  'Invalid IPv4 address. Must be in format XXX.XXX.XXX.XXX where XXX is 0-255'
);

// ❌ BAD - Vague and unhelpful
return Result.fail<Email>('Invalid');
return Result.fail<IPAddress>('Bad IP');
```

### Pattern 3: Fail Fast

Validate everything at creation time:

```typescript
public static create(props: MoneyProps): Result<Money> {
  // Check null/undefined first
  if (props.amount == null) {
    return Result.fail<Money>('Amount is required');
  }

  if (props.currency == null || props.currency.trim().length === 0) {
    return Result.fail<Money>('Currency is required');
  }

  // Then validate business rules
  if (props.amount < 0) {
    return Result.fail<Money>('Amount cannot be negative');
  }

  if (!this.isValidCurrency(props.currency)) {
    return Result.fail<Money>(`Invalid currency code: ${props.currency}`);
  }

  // All checks passed - create valid instance
  return Result.ok<Money>(new Money(props));
}
```

### Pattern 4: Operations Returning Results

Operations that can fail should return `Result<T>`:

```typescript
class Money {
  /**
   * Adds two Money amounts.
   * Fails if currencies don't match.
   */
  public add(other: Money): Result<Money> {
    if (!this.hasSameCurrency(other)) {
      return Result.fail<Money>(
        `Cannot add different currencies: ${this.currency} and ${other.currency}`
      );
    }

    const newAmount = this._amount + other._amount;
    return Money.create({
      amount: newAmount,
      currency: this._currency
    });
  }
}
```

---

## 10. Equality and Immutability

### Immutability Implementation (Props-Based Pattern):

**Our codebase uses the props-based pattern** where all value objects extend `ValueObject<T>`:

```typescript
interface MoneyProps {
  amount: number;
  currency: string;
}

class Money extends ValueObject<MoneyProps> {
  // 1. Props are protected readonly (set in base class)
  // protected readonly props: MoneyProps;

  // 2. Private constructor
  private constructor(props: MoneyProps) {
    super(props); // Object.freeze(props) happens here
  }

  // 3. No setters - only getters that access frozen props
  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  // 4. Operations return NEW instances
  public add(other: Money): Result<Money> {
    if (!this.hasSameCurrency(other)) {
      return Result.fail<Money>('Currency mismatch');
    }

    // Create NEW Money instance with new props
    return Money.create({
      amount: this.props.amount + other.props.amount,
      currency: this.props.currency
    });
  }
}
```

**How immutability is enforced:**

1. **`readonly` keyword** - The `props` field is marked `readonly`, preventing reassignment
2. **`Object.freeze()`** - The base `ValueObject` class freezes the props object at runtime
3. **No setters** - Only getters are provided, no way to modify values
4. **Private constructor** - Forces use of factory methods
5. **New instances for transformations** - Operations create new VOs instead of mutating

### Value Equality Implementation:

**Default behavior** - The base `ValueObject` class provides automatic equality:

```typescript
// In ValueObject base class
public equals(vo?: ValueObject<T>): boolean {
  if (vo === null || vo === undefined) {
    return false;
  }
  if (!(vo instanceof ValueObject)) {
    return false;
  }
  if (vo.props === undefined) {
    return false;
  }
  // Deep comparison via JSON serialization
  return JSON.stringify(this.props) === JSON.stringify(vo.props);
}
```

**Usage:**

```typescript
const email1 = Email.create('user@example.com').value;
const email2 = Email.create('user@example.com').value;
const email3 = Email.create('other@example.com').value;

console.log(email1.equals(email2)); // true - same value
console.log(email1.equals(email3)); // false - different value
```

### Custom Equality (When Needed):

You can override `equals()` for **custom comparison logic** (e.g., case-insensitive comparison, performance optimization):

```typescript
interface EmailProps {
  value: string;
}

class Email extends ValueObject<EmailProps> {
  /**
   * Custom equals implementation for case-insensitive comparison.
   * Overrides the default JSON-based comparison.
   */
  public equals(other?: ValueObject<EmailProps>): boolean {
    if (other == null || !(other instanceof Email)) {
      return false;
    }

    // Case-insensitive comparison
    return (
      this.props.value.toLowerCase() ===
      (other as Email).props.value.toLowerCase()
    );
  }
}
```

**When to override equals():**

- ✅ Case-insensitive comparison needed
- ✅ Performance optimization for large objects (avoid JSON.stringify)
- ✅ Special comparison logic (e.g., comparing dates, floating-point numbers with tolerance)
- ❌ Simple structural equality (use default implementation)

---

## 11. Testing Strategy

### Test Structure:

```typescript
import { IPAddress } from '@/domain/value-objects/IPAddress';

describe('IPAddress', () => {
  describe('create', () => {
    describe('when valid IPv4 address', () => {
      it('should create IPAddress successfully', () => {
        const result = IPAddress.create('192.168.1.1');

        expect(result.isSuccess).toBe(true);
        expect(result.value.toString()).toBe('192.168.1.1');
      });

      it('should handle edge case addresses', () => {
        expect(IPAddress.create('0.0.0.0').isSuccess).toBe(true);
        expect(IPAddress.create('255.255.255.255').isSuccess).toBe(
          true
        );
      });
    });

    describe('when invalid IPv4 address', () => {
      it('should fail for null or undefined', () => {
        expect(IPAddress.create(null as any).isFailure).toBe(true);
        expect(IPAddress.create(undefined as any).isFailure).toBe(
          true
        );
      });

      it('should fail for empty string', () => {
        const result = IPAddress.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for invalid format', () => {
        expect(IPAddress.create('192.168.1').isFailure).toBe(true);
        expect(IPAddress.create('192.168.1.1.1').isFailure).toBe(
          true
        );
        expect(IPAddress.create('999.999.999.999').isFailure).toBe(
          true
        );
      });

      it('should fail for out of range octets', () => {
        const result = IPAddress.create('192.168.1.256');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('0-255');
      });
    });
  });

  describe('domain operations', () => {
    it('should check if address is private', () => {
      const privateIp = IPAddress.create('192.168.1.1').value;
      const publicIp = IPAddress.create('8.8.8.8').value;

      expect(privateIp.isPrivate()).toBe(true);
      expect(publicIp.isPrivate()).toBe(false);
    });

    it('should calculate subnet', () => {
      const ip = IPAddress.create('192.168.1.100').value;
      const subnet = ip.getSubnet(24);

      expect(subnet).toBe('192.168.1.0');
    });
  });

  describe('equals', () => {
    it('should return true for same value', () => {
      const ip1 = IPAddress.create('192.168.1.1').value;
      const ip2 = IPAddress.create('192.168.1.1').value;

      expect(ip1.equals(ip2)).toBe(true);
    });

    it('should return false for different values', () => {
      const ip1 = IPAddress.create('192.168.1.1').value;
      const ip2 = IPAddress.create('192.168.1.2').value;

      expect(ip1.equals(ip2)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      const ip = IPAddress.create('192.168.1.1').value;

      expect(ip.equals(null)).toBe(false);
      expect(ip.equals(undefined)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const ip = IPAddress.create('192.168.1.1').value;

      // Props are frozen by Object.freeze()
      // @ts-expect-error - props is readonly and frozen
      expect(() => {
        ip.props.value = '10.0.0.1';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const ip = IPAddress.create('192.168.1.1').value;

      // TypeScript prevents this at compile time
      // @ts-expect-error - props is readonly
      ip.props = { value: '10.0.0.1' };
    });
  });
});
```

### Test Coverage Requirements:

1. **Creation Tests**:

   - Valid inputs (happy path)
   - Edge cases (boundary values)
   - Invalid inputs (null, empty, malformed)
   - Business rule violations

2. **Equality Tests**:

   - Same values → equal
   - Different values → not equal
   - Null/undefined → not equal
   - Case sensitivity (if applicable)

3. **Operation Tests**:

   - All public methods
   - Edge cases for calculations
   - Error scenarios for fallible operations

4. **Immutability Tests**:
   - Verify readonly properties
   - Verify operations return new instances

---

## 12. Examples

### Example 1: Simple Value Object - Email

```typescript
import { ValueObject, Result, Guard, EmailProps } from '../';

/**
 * Represents an email address.
 *
 * Business Rules:
 * - Must be valid email format (RFC 5322 simplified)
 * - Cannot be empty
 * - Case-insensitive comparison
 * - Maximum length 254 characters
 *
 * @example
 * const emailResult = Email.create('user@example.com');
 * if (emailResult.isSuccess) {
 *   const email = emailResult.value;
 *   console.log(email.getDomain()); // 'example.com'
 * }
 */
export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props); // Props are frozen in base class
  }

  get value(): string {
    return this.props.value;
  }

  public static create(email: string): Result<Email> {
    const isValid = Guard.combine([
      Guard.againstNullOrUndefined(email, 'email'),
      Guard.isString(email, 'email')
    ]);

    if (!isValid.succeeded) {
      return Result.fail<Email>(isValid.message!);
    }

    const trimmedEmail = email.trim().toLowerCase();

    const guardResult = Guard.combine([
      Guard.againstAtLeast(trimmedEmail.length, 1, 'email'),
      Guard.againstAtMost(trimmedEmail.length, 320, 'email'),
      Guard.isValidEmail(trimmedEmail, 'email')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Email>(guardResult.message!);
    }

    const [localPart, domain] = trimmedEmail.split('@');

    const guardResult2 = Guard.combine([
      Guard.againstAtMost(localPart.length, 64, 'local email part'),
      Guard.againstAtMost(domain.length, 255, 'domain email part')
    ]);

    if (guardResult2.succeeded === false) {
      return Result.fail<Email>(guardResult2.message!);
    }

    return Result.ok<Email>(new Email({ value: trimmedEmail }));
  }

  /**
   * Extracts the domain portion of the email.
   * Example: user@example.com → example.com
   */
  public getDomain(): string {
    return this.props.value.split('@')[1];
  }

  /**
   * Extracts the local part (username) of the email.
   * Example: user@example.com → user
   */
  public getLocalPart(): string {
    return this.props.value.split('@')[0];
  }

  public toString(): string {
    return this.value;
  }

  // equals() inherited from ValueObject base class
}
```

### Example 2: Complex Value Object - Money

```typescript
import { ValueObject, Result, Guard } from '../';

interface MoneyProps {
  amount: number;
  currency: string; // ISO 4217 currency code (USD, EUR, etc.)
}

/**
 * Represents a monetary amount with currency.
 *
 * Business Rules:
 * - Amount can be negative (for debts/credits)
 * - Currency must be valid ISO 4217 code
 * - Precision: 2 decimal places
 * - Operations only allowed on same currency
 *
 * @example
 * const priceResult = Money.create({ amount: 99.99, currency: 'USD' });
 * const price = priceResult.value;
 * const doubled = price.multiply(2); // $199.98
 */
export class Money extends ValueObject<MoneyProps> {
  private static readonly VALID_CURRENCIES = [
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'CNY',
    'BRL'
    // Add more as needed
  ];

  private constructor(props: MoneyProps) {
    super(props); // Props are frozen in base class
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  public static create(props: MoneyProps): Result<Money> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.amount, 'amount'),
      Guard.againstNullOrUndefined(props.currency, 'currency'),
      Guard.isNumber(props.amount, 'amount')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Money>(guardResult.message!);
    }

    if (!Number.isFinite(props.amount)) {
      return Result.fail<Money>('Amount must be a finite number');
    }

    if (props.currency.trim().length === 0) {
      return Result.fail<Money>('Currency is required');
    }

    const upperCurrency = props.currency.toUpperCase();
    if (!this.VALID_CURRENCIES.includes(upperCurrency)) {
      return Result.fail<Money>(
        `Invalid currency code: ${props.currency}. Must be one of: ${this.VALID_CURRENCIES.join(', ')}`
      );
    }

    // Round to 2 decimal places and normalize currency
    const normalizedAmount = Math.round(props.amount * 100) / 100;

    return Result.ok<Money>(
      new Money({
        amount: normalizedAmount,
        currency: upperCurrency
      })
    );
  }

  public static zero(currency: string): Money {
    const result = Money.create({ amount: 0, currency });
    if (result.isFailure) {
      throw new Error(`Cannot create zero amount: ${result.error}`);
    }
    return result.value;
  }

  /**
   * Adds two Money amounts.
   * Only works if currencies match.
   */
  public add(other: Money): Result<Money> {
    if (!this.hasSameCurrency(other)) {
      return Result.fail<Money>(
        `Cannot add different currencies: ${this.props.currency} and ${other.props.currency}`
      );
    }

    return Money.create({
      amount: this.props.amount + other.props.amount,
      currency: this.props.currency
    });
  }

  /**
   * Subtracts another Money amount from this one.
   */
  public subtract(other: Money): Result<Money> {
    if (!this.hasSameCurrency(other)) {
      return Result.fail<Money>(
        `Cannot subtract different currencies: ${this.props.currency} and ${other.props.currency}`
      );
    }

    return Money.create({
      amount: this.props.amount - other.props.amount,
      currency: this.props.currency
    });
  }

  /**
   * Multiplies the amount by a factor.
   * Useful for discounts, tax calculations, etc.
   */
  public multiply(factor: number): Money {
    const result = Money.create({
      amount: this.props.amount * factor,
      currency: this.props.currency
    });

    if (result.isFailure) {
      throw new Error(`Multiplication failed: ${result.error}`);
    }

    return result.value;
  }

  /**
   * Checks if amount is zero.
   */
  public isZero(): boolean {
    return this.props.amount === 0;
  }

  /**
   * Checks if amount is positive.
   */
  public isPositive(): boolean {
    return this.props.amount > 0;
  }

  /**
   * Checks if amount is negative.
   */
  public isNegative(): boolean {
    return this.props.amount < 0;
  }

  /**
   * Checks if this Money has the same currency as another.
   */
  public hasSameCurrency(other: Money): boolean {
    return this.props.currency === other.props.currency;
  }

  /**
   * Formats the money for display.
   * Example: USD 1234.56 → $1,234.56
   */
  public format(): string {
    const symbols: { [key: string]: string } = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CNY: '¥',
      BRL: 'R$'
    };

    const symbol =
      symbols[this.props.currency] || this.props.currency;
    const formatted = this.props.amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return `${symbol}${formatted}`;
  }

  public toString(): string {
    return `${this.props.currency} ${this.props.amount.toFixed(2)}`;
  }

  // equals() inherited from ValueObject base class
}
```

### Example 3: Composite Value Object - Address

```typescript
import { ValueObject, Result, Guard, AddressProps } from '../';

/**
 * Represents a physical mailing address.
 *
 * Business Rules:
 * - All fields are required
 * - ZIP code format depends on country
 * - State is required for US addresses
 *
 * @example
 * const addressResult = Address.create({
 *   street: '123 Main St',
 *   city: 'San Francisco',
 *   state: 'CA',
 *   zipCode: '94102',
 *   country: 'US'
 * });
 * console.log(addressResult.value.format());
 */
export class Address extends ValueObject<AddressProps> {
  private constructor(props: AddressProps) {
    super(props); // Props are frozen in base class
  }

  // Getters access frozen props
  get street(): string {
    return this.props.street;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): string {
    return this.props.state;
  }

  get zipCode(): string {
    return this.props.zipCode;
  }

  get country(): string {
    return this.props.country;
  }

  public static create(props: AddressProps): Result<Address> {
    // Validate all required fields using Guard
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefinedBulk([
        { argument: props.street, argumentName: 'street' },
        { argument: props.city, argumentName: 'city' },
        { argument: props.state, argumentName: 'state' },
        { argument: props.zipCode, argumentName: 'zipCode' },
        { argument: props.country, argumentName: 'country' }
      ])
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Address>(guardResult.message!);
    }

    // Validate field contents
    if (props.street.trim().length === 0) {
      return Result.fail<Address>('Street is required');
    }

    if (props.city.trim().length === 0) {
      return Result.fail<Address>('City is required');
    }

    if (props.state.trim().length === 0) {
      return Result.fail<Address>('State is required');
    }

    if (props.zipCode.trim().length === 0) {
      return Result.fail<Address>('ZIP code is required');
    }

    if (props.country.trim().length === 0) {
      return Result.fail<Address>('Country is required');
    }

    // Validate ZIP code format
    const country = props.country.toUpperCase();
    if (!this.isValidZipCode(props.zipCode, country)) {
      return Result.fail<Address>(
        `Invalid ZIP code format for ${country}`
      );
    }

    // Normalize all fields before creating
    return Result.ok<Address>(
      new Address({
        street: props.street.trim(),
        city: props.city.trim(),
        state: props.state.trim().toUpperCase(),
        zipCode: props.zipCode.trim(),
        country: country
      })
    );
  }

  private static isValidZipCode(
    zipCode: string,
    country: string
  ): boolean {
    const patterns: { [key: string]: RegExp } = {
      US: /^\d{5}(-\d{4})?$/,
      CA: /^[A-Z]\d[A-Z] \d[A-Z]\d$/,
      UK: /^[A-Z]{1,2}\d{1,2}[A-Z]? \d[A-Z]{2}$/,
      BR: /^\d{5}-\d{3}$/
    };

    const pattern = patterns[country];
    if (!pattern) {
      return true; // Unknown country, skip validation
    }

    return pattern.test(zipCode);
  }

  /**
   * Formats address for mailing label.
   */
  public format(): string {
    return `${this.props.street}\n${this.props.city}, ${this.props.state} ${this.props.zipCode}\n${this.props.country}`;
  }

  /**
   * Returns one-line representation.
   */
  public toOneLine(): string {
    return `${this.props.street}, ${this.props.city}, ${this.props.state} ${this.props.zipCode}, ${this.props.country}`;
  }

  public toString(): string {
    return this.toOneLine();
  }

  // equals() inherited from ValueObject base class
}
```

---

## Summary Checklist

When creating a Value Object, ensure:

- ✅ Extends `ValueObject<TProps>` base class
- ✅ Defines a `TProps` interface with all properties
- ✅ Represents a domain concept (not a primitive wrapper)
- ✅ Is immutable (`protected readonly props` + `Object.freeze()`)
- ✅ Has private constructor + static factory method (`create()`)
- ✅ Returns `Result<T>` from factory methods
- ✅ Validates all business rules at creation using `Guard` clauses
- ✅ Provides public getters that access `this.props`
- ✅ Inherits `equals()` from base class (or overrides if needed)
- ✅ Implements `toString()` for debugging/logging
- ✅ Has no identity (no ID field)
- ✅ Contains no infrastructure dependencies
- ✅ Does not reference Entities or Aggregates
- ✅ All methods are pure functions
- ✅ Provides domain-specific operations
- ✅ Has comprehensive unit tests
- ✅ Fails fast with clear error messages

---

**Remember**: Value Objects are the building blocks of your domain model. They make implicit concepts explicit, enforce business rules, and provide type safety. When in doubt, create a Value Object rather than using primitives!
