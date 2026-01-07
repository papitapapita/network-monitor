# How to Use the Component Standard Template

This guide explains how to use `TEMPLATE-COMPONENT-STANDARD.md` to create new standard documentation for any component in the system.

---

## Quick Start

1. **Copy the template**:
   ```bash
   cp docs/rules/TEMPLATE-COMPONENT-STANDARD.md docs/rules/[NEW-STANDARD-NAME].md
   ```

2. **Replace all placeholders** (see sections below)

3. **Fill in component-specific details**

4. **Review against existing standards** for consistency

5. **Commit with descriptive message**

---

## Placeholder Reference Guide

### Title Placeholders

| Placeholder         | Replace With                           | Example                           |
| ------------------- | -------------------------------------- | --------------------------------- |
| `[LAYER]`           | Architecture layer                     | `INFRASTRUCTURE`, `DOMAIN`, `APPLICATION` |
| `[COMPONENT NAME]`  | Component type                         | `REPOSITORY IMPLEMENTATIONS`, `MAPPERS` |

**Example:**
```markdown
# DOMAIN VALUE OBJECTS STANDARD
# INFRASTRUCTURE REPOSITORY IMPLEMENTATIONS STANDARD
# APPLICATION MAPPERS STANDARD
```

---

### Section 1: Purpose

| Placeholder           | Replace With                              | Example                                  |
| --------------------- | ----------------------------------------- | ---------------------------------------- |
| `[Component]`         | Component name (title case)               | `Repository Implementation`, `Mapper`    |
| `[component]`         | Component name (lowercase)                | `repository implementation`, `mapper`    |
| `[Characteristic N]`  | Key characteristic name                   | `Immutable`, `Stateless`, `Pure Translation` |
| `[Reason N]`          | Why this component is important           | `Type Safety`, `Testability`             |
| `[Related Component]` | Component to compare against              | `Entity`, `Repository Interface`         |

**Tips:**
- Core Characteristics: 3-5 defining traits
- Why section: 4-6 compelling reasons
- Comparison table: Highlight key differences with related concepts

---

### Section 2: Responsibilities

| Placeholder           | Replace With                        | Example                                    |
| --------------------- | ----------------------------------- | ------------------------------------------ |
| `[Responsibility N]`  | What component MUST do              | `Validate its own invariants`              |
| `[Detail]`            | Specific sub-responsibility         | `All business rules for that value`        |

**Tips:**
- List 4-8 main responsibilities
- Each responsibility should have 2-4 details
- Use action verbs: "Validate", "Enforce", "Provide", "Maintain"

---

### Section 3: Boundaries

| Placeholder            | Replace With                       | Example                                     |
| ---------------------- | ---------------------------------- | ------------------------------------------- |
| `[Prohibited Action N]`| What component MUST NOT do         | `Have Identity`, `Be Mutable`               |

**Tips:**
- List 5-10 prohibited actions
- Explain WHY each action is prohibited
- Reference related sections if needed

---

### Section 4: Connections with Other Layers

Update the ASCII diagram to show:
- How each layer interacts with this component
- Dependencies (arrows pointing from dependent to dependency)
- Related components in the same layer

**Template structure:**
```
Presentation Layer
    ↓
Application Layer
    ↓
Domain Layer
    ← [COMPONENT HERE]
    ↑
Infrastructure Layer
```

---

### Section 5: Lifetime & Lifecycle

| Placeholder     | Replace With                          | Example                                   |
| --------------- | ------------------------------------- | ----------------------------------------- |
| `[variable]`    | Variable name in example              | `ipString`, `orderResult`                 |
| `[Component]`   | Component class name                  | `IPAddress`, `Order`                      |
| `[method]`      | Method name                           | `getSubnet`, `addItem`                    |

**Tips:**
- Show complete flow from creation to usage
- Include error handling in flow
- Highlight important lifecycle characteristics

---

### Section 6: Structure Template

