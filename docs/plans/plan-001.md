Device-Monitoring V1: Ping-Based Up/Down Detection

Context

Implement the initial version of the device-monitoring bounded context — checking whether a
device is reachable via ICMP ping. A substantial amount of domain/application code already exists
but is broken because it references the legacy NetworkDevice aggregate and
INetworkDeviceRepository. The fix is to:

1.  Enrich device-inventory events so they carry everything monitoring needs (IP address,
    monitoringEnabled flag) — enabling full decoupling via shared IDs + events.
2.  Reform the existing monitoring application-layer code to use those events and its own
    persistence ports instead of reaching into device-inventory.
3.  Create the missing infrastructure (PingService, repositories, orchestrator, HTTP layer).

Prisma schema already has all needed tables: PollingConfiguration, DeviceState, PingResult,
AlertEvent. One Prisma migration is needed: add ipAddress to PollingConfiguration.

---

Phase 1 — Enrich Events (Cross-Context Bridge)

The monitoring context must never call into device-inventory repositories. All it needs is
deviceId + ipAddress — delivered by events.

1.1 Update DeviceCreatedEventProps

File: src/domain/device-inventory/props/DeviceCreatedEventProps.ts

- Add readonly monitoringEnabled: boolean
- Add readonly ipAddress: string | null

  1.2 Update DeviceCreatedEvent

File: src/domain/device-inventory/events/DeviceCreatedEvent.ts

- Add get monitoringEnabled(): boolean
- Add get ipAddress(): string | null

  1.3 Update DeviceMonitoringToggledEventProps

File: src/domain/device-inventory/props/DeviceMonitoringToggledEventProps.ts

- Add readonly ipAddress: string | null

  1.4 Update DeviceMonitoringToggledEvent

File: src/domain/device-inventory/events/DeviceMonitoringToggledEvent.ts

- Add get ipAddress(): string | null

  1.5 Update Device aggregate event emissions

File: src/domain/device-inventory/aggregates/Device.ts

- In Device.create(): pass monitoringEnabled and ipAddress?.value ?? null to DeviceCreatedEvent
- In Device.enableMonitoring() / Device.disableMonitoring(): pass this.props.ipAddress?.value ?? null to
  DeviceMonitoringToggledEvent

---

Phase 2 — Domain Ports (Monitoring-Owned Repositories)

Files to create in src/domain/device-monitoring/repository/:

IPollingConfigurationRepository.ts

findByDeviceId(deviceId: string): Promise<Result<PollingConfigRecord | null>>
findAllDue(now: Date): Promise<Result<PollingConfigRecord[]>>
create(record: CreatePollingConfigInput): Promise<Result<void>>
updateIpAddress(deviceId: string, ipAddress: string): Promise<Result<void>>
setEnabled(deviceId: string, enabled: boolean): Promise<Result<void>>
delete(deviceId: string): Promise<Result<void>>
PollingConfigRecord = plain object { id, deviceId, ipAddress: string | null, pingIntervalSecs,
failuresBeforeDown, enabled?, createdAt, updatedAt }.
Note: Current Prisma PollingConfiguration has no enabled flag. For V1, treat
monitoringEnabled on the Device as the source of truth (stored in PollingConfiguration
after event). Add an enabled boolean column to the Prisma model in the migration.

IPingResultRepository.ts

save(record: CreatePingResultInput): Promise<Result<void>>
findLatestByDevice(deviceId: string, limit: number): Promise<Result<PingResultRecord[]>>

IDeviceStateRepository.ts

findByDeviceId(deviceId: string): Promise<Result<DeviceStateRecord | null>>
upsert(record: DeviceStateUpsertInput): Promise<Result<DeviceStateRecord>>

---

Phase 3 — PrismaSchema Migration

File: prisma/schema.prisma

Add to PollingConfiguration:
ipAddress String? @map("ip_address") @db.VarChar(45)
enabled Boolean @default(true)

Then run prisma migrate dev --name add_ip_enabled_to_polling_config.

---

Phase 4 — PingService (Infrastructure Adapter)

4.1 Port interface

Create: src/application/device-monitoring/interfaces/IPingService.ts
interface PingResponse { isReachable: boolean; latencyMs: number | null; }
interface IPingService {
ping(ipAddress: string, timeoutMs?: number): Promise<Result<PingResponse>>;
}
Replace (rename) the existing IDevicePoller.ts or keep both — IDevicePoller stays for
future SNMP; IPingService is V1.

4.2 Implementation

Create: src/infrastructure/monitoring/ping/PingService.ts

- Import ping from 'ping' (already in package.json)
- Port executeSinglePing() logic from src/infrastructure/legacy/polling/IcmpDevicePoller.ts
- timeoutMs defaults to 5000; convert to seconds for the ping package (timeout: timeoutMs / 1000)
- Returns Result.ok({ isReachable: alive, latencyMs: alive ? parseFloat(time) : null })
- On ping package exception → Result.fail(error.message)

