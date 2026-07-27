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

- `npm test` — unit tests (never touches a database)
- `npm run test:integration` — real DB, no Prisma mocks

Style: `describe/it` blocks, fixture helpers (`makeDevice()`, `makeProps()`), `clearEvents()` before asserting specific events, `reconstitute()` to bypass invariants in command tests.

### Integration tests

Two layers, split by what can break — full rules in `docs/rules/TESTING-INTEGRATION-STANDARD.md`.

- **Route tests** (`tests/integration/<resource>.routes.test.ts`) — the whole picture. One per route file, always. Supertest through the real container: status codes, auth (`401`), RBAC (`403`), validation (`400`), response envelope. **Every request needs a Bearer token** — all `/api` routes sit behind `createAuthenticateMiddleware`.
- **Use case tests** (`tests/integration/use-cases/<context>/<Name>.integration.test.ts`) — specific features. **One per use case, no exceptions** — coverage stays a `find` command, not a judgment call. Depth scales with the use case: DB-state rules (uniqueness, cascade), state machines, events another handler persists, non-trivial queries, and use cases with **no HTTP surface** (purge jobs, orchestrators — nothing else covers these) get thorough suites; thin pass-throughs get happy path + not-found + malformed id.

Fixtures live in `tests/integration/helpers/`: `clean*` (FK-safe deletes), `seed*` (returns the id), `Fake*` (outbound ports — never hit the network). Extension is `.test.ts`; `.spec.ts` is silently skipped.

The test DB (`network_monitor_test` from `.env.test`) is separate from dev — `prisma migrate dev` does not migrate it. Uniform `column ... does not exist` failures across unrelated contexts mean drift: `set -a; . ./.env.test; set +a; npx prisma migrate deploy`.

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
