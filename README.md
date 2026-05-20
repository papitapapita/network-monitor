# Network Management System — Backend

REST API backend for monitoring and managing network devices. Built with Node.js/TypeScript, Clean Architecture + DDD, Express, Prisma, and PostgreSQL.

## Tech Stack

- **Runtime:** Node.js 24, TypeScript
- **Framework:** Express 5
- **ORM:** Prisma 7 + PostgreSQL (via `pg` adapter)
- **Architecture:** Clean Architecture + Domain-Driven Design
- **Logging:** Winston
- **Testing:** Jest (unit), Supertest (integration)

## Bounded Contexts

| Context             | Responsibility                                            |
| ------------------- | --------------------------------------------------------- |
| Device Inventory    | CRUD for devices, models, vendors, locations, credentials |
| Device Monitoring   | ICMP polling, online/offline state, polling configuration |
| Wireless Monitoring | SNMP/HTTP polling for Ubiquiti AirOS access points        |
| Notifications       | Telegram alerts for device up/down events                 |

## Getting Started

### Prerequisites

- Node.js 24+
- PostgreSQL instance

### Installation

```sh
npm install
```

### Environment Variables

Create a `.env` file:

```ini
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=nms
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
DIRECT_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Device credentials encryption — 32-byte AES-256-GCM key (hex)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DEVICE_CREDENTIALS_KEY=

# Telegram notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### Database

```sh
# Run migrations
npm run db:migrate:dev

# Seed initial data
npm run db:seed
```

### Running

```sh
# Development (watch mode)
npm run dev

# Production build
npm run build
npm start
```

## Testing

```sh
# Unit tests
npm test

# Integration tests (requires a running PostgreSQL instance)
npm run test:integration
```

## API Routes

| Method   | Path                       | Description                    |
| -------- | -------------------------- | ------------------------------ |
| `GET`    | `/devices`                 | List devices                   |
| `POST`   | `/devices`                 | Create device                  |
| `GET`    | `/devices/:id/credentials` | Get device credentials         |
| `PUT`    | `/devices/:id/credentials` | Set device credentials         |
| `DELETE` | `/devices/:id/credentials` | Delete device credentials      |
| `GET`    | `/device-models`           | List device models             |
| `POST`   | `/device-models`           | Create device model            |
| `GET`    | `/vendors`                 | List vendors                   |
| `POST`   | `/vendors`                 | Create vendor                  |
| `GET`    | `/locations`               | List locations                 |
| `POST`   | `/locations`               | Create location                |
| `POST`   | `/scan`                    | Scan a network segment         |
| `POST`   | `/polling`                 | Configure device polling       |
| `GET`    | `/wireless`                | Wireless polling configuration |
| `POST`   | `/alerts`                  | Trigger manual alert           |

Full API documentation is in `docs/BACKEND_API.md`.

## Project Structure

```
src/
├── domain/               # Entities, value objects, domain events, repo interfaces
├── application/          # Use cases, DTOs, mappers, event handlers
├── infrastructure/       # Prisma repos, SNMP/HTTP collectors, DI container
└── presentation/
    ├── http/             # Express routes, controllers, middleware, validation
    └── websocket/        # WebSocket gateway
```