| Placeholder        | Replace With                            | Example                                   |
| ------------------ | --------------------------------------- | ----------------------------------------- |
| `[Component]`      | Component class name                    | `NetworkDevice`, `Email`                  |
| `[ComponentName]`  | Specific instance name                  | `IPAddress`, `MACAddress`                 |
| `[BaseClass]`      | Base class to extend                    | `ValueObject`, `AggregateRoot`, `Entity`  |
| `[PropsType]`      | Props interface name                    | `IPAddressProps`, `NetworkDeviceProps`    |
| `[property]`       | Property name                           | `value`, `ipAddress`, `name`              |
| `[type]`           | TypeScript type                         | `string`, `number`, `IPAddress`           |
| `[param]`          | Parameter name                          | `email`, `ipAddress`, `amount`            |
| `[method]`         | Method name                             | `getDomain`, `isPrivate`, `add`           |
| `[ReturnType]`     | Return type                             | `Result<void>`, `string`, `boolean`       |

**Tips:**
- Provide 2-3 templates: Simple, Complex, Composite (if applicable)
- Include full JSDoc comments
- Show both base class and concrete implementation
- Include business rule validation examples

---

### Section 7: Orthogonality Principles

Structure each principle as:

1. **Principle Name**: [Brief description]
2. **Good Example**: Showing correct implementation
3. **Bad Example**: Showing violation with explanation

**Common principles to consider:**
- Single Responsibility
- Independence from external state
- Separation of concerns
- Stability under change

---

### Section 8: Naming Conventions

Provide patterns for:
- **Class names**: `PascalCase`, prefixes, suffixes
- **Property names**: `camelCase`, avoid prefixes
- **Method names**: Action verbs, query methods, conversion methods
- **File names**: Match class names, directory structure

**Show examples of:**
- ✅ Good names (3-5 examples)
- ❌ Bad names with reasons (3-5 examples)

---

### Section 9: Error Handling Patterns

**Include patterns for:**

1. **Factory Method Errors** (always use `Result<T>`)
   ```typescript
   public static create(): Result<Type> { ... }
   ```

2. **Domain Operation Errors** (use `Result<T>` for expected failures)
   ```typescript
   public operation(): Result<void> { ... }
   ```

3. **Infrastructure Errors** (throw exceptions for catastrophic failures - if applicable)
   ```typescript
   throw new InfrastructureException(...);
   ```

**Tips:**
- Show both good and bad examples
- Include usage examples
- Explain WHEN to use each pattern
- For infrastructure components, include dual error-handling strategy

---

### Section 10: Testing Strategy

**Structure:**
1. **Test Structure Template**: Complete test suite example
2. **Coverage Requirements**: What must be tested
3. **Common Test Patterns**: Repeated testing patterns

**Test categories to include:**
- Creation/Factory method tests
- Domain operation tests
- Error handling tests
- Edge case tests
- Immutability tests (if applicable)
- Equality tests (if applicable)

---

### Section 11: Examples

**Provide 2-4 examples:**

1. **Simple Example**: Minimal implementation
2. **Complex Example**: With multiple properties/operations
3. **Composite Example**: Showing relationships (if applicable)
4. **Real-world Example**: From actual system (if applicable)

**Each example should:**
- Be complete and runnable
- Include JSDoc comments
- Show business rules
- Demonstrate error handling
- Include usage example in JSDoc

---

### Section 12: Summary Checklist

**Organize checklist into categories:**
- Structure
- Responsibilities
- Boundaries
- Error Handling
- Testing
- Code Quality
- Orthogonality

**Tips:**
- Each item should be verifiable (yes/no)
- Group related items together
- Include 15-25 total items
- Refer to specific sections for details

---

## Complete Example: Creating "Repository Implementation Standard"

### Step 1: Copy and rename
```bash
cp TEMPLATE-COMPONENT-STANDARD.md INFRASTRUCTURE-REPOSITORY-IMPLEMENTATIONS-STANDARD.md
```

### Step 2: Update title
```markdown
# INFRASTRUCTURE REPOSITORY IMPLEMENTATIONS STANDARD
```

