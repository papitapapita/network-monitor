# [LAYER] [COMPONENT NAME] STANDARD

## Table of Contents

1. [Purpose of [Component] in DDD](#1-purpose-of-component-in-ddd)
2. [Responsibilities of a [Component]](#2-responsibilities-of-a-component)
3. [Boundaries of a [Component]](#3-boundaries-of-a-component)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [[Component] Lifetime & Lifecycle](#5-component-lifetime--lifecycle)
6. [[Component] Structure Template](#6-component-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Testing Strategy](#10-testing-strategy)
11. [Examples](#11-examples)

---

## 1. Purpose of [Component] in DDD

**[One-sentence definition of what this component is in DDD context]**

### Core Characteristics:

- **[Characteristic 1]**: [Description]
- **[Characteristic 2]**: [Description]
- **[Characteristic 3]**: [Description]
- **[Characteristic 4]**: [Description]
- **[Characteristic 5]**: [Description]

### Why [Component]?

1. **[Reason 1]**: [Explanation]
2. **[Reason 2]**: [Explanation]
3. **[Reason 3]**: [Explanation]
4. **[Reason 4]**: [Explanation]
5. **[Reason 5]**: [Explanation]

### [Component] vs [Related Component]:

| Aspect         | [Component]     | [Related Component] |
| -------------- | --------------- | ------------------- |
| **[Aspect 1]** | [Description]   | [Description]       |
| **[Aspect 2]** | [Description]   | [Description]       |
| **[Aspect 3]** | [Description]   | [Description]       |
| **[Aspect 4]** | [Description]   | [Description]       |

---

## 2. Responsibilities of a [Component]

### MUST DO:

1. **[Responsibility 1]**

   - [Detail 1]
   - [Detail 2]
   - [Detail 3]

2. **[Responsibility 2]**

   - [Detail 1]
   - [Detail 2]
   - [Detail 3]

3. **[Responsibility 3]**

   - [Detail 1]
   - [Detail 2]

4. **[Responsibility 4]**

   - [Detail 1]
   - [Detail 2]

5. **[Responsibility 5]**

   - [Detail 1]
   - [Detail 2]

6. **[Responsibility 6]**
   - [Detail 1]
   - [Detail 2]

---

## 3. Boundaries of a [Component]

### MUST NOT DO:

1. **❌ [Prohibited Action 1]**

   - [Explanation]
   - [Why this is prohibited]

2. **❌ [Prohibited Action 2]**

   - [Explanation]
   - [Why this is prohibited]

3. **❌ [Prohibited Action 3]**

   - [Explanation]
   - [Why this is prohibited]

4. **❌ [Prohibited Action 4]**

   - [Explanation]
   - [Why this is prohibited]

5. **❌ [Prohibited Action 5]**

   - [Explanation]
   - [Why this is prohibited]

6. **❌ [Prohibited Action 6]**

   - [Explanation]
   - [Why this is prohibited]

7. **❌ [Prohibited Action 7]**
   - [Explanation]
   - [Why this is prohibited]

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                         │
│  - [How this layer interacts with component]                │
│  - [What it does/doesn't do]                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER                           │
│  - [How this layer interacts with component]                │
│  - [What it does/doesn't do]                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                            │
│  ┌───────────────────────────────────────────────────┐      │
│  │         [COMPONENT NAME] (You are here)           │      │
│  │  - [What this component contains]                 │      │
│  │  - [What it encapsulates]                         │      │
│  │  - [What it provides]                             │      │
│  │  - [Used by: ...]                                 │      │
│  └───────────────────────────────────────────────────┘      │
│         ▲                          ▲                        │
│         │                          │                        │
│  ┌──────┴──────┐           ┌───────┴──────┐                 │
│  │  [Related]  │           │  [Related]   │                 │
│  │  [Component]│           │  [Component] │                 │
│  └─────────────┘           └──────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                       │
│  - [How this layer interacts with component]                │
│  - [What it does/doesn't do]                                │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rules:

✅ **[Component] CAN depend on:**

- [Dependency 1]
- [Dependency 2]
- [Dependency 3]

❌ **[Component] CANNOT depend on:**

- [Prohibited Dependency 1]
- [Prohibited Dependency 2]
- [Prohibited Dependency 3]

---

## 5. [Component] Lifetime & Lifecycle

### Creation Flow:

```typescript
// 1. [Step 1 description]
const [variable1] = [value];

// 2. [Step 2 description]
const [variable2]Result = [Component].create([params]);

// 3. [Step 3 description]
if ([variable2]Result.isFailure) {
  // Handle validation error
  return Result.fail([variable2]Result.error);
}

// 4. [Step 4 description]
const [variable2] = [variable2]Result.value;

// 5. [Step 5 description]
const [operation] = [variable2].[method]();

// 6. [Step 6 description if applicable]
```

### Lifecycle Characteristics:

1. **[Characteristic 1]**: [Description]
2. **[Characteristic 2]**: [Description]
3. **[Characteristic 3]**: [Description]
4. **[Characteristic 4]**: [Description]
5. **[Characteristic 5]**: [Description]

---

## 6. [Component] Structure Template

### Base Class Pattern (if applicable)

**[Description of base class and its purpose]**

**Base [Component] class** (src/[layer]/core/[Component].ts):

```typescript
import { [PropsType] } from '../shared/props/[PropsType]';

export abstract class [Component]<T extends [PropsType]> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props); // [Explanation if needed]
  }

  // [Base methods if any]
}
```

### Simple [Component] Template:

```typescript
import { [Component], Result, Guard } from '../';

/**
 * [Component description].
 *
 * Business Rules:
 * - [Rule 1]
 * - [Rule 2]
 * - [Rule 3]
 *
 * @example
 * const result = [Component].create([params]);
 * if (result.isSuccess) {
 *   const [instance] = result.value;
 *   console.log([instance].[method]());
 * }
 */

interface [Component]Props {
  [property1]: [type];
  [property2]: [type];
}

export class [ComponentName] extends [BaseClass]<[Component]Props> {
  /**
   * Public getter for [property].
   */
  get [property1](): [type] {
    return this.props.[property1];
  }

  /**
   * Private constructor enforces factory method usage.
   * Guarantees all instances are valid.
   */
  private constructor(props: [Component]Props) {
    super(props);
  }

  /**
   * Factory method for creating a [Component].
   *
   * @param [param] - [Description]
   * @returns Result<[Component]> - Success with valid instance or failure with error
   * [Optional @throws if component throws exceptions for infrastructure failures]
   */
  public static create([param]: [type]): Result<[ComponentName]> {
    // Guard clauses for null/undefined/type checking
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined([param], '[param name]'),
      Guard.[validationType]([param], '[param name]')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<[ComponentName]>(guardResult.message!);
    }

    // Business rule validation
    if (![validation condition]) {
      return Result.fail<[ComponentName]>(
        '[Error message]'
      );
    }

    return Result.ok<[ComponentName]>(
      new [ComponentName]({ [property]: [value] })
    );
  }

  /**
   * [Method description].
   */
  public [methodName]([params]): [ReturnType] {
    // [Implementation]
  }

  /**
   * String representation for logging, debugging, and serialization.
   */
  public toString(): string {
    return this.props.[property];
  }
}
```

### Complex [Component] Template:

```typescript
import { [Component], Result, Guard } from '../';

interface [Component]Props {
  [property1]: [type];
  [property2]: [type];
  [property3]: [type];
}

/**
 * [Component description with more complexity].
 *
 * Business Rules:
 * - [Rule 1]
 * - [Rule 2]
 * - [Rule 3]
 */
export class [ComponentName] extends [BaseClass]<[Component]Props> {
  // Constants for business rules
  public static readonly [CONSTANT_NAME] = [value];

  get [property1](): [type] {
    return this.props.[property1];
  }

  get [property2](): [type] {
    return this.props.[property2];
  }

  private constructor(props: [Component]Props) {
    super(props);
  }

  public static create(props: [Component]Props): Result<[ComponentName]> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        props.[property1],
        '[property1]'
      ),
      Guard.[validationType](
        props.[property2],
        '[property2]'
      ),
      Guard.[rangeValidation](
        props.[property3],
        [min],
        [max],
        '[property3]'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<[ComponentName]>(guardResult.message!);
    }

    // Additional business validation
    if (![business condition]) {
      return Result.fail<[ComponentName]>('[Error message]');
    }

    return Result.ok<[ComponentName]>(
      new [ComponentName](props)
    );
  }

  /**
   * [Domain operation description].
   */
  public [domainOperation]([params]): [ReturnType] {
    // [Implementation]
  }

  public toString(): string {
    return `[format string with props]`;
  }
}
```

---

## 7. Orthogonality Principles

### 1. [Principle Name]

[Explanation of the principle]

```typescript
// ✅ GOOD - [Explanation]
[Good example code]

// ❌ BAD - [Explanation]
[Bad example code]
```

### 2. [Principle Name]

[Explanation of the principle]

```typescript
// ✅ GOOD - [Explanation]
[Good example code]

// ❌ BAD - [Explanation]
[Bad example code]
```

### 3. [Principle Name]

[Explanation of the principle]

```typescript
// ✅ GOOD - [Explanation]
[Good example code]

// ❌ BAD - [Explanation]
[Bad example code]
```

### Stability Under Change

Good [components] remain stable when:

- [Change scenario 1]
- [Change scenario 2]
- [Change scenario 3]
- [Change scenario 4]

---

## 8. Naming Conventions

### Class Names:

**Pattern:** `[NamingPattern]`

```typescript
// ✅ GOOD
export class [Example1] {}
export class [Example2] {}
export class [Example3] {}

// ❌ BAD
export class [BadExample1] {} // [Reason why it's bad]
export class [BadExample2] {} // [Reason why it's bad]
export class [BadExample3] {} // [Reason why it's bad]
```

### Property Names:

```typescript
interface [Component]Props {
  // ✅ GOOD naming
  [goodProperty1]: [type];
  [goodProperty2]: [type];

  // ❌ BAD naming
  // [badProperty]: [type]; // [Reason]
}
```

### Method Names:

```typescript
class [Component] {
  // ✅ [Type of methods]: [naming convention]
  public static create([params]): Result<[Component]>;
  public [actionMethod]([params]): Result<[ReturnType]>;

  // ✅ [Type of methods]: [naming convention]
  public [queryMethod](): [ReturnType];
  public is[Condition](): boolean;

  // ✅ [Type of methods]: [naming convention]
  public toString(): string;
  public to[Format](): [ReturnType];
}
```

### File Names:

**Pattern:** `[NamingPattern].ts`

```
✅ GOOD
src/[layer]/[category]/[ComponentName].ts
src/[layer]/[category]/[ComponentName2].ts

❌ BAD
src/[layer]/[category]/[bad-naming].ts // [Reason]
src/[layer]/[Component].ts // [Reason]
```

---

## 9. Error Handling Patterns

### Pattern 1: [Error Pattern Name]

[Description of when to use this pattern]

```typescript
class [Component] {
  public static create([params]): Result<[Component]> {
    if ([error condition]) {
      return Result.fail<[Component]>('[Error message]');
    }
    if ([another error condition]) {
      return Result.fail<[Component]>('[Error message]');
    }
    return Result.ok<[Component]>(new [Component]([params]));
  }
}

// Usage
const result = [Component].create([params]);
if (result.isFailure) {
  console.error(result.error);
  return;
}
const [instance] = result.value;
```

### Pattern 2: [Error Pattern Name]

[Description of when to use this pattern]

```typescript
// ✅ GOOD - [Explanation]
[Good example showing proper error handling]

// ❌ BAD - [Explanation]
[Bad example showing improper error handling]
```

### Pattern 3: [Error Pattern Name]

[Description of when to use this pattern]

```typescript
// ✅ GOOD - [Explanation]
[Good example]

// ❌ BAD - [Explanation]
[Bad example]
```

### Error Handling Strategy:

**For [Component] implementations:**

#### Business/Domain Errors (Return `Result.fail()`)

These are **expected** errors that are part of normal business operations:

- [Error type 1]
- [Error type 2]
- [Error type 3]

```typescript
// Example
if ([business constraint violation]) {
  return Result.fail('[Descriptive error message]');
}
```

#### Infrastructure Errors (Throw Exceptions)

These are **unexpected** system-level failures (if applicable to this component):

- [Infrastructure error 1]
- [Infrastructure error 2]
- [Infrastructure error 3]

```typescript
// Example (if applicable)
try {
  // [Infrastructure operation]
} catch (error) {
  throw new InfrastructureException('[Error context]', error);
}
```

---

## 10. Testing Strategy

### Test Structure:

```typescript
import { [Component] } from '@/[layer]/[category]/[Component]';

describe('[Component]', () => {
  describe('create', () => {
    describe('when valid [scenario]', () => {
      it('should create [Component] successfully', () => {
        const result = [Component].create([validParams]);

        expect(result.isSuccess).toBe(true);
        expect(result.value.[property]).toBe([expectedValue]);
      });

      it('should handle edge case [scenario]', () => {
        // [Edge case test]
      });
    });

    describe('when invalid [scenario]', () => {
      it('should fail for null or undefined', () => {
        expect([Component].create(null as any).isFailure).toBe(true);
        expect([Component].create(undefined as any).isFailure).toBe(
          true
        );
      });

      it('should fail for [invalid condition]', () => {
        const result = [Component].create([invalidParams]);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('[expected error text]');
      });

      it('should fail for [business rule violation]', () => {
        // [Business rule test]
      });
    });
  });

  describe('[domain operations]', () => {
    it('should [perform operation correctly]', () => {
      const [instance] = [Component].create([params]).value;
      const result = [instance].[operation]([params]);

      expect(result).toBe([expectedResult]);
    });

    it('should [handle edge case in operation]', () => {
      // [Edge case test]
    });
  });

  describe('[equality or comparison if applicable]', () => {
    it('should return true for [equal condition]', () => {
      // [Equality test]
    });

    it('should return false for [different condition]', () => {
      // [Inequality test]
    });
  });

  describe('[immutability if applicable]', () => {
    it('should not allow mutation of props', () => {
      // [Immutability test]
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

2. **Operation Tests**:

   - All public methods
   - Edge cases for calculations
   - Error scenarios for fallible operations

3. **[Additional Test Category if applicable]**:
   - [Test type 1]
   - [Test type 2]

---

## 11. Examples

### Example 1: [Simple Example Name]

```typescript
import { [Component], Result, Guard } from '../';

/**
 * [Component description].
 *
 * Business Rules:
 * - [Rule 1]
 * - [Rule 2]
 *
 * @example
 * const result = [Component].create([params]);
 * if (result.isSuccess) {
 *   console.log(result.value.[method]());
 * }
 */

interface [Component]Props {
  [property]: [type];
}

export class [ComponentName] extends [BaseClass]<[Component]Props> {
  private constructor(props: [Component]Props) {
    super(props);
  }

  get [property](): [type] {
    return this.props.[property];
  }

  public static create([param]: [type]): Result<[ComponentName]> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined([param], '[param]'),
      Guard.[validation]([param], '[param]')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<[ComponentName]>(guardResult.message!);
    }

    // Business validation
    if (![condition]) {
      return Result.fail<[ComponentName]>('[Error message]');
    }

    return Result.ok<[ComponentName]>(
      new [ComponentName]({ [property]: [param] })
    );
  }

  /**
   * [Domain operation description].
   */
  public [operation](): [ReturnType] {
    // [Implementation]
  }

  public toString(): string {
    return this.props.[property];
  }
}
```

### Example 2: [Complex Example Name]

```typescript
// [More complex example with multiple properties, operations, etc.]
```

### Example 3: [Composite Example Name if applicable]

```typescript
// [Example showing composition or relationships with other components]
```

---

## Summary Checklist

When creating a [Component], ensure:

**Structure:**

- [ ] [Structural requirement 1]
- [ ] [Structural requirement 2]
- [ ] [Structural requirement 3]

**Responsibilities:**

- [ ] [Responsibility requirement 1]
- [ ] [Responsibility requirement 2]
- [ ] [Responsibility requirement 3]

**Boundaries:**

- [ ] [Boundary requirement 1]
- [ ] [Boundary requirement 2]
- [ ] [Boundary requirement 3]

**Error Handling:**

- [ ] Returns `Result<T>` from factory methods
- [ ] Provides clear, specific error messages
- [ ] [Error handling requirement 3]

**Testing:**

- [ ] Has comprehensive unit tests
- [ ] Tests cover all creation scenarios
- [ ] Tests cover all domain operations
- [ ] [Testing requirement 4]

**Code Quality:**

- [ ] Follows naming conventions
- [ ] Has proper JSDoc comments
- [ ] [Code quality requirement 3]
- [ ] [Code quality requirement 4]

**Orthogonality:**

- [ ] [Orthogonality requirement 1]
- [ ] [Orthogonality requirement 2]
- [ ] [Orthogonality requirement 3]

---

**Remember**: [Key takeaway message about this component and its role in DDD]
