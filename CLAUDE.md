# Network Management System — Backend

Node.js/TypeScript, Clean Architecture + DDD, Prisma + PostgreSQL, Express, Jest.

## Architecture

```
presentation → application → domain ← infrastructure
```

Inner layers never import from outer. No framework dependencies in domain.

## Bounded Contexts

| Context             | Domain                       | Application                       |
| ------------------- | ---------------------------- | --------------------------------- |
| Device Inventory    | `domain/device-inventory`    | `application/device-inventory`    |
| Device Monitoring   | `domain/device-monitoring`   | `application/device-monitoring`   |
| Wireless Monitoring | `domain/wireless-monitoring` | `application/wireless-monitoring` |
| Notifications       | `domain/notifications`       | `application/notifications`       |

**Shared kernel**: `domain/shared/` — `core/` (AggregateRoot, Entity, ValueObject, Result, Guard, DomainEvent), `ids/`, `value-objects/` (IPAddress), `utils/`.

## Key Rules

- **Result pattern** for all expected failures — never throw for business rule violations
- **Guard pattern** for null/type checks at aggregate boundaries
- `static create(props): Result<T>` — validates; `static reconstitute(id, props): T` — bypasses validation, for repositories only
- Repository interfaces in `domain/<context>/repository/`, implementations in `infrastructure/`
- DI wired in `src/infrastructure/di/container.ts`
- Mappers have three directions: `toDomain()`, `toPersistence()`, `toDTO()`

## Testing

Tests mirror `src/` under `tests/`. File extension: `*.test.ts`.

- `npm test` — unit tests
- `npm run test:integration` — real DB, no Prisma mocks

Style: `describe/it` blocks, fixture helpers (`makeDevice()`, `makeProps()`), `clearEvents()` before asserting specific events, `reconstitute()` to bypass invariants in command tests.

## Naming

| Thing                 | Example                                       |
| --------------------- | --------------------------------------------- |
| Repository interfaces | `IDeviceRepository` (`I` prefix)              |
| Events                | `DeviceCreatedEvent` (past tense)             |
| DTOs                  | `CreateDeviceRequestDTO`, `DeviceResponseDTO` |
| Use Cases             | `CreateDeviceUseCase`                         |
| Routes files          | `wireless.routes.ts` (kebab-case)             |

## Code Style

No comments unless the WHY is non-obvious. No docstrings. No `console.log` (use Winston). Prettier: single quotes, no trailing commas, 80-char width, 2-space indent.