### Step 3: Update Table of Contents
Replace all `[Component]` with `Repository Implementation`:
```markdown
1. [Purpose of Repository Implementations in DDD](#1-purpose-of-repository-implementations-in-ddd)
2. [Responsibilities of a Repository Implementation](#2-responsibilities-of-a-repository-implementation)
```

### Step 4: Fill Section 1
```markdown
## 1. Purpose of Repository Implementations in DDD

**Repository Implementations are infrastructure components that provide concrete implementations of domain repository interfaces, handling persistence and data access.**

### Core Characteristics:

- **Implements Domain Interface**: Fulfills contract defined in domain layer
- **Infrastructure Concerns**: Handles database, ORM, caching, transactions
- **Mapper Integration**: Uses infrastructure mappers for domain ↔ persistence
- **Error Handling**: Distinguishes business vs infrastructure errors
- **Event Dispatching**: Triggers domain events after successful persistence
```

### Step 5: Continue filling all sections...

---

## Tips for Writing Great Standards

### 1. **Be Specific**
❌ Bad: "Component should be well-designed"
✅ Good: "Component must validate all business rules at creation time using Guard clauses"

### 2. **Show Code Examples**
Every rule should have at least one code example showing:
- ✅ Good implementation
- ❌ Bad implementation with explanation

### 3. **Explain the "Why"**
Don't just say what to do, explain why:
- What problem does this solve?
- What happens if we don't follow this?
- How does this support DDD principles?

### 4. **Use Consistent Language**
- MUST / MUST NOT for requirements
- SHOULD / SHOULD NOT for recommendations
- CAN / CANNOT for permissions
- ✅ for good examples
- ❌ for bad examples

### 5. **Reference Related Standards**
Link to related standards when discussing:
- Dependencies
- Related components
- Contrasting approaches

### 6. **Keep It DDD-Focused**
Every standard should reference:
- DDD principles (Ubiquitous Language, Bounded Contexts, etc.)
- Clean Architecture layers
- Separation of concerns
- Domain model protection

### 7. **Make It Actionable**
Include:
- Clear checklist at the end
- Runnable code examples
- Test examples
- Real-world scenarios

### 8. **Maintain Consistency**
Compare your standard with existing ones:
- Same structure
- Same terminology
- Same formatting
- Same level of detail

---

## Validation Checklist

Before finalizing a new standard, verify:

- [ ] All placeholders replaced with specific values
- [ ] All sections filled with relevant content
- [ ] At least 2 code examples per major concept
- [ ] Good (✅) and Bad (❌) examples for key patterns
- [ ] ASCII diagram updated for layer connections
- [ ] Error handling strategy clearly explained
- [ ] Test strategy includes concrete examples
- [ ] Summary checklist is comprehensive
- [ ] Consistent with existing standards (terminology, structure)
- [ ] No typos or formatting issues
- [ ] All code examples are syntactically correct
- [ ] References to other standards are accurate

---

## Existing Standards as Reference

Use these as examples of well-structured standards:

1. **DOMAIN-VALUE-OBJECTS-STANDARD.md**
   - Excellent lifecycle section
   - Great immutability examples
   - Comprehensive testing strategy

2. **DOMAIN-AGGREGATES-STANDARD.md**
   - Clear decision criteria section
   - Excellent "when to use" guidance
   - Good transaction boundary explanations

3. **DOMAIN-REPOSITORY-INTERFACES-STANDARD.md**
   - Great dual error-handling section
   - Excellent method patterns
   - Clear implementation guidance

4. **APPLICATION-MAPPER-STANDARD.md**
   - Strong orthogonality section
   - Clear anti-patterns
   - Great validation checklist

---

## Questions or Issues?

If you're unsure about:
- **Structure**: Follow existing standards as closely as possible
- **Terminology**: Check other standards for consistency
- **DDD concepts**: Reference official DDD resources (Eric Evans, Vaughn Vernon)
- **Code examples**: Base on actual implementation in the codebase

---

**Remember**: Standards evolve. When you find improvements, update existing standards and this template!