---

Phase 5 — Reform Application Use Cases

5.1 ExecutePollingCycleUseCase → reform

File: src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.ts

Remove:

- INetworkDeviceRepository, NetworkDeviceId, NetworkDeviceStatus, IDevicePoller, PollingMetrics

Inject instead:

- IPollingConfigurationRepository, IPingResultRepository, IDeviceStateRepository, IPingService

New flow:

1.  Validate UUID
2.  pollingConfigRepo.findByDeviceId(deviceId) → fail if not found or not enabled (unless forceExecution)
3.  pingService.ping(config.ipAddress)
4.  pingResultRepo.save({ deviceId, isReachable, latencyMs, checkedAt: now })
5.  Load current DeviceState; compute new consecutiveFailures and isOnline

- success → isOnline=true, reset consecutiveFailures=0
- failure → consecutiveFailures++; if >= config.failuresBeforeDown → isOnline=false

6.  deviceStateRepo.upsert(newState)
7.  Return SingleDevicePollingResultDTO (status: SUCCESS/FAILED/SKIPPED)

V1 drops the multi-ping retry loop. Single ping per call. Retry policy lives in Phase 6.

5.2 ConfigureDevicePollingUseCase → reform

File: src/application/device-monitoring/use-cases/ConfigureDevicePollingUseCase.ts

- Replace INetworkDeviceRepository with IPollingConfigurationRepository
- Use pollingConfigRepo.findByDeviceId() + setEnabled() / direct update

  5.3 GetDevicePollingStatusUseCase → reform

File: src/application/device-monitoring/use-cases/GetDevicePollingStatusUseCase.ts

- Replace NetworkDevice repo with IPollingConfigurationRepository + IDeviceStateRepository +
  IPingResultRepository

  5.4 GetDevicePollingHistoryUseCase → reform

File: src/application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase.ts

- Replace NetworkDevice repo with IPingResultRepository

  5.5 Unlock DTO barrel

File: src/application/device-monitoring/dtos/index.ts

- Uncomment all exports (they were commented out entirely)

---

Phase 6 — Event Handlers (Automatic PollingConfig Lifecycle)

Create in src/application/device-monitoring/event-handlers/:

DeviceProvisionedHandler.ts

Implements IHandle<DeviceCreatedEvent>

- If event.monitoringEnabled && event.ipAddress:
  → pollingConfigRepo.create({ deviceId: event.aggregateId.toString(), ipAddress, enabled: true, pingIntervalSecs:
  60, failuresBeforeDown: 3 })
- Else: no-op (device created without monitoring or IP)

DeviceMonitoringToggledHandler.ts

Implements IHandle<DeviceMonitoringToggledEvent>

- If event.monitoringEnabled:
  → pollingConfigRepo.create(...) or setEnabled(deviceId, true) + update ipAddress
- Else:
  → pollingConfigRepo.setEnabled(deviceId, false)

When IP changes (DeviceDetailsUpdatedEvent), a future DeviceIPChangedHandler can call
pollingConfigRepo.updateIpAddress(...). Out of scope for V1.

---

Phase 7 — Infrastructure Persistence

Create in src/infrastructure/persistence/:

PrismaPollingConfigurationRepository.ts

Implements IPollingConfigurationRepository

- findAllDue(now): query where enabled=true AND (DeviceState.lastCheckedAt IS NULL OR lastCheckedAt +
  interval_seconds \* interval '1 second' <= now) — via raw SQL or Prisma's $queryRaw

PrismaPingResultRepository.ts

Implements IPingResultRepository

PrismaDeviceStateRepository.ts

Implements IDeviceStateRepository

- Uses Prisma upsert on deviceId

Update: src/infrastructure/persistence/index.ts — add the three new exports.

---

Phase 8 — PollingOrchestrator (Infrastructure)

Create: src/infrastructure/monitoring/orchestrator/PollingOrchestrator.ts

- Config: checkIntervalMs (default 10_000), maxConcurrentPolls (default 10)
- start(): calls pollDevices() immediately, then on setInterval
- stop(): clears interval, waits for active polls
- pollDevices():
  a. pollingConfigRepo.findAllDue(now) → get batch of devices
  b. Chunk into groups of maxConcurrentPolls
  c. For each: call executePollingCycleUseCase.execute({ deviceId, forceExecution: false })
- Reuse scheduling logic from src/infrastructure/legacy/polling/PollingScheduler.ts for
  start/stop/concurrency pattern.

---

Phase 9 — HTTP Presentation Layer

PollingController.ts

Create: src/presentation/http/controllers/PollingController.ts

- POST /api/devices/:id/poll → executePollingCycleUseCase.execute({ deviceId: req.params.id, forceExecution: true
  })
- GET /api/devices/:id/polling/status → getDevicePollingStatusUseCase
- GET /api/devices/:id/polling/history → getDevicePollingHistoryUseCase
- PATCH /api/devices/:id/polling/config → configureDevicePollingUseCase

polling.routes.ts

Create: src/presentation/http/routes/polling.routes.ts
Follow pattern from src/presentation/http/routes/device.routes.ts.

polling.schemas.ts

Create: src/presentation/http/validation/polling.schemas.ts

- pollDeviceSchema: params: { id: z.string().uuid() }
- configurePollingSchema: params: { id: uuid }, body: { intervalSeconds?: number, failuresBeforeDown?: number,
  enabled?: boolean }
- pingHistoryQuerySchema: params: { id: uuid }, query: { limit?, offset?, fromDate?, toDate? }

---

Phase 10 — Wire DI + Bootstrap

container.ts

Modify: src/infrastructure/di/container.ts

Add:
// Repositories
this.pollingConfigRepo = new PrismaPollingConfigurationRepository(this.prisma);
this.pingResultRepo = new PrismaPingResultRepository(this.prisma);
this.deviceStateRepo = new PrismaDeviceStateRepository(this.prisma);

// Use cases
const executePollingCycle = new ExecutePollingCycleUseCase(
this.pollingConfigRepo, this.pingResultRepo, this.deviceStateRepo,
this.pingService, this.logger
);
...

// Event handlers — register ONCE at startup
EventDispatcher.register(DeviceCreatedEvent.name, new DeviceProvisionedHandler(this.pollingConfigRepo));
EventDispatcher.register(DeviceMonitoringToggledEvent.name, new
DeviceMonitoringToggledHandler(this.pollingConfigRepo));

// Orchestrator
this.pollingOrchestrator = new PollingOrchestrator(this.pollingConfigRepo, executePollingCycle);

main.ts

Modify: src/main.ts

- After container.connect(): container.pollingOrchestrator.start()
- In shutdown handler: await container.pollingOrchestrator.stop()

routes/index.ts

Modify: src/presentation/http/routes/index.ts

- apiRouter.use('/devices', createPollingRoutes(container.pollingController))
  (nested under /devices/:id/polling/\*)

---

Critical Files Summary

┌────────┬────────────────────────────────────────────────────────────────────────────────────┐
│ Action │ File │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/domain/device-inventory/props/DeviceCreatedEventProps.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/domain/device-inventory/events/DeviceCreatedEvent.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/domain/device-inventory/props/DeviceMonitoringToggledEventProps.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/domain/device-inventory/events/DeviceMonitoringToggledEvent.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/domain/device-inventory/aggregates/Device.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ prisma/schema.prisma │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/application/device-monitoring/use-cases/ConfigureDevicePollingUseCase.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/application/device-monitoring/use-cases/GetDevicePollingStatusUseCase.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/application/device-monitoring/dtos/index.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/infrastructure/di/container.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/infrastructure/persistence/index.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/presentation/http/routes/index.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Modify │ src/main.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/application/device-monitoring/interfaces/IPingService.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/application/device-monitoring/event-handlers/DeviceProvisionedHandler.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/application/device-monitoring/event-handlers/DeviceMonitoringToggledHandler.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/domain/device-monitoring/repository/IPollingConfigurationRepository.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/domain/device-monitoring/repository/IPingResultRepository.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/domain/device-monitoring/repository/IDeviceStateRepository.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/infrastructure/monitoring/ping/PingService.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/infrastructure/monitoring/orchestrator/PollingOrchestrator.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/infrastructure/persistence/PrismaPollingConfigurationRepository.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/infrastructure/persistence/PrismaPingResultRepository.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/infrastructure/persistence/PrismaDeviceStateRepository.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/presentation/http/controllers/PollingController.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/presentation/http/routes/polling.routes.ts │
├────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ Create │ src/presentation/http/validation/polling.schemas.ts │
└────────┴────────────────────────────────────────────────────────────────────────────────────┘

---

Verification

1.  Compile: tsc --noEmit — zero errors
2.  Prisma migration: prisma migrate dev --name add_ip_enabled_to_polling_config
3.  Manual poll test:

- Create device with monitoringEnabled: true and valid IP → PollingConfig auto-created (event handler)
- POST /api/devices/:id/poll → returns { status: "SUCCESS" | "FAILED" }
- GET /api/devices/:id/polling/status → shows isOnline, consecutiveFailures, lastCheckedAt

4.  Orchestrator test: Start app → confirm logs show polling cycles every 10s
5.  Unit tests: Add tests for ExecutePollingCycleUseCase, DeviceProvisionedHandler,
    DeviceMonitoringToggledHandler, PingService (mock ping package)
    ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
