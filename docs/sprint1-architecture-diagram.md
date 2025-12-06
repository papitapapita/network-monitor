# Sprint 1: Multi-Ping ICMP Polling System - Architecture Diagram

## System Architecture Overview (UML Component Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRESENTATION LAYER                                      │
│                              (Future: REST API / GraphQL)                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ HTTP Requests
                                          ↓
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  APPLICATION LAYER                                       │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              Use Cases (Orchestration)                          │    │
│  │                                                                                  │    │
│  │  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐   │    │
│  │  │ ConfigureDevicePollingUseCase    │  │ ExecutePollingCycleUseCase ⭐    │   │    │
│  │  │                                  │  │                                  │   │    │
│  │  │ • Updates polling config         │  │ • Core polling execution         │   │    │
│  │  │ • Sets interval (1s-24h)         │  │ • Executes multi-ping            │   │    │
│  │  │ • Sets ping count (1-10)         │  │ • Handles retries                │   │    │
│  │  │ • Enables/disables polling       │  │ • Updates device status          │   │    │
│  │  └──────────────────────────────────┘  │ • Persists results               │   │    │
│  │                                         └──────────────────────────────────┘   │    │
│  │  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐   │    │
│  │  │ GetDevicePollingStatusUseCase    │  │ GetDevicePollingHistoryUseCase   │   │    │
│  │  │                                  │  │                                  │   │    │
│  │  │ • Returns current status         │  │ • Returns time-series data       │   │    │
│  │  │ • Last poll metrics              │  │ • Pagination support             │   │    │
│  │  │ • Consecutive failures           │  │ • Status filtering               │   │    │
│  │  └──────────────────────────────────┘  └──────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                                    DTOs                                         │    │
│  │                                                                                  │    │
│  │  PollingMetricsDTO │ PollingResultDTO │ PollingCycleSummaryDTO │ ...           │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                                  Mappers                                        │    │
│  │                                                                                  │    │
│  │  PollingMapper.toPollingMetricsDTO(metrics: PollingMetrics)                    │    │
│  │  PollingMapper.toPollingResultDTO(result: PollingResult)                       │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                               Interfaces (Ports)                                │    │
│  │                                                                                  │    │
│  │  «interface» IDevicePoller        «interface» ILogger                          │    │
│  │  «interface» IUseCase              «interface» INetworkDeviceRepository        │    │
│  │                                    «interface» IPollingResultRepository         │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ Uses Domain Objects
                                          ↓
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DOMAIN LAYER                                          │
│                                   (Business Logic)                                       │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              Aggregates & Entities                              │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  NetworkDevice (Aggregate Root)                                         │   │    │
│  │  │  ════════════════════════════════════════════════════════════════════   │   │    │
│  │  │  - id: NetworkDeviceId                                                  │   │    │
│  │  │  - ipAddress: IPAddress                                                 │   │    │
│  │  │  - macAddress: MACAddress                                               │   │    │
│  │  │  - status: NetworkDeviceStatus                                          │   │    │
│  │  │  - pollingConfiguration: PollingConfiguration ⭐                        │   │    │
│  │  │  ────────────────────────────────────────────────────────────────────   │   │    │
│  │  │  + configurePolling(interval: PollingInterval): Result<void>           │   │    │
│  │  │  + updatePingCount(count: number): Result<void>                        │   │    │
│  │  │  + enablePolling(): Result<void>                                       │   │    │
│  │  │  + disablePolling(): Result<void>                                      │   │    │
│  │  │  + shouldPoll(currentTime: Date): boolean                              │   │    │
│  │  │  + updatePollingState(result: PollingResult): Result<void>             │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  │                                    │ contains                                   │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  PollingConfiguration (Entity)                                          │   │    │
│  │  │  ══════════════════════════════════════════════════════════════════     │   │    │
│  │  │  - id: PollingConfigurationId                                           │   │    │
│  │  │  - networkDeviceId: NetworkDeviceId                                     │   │    │
│  │  │  - interval: PollingInterval                                            │   │    │
│  │  │  - enabled: boolean                                                     │   │    │
│  │  │  - retryPolicy: RetryPolicy                                             │   │    │
│  │  │  - pingCount: number (1-10, default: 4) ⭐                              │   │    │
│  │  │  - nextScheduledAt: Date | null                                         │   │    │
│  │  │  ──────────────────────────────────────────────────────────────────     │   │    │
│  │  │  + updateInterval(interval: PollingInterval): Result<void>             │   │    │
│  │  │  + updatePingCount(count: number): Result<void>                        │   │    │
│  │  │  + enable(): Result<void>                                              │   │    │
│  │  │  + disable(): Result<void>                                             │   │    │
│  │  │  + canPoll(currentTime: Date): boolean                                 │   │    │
│  │  │  + scheduleNext(fromTime: Date): Result<void>                          │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  PollingResult (Aggregate Root)                                         │   │    │
│  │  │  ══════════════════════════════════════════════════════════════════     │   │    │
│  │  │  - id: PollingResultId                                                  │   │    │
│  │  │  - networkDeviceId: NetworkDeviceId                                     │   │    │
│  │  │  - timestamp: Date                                                      │   │    │
│  │  │  - status: PollingStatus (SUCCESS/PARTIAL_SUCCESS/FAILED)              │   │    │
│  │  │  - metrics: PollingMetrics | null ⭐                                    │   │    │
│  │  │  - attemptNumber: number (1-10)                                         │   │    │
│  │  │  - deviceStatus: NetworkDeviceStatus                                    │   │    │
│  │  │  - errorMessage: string | null                                          │   │    │
│  │  │  ──────────────────────────────────────────────────────────────────     │   │    │
│  │  │  + createSuccess(...): Result<PollingResult>                           │   │    │
│  │  │  + createFailure(...): Result<PollingResult>                           │   │    │
│  │  │  + isSuccessful(): boolean                                             │   │    │
│  │  │  + hasFailed(): boolean                                                │   │    │
│  │  │  + shouldRetry(retryPolicy: RetryPolicy): boolean                      │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              Value Objects (Immutable)                          │    │
│  │                                                                                  │    │
│  │  ┌────────────────────────────────────────────────────────────────────────┐    │    │
│  │  │  PollingMetrics ⭐ (Multi-Ping Statistics)                              │    │    │
│  │  │  ═══════════════════════════════════════════════════════════════════    │    │    │
│  │  │  - responseTimes: number[]          // [12.3, 13.1, 12.8, 13.5]        │    │    │
│  │  │  - averageResponseTime: number      // 12.93                           │    │    │
│  │  │  - minResponseTime: number          // 12.3                            │    │    │
│  │  │  - maxResponseTime: number          // 13.5                            │    │    │
│  │  │  - jitter: number                   // 0.51 (std deviation)            │    │    │
│  │  │  - packetsSent: number              // 4                               │    │    │
│  │  │  - packetsReceived: number          // 4                               │    │    │
│  │  │  - packetLoss: number               // 0% (percentage)                 │    │    │
│  │  │  - ttl: number | null               // 64                              │    │    │
│  │  │  ────────────────────────────────────────────────────────────────────  │    │    │
│  │  │  + create(props): Result<PollingMetrics>                              │    │    │
│  │  └────────────────────────────────────────────────────────────────────────┘    │    │
│  │                                                                                  │    │
│  │  PollingStatus │ PollingInterval │ RetryPolicy │ IPAddress │ MACAddress │      │    │
│  │  NetworkDeviceStatus │ NetworkDeviceId │ PollingConfigurationId │ ...          │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              Domain Events                                      │    │
│  │                                                                                  │    │
│  │  DevicePolledSuccessfullyEvent  │ DevicePollingFailedEvent                     │    │
│  │  PollingIntervalChangedEvent    │ PingCountChangedEvent ⭐                     │    │
│  │  PollingConfigurationChangedEvent                                              │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                          Repository Interfaces (Ports)                          │    │
│  │                                                                                  │    │
│  │  «interface» INetworkDeviceRepository                                          │    │
│  │  + findById(id): Promise<Result<NetworkDevice | null>>                         │    │
│  │  + save(device): Promise<Result<NetworkDevice>>                                │    │
│  │  + findAll(): Promise<Result<NetworkDevice[]>>                                 │    │
│  │                                                                                  │    │
│  │  «interface» IPollingResultRepository                                          │    │
│  │  + findById(id): Promise<Result<PollingResult | null>>                         │    │
│  │  + findLatestByDevice(deviceId): Promise<Result<PollingResult | null>>         │    │
│  │  + findByDeviceAndTimeRange(...): Promise<Result<PollingResult[]>>             │    │
│  │  + save(result): Promise<Result<PollingResult>>                                │    │
│  │  + getDeviceStatistics(...): Promise<Result<{...}>>                            │    │
│  │  + getUptimePercentage(...): Promise<Result<number>>                           │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ Implements
                                          ↓
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               INFRASTRUCTURE LAYER                                       │
│                           (Concrete Implementations)                                     │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                           Polling Implementation                                │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  IcmpDevicePoller ⭐ implements IDevicePoller                            │   │    │
│  │  │  ═══════════════════════════════════════════════════════════════════     │   │    │
│  │  │  - options: PollingOptions                                              │   │    │
│  │  │    • timeoutMs: 5000                                                    │   │    │
│  │  │    • delayBetweenPingsMs: 100                                           │   │    │
│  │  │    • parallel: false (sequential by default)                            │   │    │
│  │  │    • packetSize: 56 bytes                                               │   │    │
│  │  │    • ttl: 64                                                            │   │    │
│  │  │  ─────────────────────────────────────────────────────────────────      │   │    │
│  │  │  + poll(device: NetworkDevice): Promise<Result<PollingMetrics>>        │   │    │
│  │  │  + canPoll(device: NetworkDevice): boolean                             │   │    │
│  │  │  + getProtocolName(): string  // "ICMP"                                │   │    │
│  │  │  - executePingsSequential(ip, count): Promise<PingResult[]>            │   │    │
│  │  │  - executePingsParallel(ip, count): Promise<PingResult[]>              │   │    │
│  │  │  - executeSinglePing(ip): Promise<PingResult>                          │   │    │
│  │  │  - calculateMetrics(results, total): Result<PollingMetrics>            │   │    │
│  │  │  - calculateJitter(responseTimes): number  // Standard deviation       │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  │                                    uses ↓                                        │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  'ping' npm package                                                     │   │    │
│  │  │  • Cross-platform ICMP ping                                             │   │    │
│  │  │  • ping.promise.probe(ip, options)                                      │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                          Background Scheduler                                   │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  PollingScheduler ⭐                                                     │   │    │
│  │  │  ═══════════════════════════════════════════════════════════════════     │   │    │
│  │  │  - config: PollingSchedulerConfig                                       │   │    │
│  │  │    • checkIntervalMs: 5000  (check every 5s)                            │   │    │
│  │  │    • maxConcurrentPolls: 10                                             │   │    │
│  │  │  - isRunning: boolean                                                   │   │    │
│  │  │  - activePolls: Set<string>                                             │   │    │
│  │  │  - statistics: { totalPolls, successfulPolls, failedPolls, ... }       │   │    │
│  │  │  ─────────────────────────────────────────────────────────────────      │   │    │
│  │  │  + start(): void                                                        │   │    │
│  │  │  + stop(): Promise<void>  // Graceful shutdown                          │   │    │
│  │  │  + getStatus(): { isRunning, activePolls, successRate, ... }           │   │    │
│  │  │  - pollDevices(): Promise<void>  // Main loop                           │   │    │
│  │  │  - pollDevice(deviceId): Promise<void>                                  │   │    │
│  │  │  - getDevicesDueForPolling(): Promise<Result<NetworkDevice[]>>         │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  │                              uses ↓                                              │    │
│  │                     ExecutePollingCycleUseCase                                  │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                        Persistence (Repository Implementations)                 │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  PollingResultRepository implements IPollingResultRepository           │   │    │
│  │  │  ═══════════════════════════════════════════════════════════════════     │   │    │
│  │  │  - prisma: PrismaClient                                                 │   │    │
│  │  │  ─────────────────────────────────────────────────────────────────      │   │    │
│  │  │  + findById(id): Promise<Result<PollingResult | null>>                 │   │    │
│  │  │  + findLatestByDevice(...): Promise<Result<PollingResult | null>>      │   │    │
│  │  │  + findByDeviceAndTimeRange(...): Promise<Result<PollingResult[]>>     │   │    │
│  │  │  + save(result): Promise<Result<PollingResult>>                        │   │    │
│  │  │  + getDeviceStatistics(...): Promise<Result<{...}>>                    │   │    │
│  │  │  + getUptimePercentage(...): Promise<Result<number>>                   │   │    │
│  │  │  + getConsecutiveFailureCount(...): Promise<Result<number>>            │   │    │
│  │  │  + deleteOlderThan(cutoffDate): Promise<Result<number>>                │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  │                              uses ↓                                              │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  PollingResultMapper                                                    │   │    │
│  │  │  ═══════════════════════════════════════════════════════════════════     │   │    │
│  │  │  + toDomain(raw: PrismaPollingResult): Result<PollingResult>           │   │    │
│  │  │  + toPersistence(result: PollingResult): PrismaPollingResult           │   │    │
│  │  │    • Flattens PollingMetrics into DB columns                            │   │    │
│  │  │    • Reconstructs domain value objects from DB data                     │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                              │
│                                          │ Persists to                                  │
│                                          ↓                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │                            Database (TimescaleDB)                               │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  PollingConfiguration Table                                             │   │    │
│  │  │  ═══════════════════════════════════════════════════════════════════     │   │    │
│  │  │  • id (UUID, PK)                                                         │   │    │
│  │  │  • networkDeviceId (UUID, FK → NetworkDevice, UNIQUE)                   │   │    │
│  │  │  • intervalSeconds (INT, 1-86400)                                        │   │    │
│  │  │  • enabled (BOOLEAN, default: true)                                      │   │    │
│  │  │  • pingCount (INT, 1-10, default: 4) ⭐                                  │   │    │
│  │  │  • maxRetryAttempts (INT, default: 3)                                    │   │    │
│  │  │  • retryDelayMs (INT, default: 1000)                                     │   │    │
│  │  │  • lastScheduledAt (TIMESTAMP, nullable)                                 │   │    │
│  │  │  • nextScheduledAt (TIMESTAMP, nullable)                                 │   │    │
│  │  │  • createdAt, updatedAt (TIMESTAMP)                                      │   │    │
│  │  │  ─────────────────────────────────────────────────────────────────      │   │    │
│  │  │  Indexes:                                                                │   │    │
│  │  │  • networkDeviceId                                                       │   │    │
│  │  │  • nextScheduledAt                                                       │   │    │
│  │  │  • (enabled, nextScheduledAt) - Composite for scheduler queries         │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  PollingResult Hypertable ⭐ (TimescaleDB)                              │   │    │
│  │  │  ═══════════════════════════════════════════════════════════════════     │   │    │
│  │  │  • id (UUID, PK)                                                         │   │    │
│  │  │  • networkDeviceId (UUID, FK → NetworkDevice)                           │   │    │
│  │  │  • timestamp (TIMESTAMP, PARTITION KEY) ⭐                               │   │    │
│  │  │  • status (ENUM: SUCCESS/PARTIAL_SUCCESS/FAILED)                        │   │    │
│  │  │  • attemptNumber (INT, 1-10)                                             │   │    │
│  │  │  • deviceStatus (ENUM: ONLINE/OFFLINE/MAINTENANCE)                      │   │    │
│  │  │  • errorMessage (TEXT, nullable)                                         │   │    │
│  │  │  ─────────────────────────────────────────────────────────────────      │   │    │
│  │  │  Multi-Ping Metrics (Sprint 1 - ICMP):                                  │   │    │
│  │  │  • responseTimes (FLOAT[], e.g., [12.3, 13.1, 12.8, 13.5])             │   │    │
│  │  │  • averageResponseTime (FLOAT)                                           │   │    │
│  │  │  • minResponseTime (FLOAT)                                               │   │    │
│  │  │  • maxResponseTime (FLOAT)                                               │   │    │
│  │  │  • jitter (FLOAT, standard deviation)                                    │   │    │
│  │  │  • packetsSent (INT)                                                     │   │    │
│  │  │  • packetsReceived (INT)                                                 │   │    │
│  │  │  • packetLoss (FLOAT, percentage)                                        │   │    │
│  │  │  • ttl (INT, nullable)                                                   │   │    │
│  │  │  • responseTimeMs (FLOAT, backwards compatibility)                       │   │    │
│  │  │  ─────────────────────────────────────────────────────────────────      │   │    │
│  │  │  Future SNMP Metrics (Sprint 2+):                                       │   │    │
│  │  │  • uptime (INT)                                                          │   │    │
│  │  │  • temperature (FLOAT)                                                   │   │    │
│  │  │  • cpuUsage, memoryUsage, diskUsage (FLOAT)                             │   │    │
│  │  │  • interfaceStats, bandwidth, errors, discards (JSONB)                  │   │    │
│  │  │  ─────────────────────────────────────────────────────────────────      │   │    │
│  │  │  Indexes:                                                                │   │    │
│  │  │  • (networkDeviceId, timestamp DESC) - Device history queries           │   │    │
│  │  │  • timestamp - Time-range queries                                       │   │    │
│  │  │  • status - Filter by status                                            │   │    │
│  │  │  • (networkDeviceId, status, timestamp) - Composite queries             │   │    │
│  │  │  ─────────────────────────────────────────────────────────────────      │   │    │
│  │  │  TimescaleDB Features:                                                  │   │    │
│  │  │  • Hypertable with 1-day chunks                                         │   │    │
│  │  │  • Compression policy (after 7 days) - Saves ~90% storage              │   │    │
│  │  │  • Continuous aggregate: polling_hourly_stats                           │   │    │
│  │  │  • Retention policy: Optional 90-day cleanup                            │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │    │
│  │  │  polling_hourly_stats (Continuous Aggregate)                            │   │    │
│  │  │  ═══════════════════════════════════════════════════════════════════     │   │    │
│  │  │  Pre-computed hourly statistics for fast dashboard queries:             │   │    │
│  │  │  • networkDeviceId                                                       │   │    │
│  │  │  • hour (time_bucket)                                                    │   │    │
│  │  │  • total_polls, successful_polls, failed_polls                          │   │    │
│  │  │  • avg_response_time, min_response_time, max_response_time              │   │    │
│  │  │  • avg_jitter, avg_packet_loss                                          │   │    │
│  │  │  ─────────────────────────────────────────────────────────────────      │   │    │
│  │  │  • Refreshes every hour                                                  │   │    │
│  │  │  • Covers last 7 days                                                    │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Diagram: Polling Execution Flow

```
┌──────────┐    ┌──────────────┐    ┌────────────────┐    ┌────────────┐    ┌─────────────┐    ┌──────────┐
│ Scheduler│    │ UseCase      │    │ NetworkDevice  │    │ IcmpPoller │    │ Repository  │    │ Database │
│          │    │ (Execute     │    │ Repository     │    │            │    │ (Polling    │    │ (Timescale)
│          │    │  Polling)    │    │                │    │            │    │  Result)    │    │          │
└─────┬────┘    └──────┬───────┘    └───────┬────────┘    └─────┬──────┘    └──────┬──────┘    └────┬─────┘
      │                │                    │                    │                   │                │
      │ Every 5s: Check for devices        │                    │                   │                │
      │────────────────────────────────────>│                    │                   │                │
      │                │                    │                    │                   │                │
      │                │  findAll()         │                    │                   │                │
      │                │───────────────────>│                    │                   │                │
      │                │                    │                    │                   │                │
      │                │  List<NetworkDevice> (filter shouldPoll(now))             │                │
      │                │<───────────────────│                    │                   │                │
      │                │                    │                    │                   │                │
      │ For each device due:                │                    │                   │                │
      │ execute({ deviceId, force: false }) │                    │                   │                │
      │───────────────>│                    │                    │                   │                │
      │                │                    │                    │                   │                │
      │                │  1. Load Device    │                    │                   │                │
      │                │  findById(deviceId)│                    │                   │                │
      │                │───────────────────>│                    │                   │                │
      │                │                    │                    │                   │                │
      │                │  NetworkDevice     │                    │                   │                │
      │                │<───────────────────│                    │                   │                │
      │                │                    │                    │                   │                │
      │                │  2. Check Schedule │                    │                   │                │
      │                │  shouldPoll(now)   │                    │                   │                │
      │                │───────────────────>│                    │                   │                │
      │                │                    │                    │                   │                │
      │                │  true              │                    │                   │                │
      │                │<───────────────────│                    │                   │                │
      │                │                    │                    │                   │                │
      │                │  3. Execute Polling│                    │                   │                │
      │                │  poll(device)      │                    │                   │                │
      │                │────────────────────────────────────────>│                   │                │
      │                │                    │                    │                   │                │
      │                │                    │    ┌──────────────────────────────┐   │                │
      │                │                    │    │ Multi-Ping Execution:        │   │                │
      │                │                    │    │                              │   │                │
      │                │                    │    │ for i = 1 to pingCount (4): │   │                │
      │                │                    │    │   ping.probe(ipAddress)      │───────────────────>│
      │                │                    │    │   wait delayMs (100ms)       │<───────────────────│
      │                │                    │    │   collect response time      │   │                │
      │                │                    │    │                              │   │                │
      │                │                    │    │ Results:                     │   │                │
      │                │                    │    │   [12.3, 13.1, 12.8, 13.5]  │   │                │
      │                │                    │    │                              │   │                │
      │                │                    │    │ Calculate Statistics:        │   │                │
      │                │                    │    │   avg = 12.93                │   │                │
      │                │                    │    │   min = 12.3                 │   │                │
      │                │                    │    │   max = 13.5                 │   │                │
      │                │                    │    │   jitter = stddev = 0.51     │   │                │
      │                │                    │    │   packetLoss = 0%            │   │                │
      │                │                    │    └──────────────────────────────┘   │                │
      │                │                    │                    │                   │                │
      │                │  PollingMetrics {  │                    │                   │                │
      │                │    responseTimes: [12.3, 13.1, ...],    │                   │                │
      │                │    avg: 12.93, jitter: 0.51, ...       │                   │                │
      │                │  }                 │                    │                   │                │
      │                │<────────────────────────────────────────│                   │                │
      │                │                    │                    │                   │                │
      │                │  4. Create PollingResult               │                   │                │
      │                │  PollingResult.createSuccess(...)      │                   │                │
      │                │────────────────────>│                   │                   │                │
      │                │                    │                   │                   │                │
      │                │  PollingResult     │                   │                   │                │
      │                │<────────────────────│                   │                   │                │
      │                │                    │                   │                   │                │
      │                │  5. Update Device Status               │                   │                │
      │                │  updatePollingState(result)            │                   │                │
      │                │────────────────────>│                   │                   │                │
      │                │                    │                   │                   │                │
      │                │  Status updated to ONLINE              │                   │                │
      │                │<────────────────────│                   │                   │                │
      │                │                    │                   │                   │                │
      │                │  6. Schedule Next Poll                 │                   │                │
      │                │  config.scheduleNext(now)              │                   │                │
      │                │────────────────────>│                   │                   │                │
      │                │                    │                   │                   │                │
      │                │  7. Persist Device │                   │                   │                │
      │                │  save(device)      │                   │                   │                │
      │                │───────────────────>│                   │                   │                │
      │                │                    │                   │                   │                │
      │                │                    │  UPDATE PollingConfiguration          │                │
      │                │                    │  SET nextScheduledAt = now + interval │                │
      │                │                    │──────────────────────────────────────────────────────>│
      │                │                    │                   │                   │                │
      │                │  8. Persist PollingResult              │                   │                │
      │                │  save(pollingResult)                   │                   │                │
      │                │────────────────────────────────────────────────────────────>│                │
      │                │                    │                   │                   │                │
      │                │                    │                   │  INSERT INTO PollingResult        │
      │                │                    │                   │  (responseTimes, avg, jitter, ...) │
      │                │                    │                   │───────────────────────────────────>│
      │                │                    │                   │                   │                │
      │                │                    │                   │  PollingResult saved               │
      │                │                    │                   │<───────────────────────────────────│
      │                │                    │                   │                   │                │
      │                │  PollingCycleSummaryDTO {              │                   │                │
      │                │    status: 'SUCCESS',                  │                   │                │
      │                │    metrics: { avg: 12.93, ... }        │                   │                │
      │                │  }                 │                   │                   │                │
      │<───────────────│                    │                   │                   │                │
      │                │                    │                   │                   │                │
      │ Log success    │                    │                   │                   │                │
      │ Update stats   │                    │                   │                   │                │
      │                │                    │                   │                   │                │
      │ Wait 5s, repeat...                  │                   │                   │                │
      │                │                    │                   │                   │                │
```

---

## Class Diagram: Core Domain Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DOMAIN MODEL                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────┐
│   «aggregate root»                │
│   NetworkDevice                   │
├───────────────────────────────────┤
│ - id: NetworkDeviceId             │
│ - name: string                    │
│ - ipAddress: IPAddress            │
│ - macAddress: MACAddress          │
│ - status: NetworkDeviceStatus     │
│ - deviceType: DeviceType          │
│ - pollingConfiguration: PollingConfiguration  ◆───────┐
│ - createdAt: Date                 │                   │
│ - updatedAt: Date                 │                   │
├───────────────────────────────────┤                   │ contains
│ + configurePolling()              │                   │
│ + updatePingCount()               │                   │
│ + enablePolling()                 │                   │
│ + disablePolling()                │                   │
│ + shouldPoll(): boolean           │                   │
│ + updatePollingState()            │                   │
└───────────────────────────────────┘                   │
                                                        │
                                                        ↓
                                    ┌───────────────────────────────────────┐
                                    │   «entity»                            │
                                    │   PollingConfiguration                │
                                    ├───────────────────────────────────────┤
                                    │ - id: PollingConfigurationId          │
                                    │ - networkDeviceId: NetworkDeviceId    │
                                    │ - interval: PollingInterval           │◇──→ «value object» PollingInterval
                                    │ - enabled: boolean                    │         - seconds: number (1-86400)
                                    │ - retryPolicy: RetryPolicy            │◇──→ «value object» RetryPolicy
                                    │ - pingCount: number (1-10) ⭐         │         - maxAttempts: number (1-10)
                                    │ - lastScheduledAt: Date | null        │         - retryDelayMs: number
                                    │ - nextScheduledAt: Date | null        │
                                    ├───────────────────────────────────────┤
                                    │ + updateInterval()                    │
                                    │ + updatePingCount()                   │
                                    │ + enable()                            │
                                    │ + disable()                           │
                                    │ + canPoll(): boolean                  │
                                    │ + scheduleNext()                      │
                                    └───────────────────────────────────────┘


┌──────────────────────────────────────────────┐
│   «aggregate root»                           │
│   PollingResult                              │
├──────────────────────────────────────────────┤
│ - id: PollingResultId                        │
│ - networkDeviceId: NetworkDeviceId           │
│ - timestamp: Date                            │
│ - status: PollingStatus                      │◇──→ «value object» PollingStatus
│ - metrics: PollingMetrics | null ⭐          │         - value: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED'
│ - attemptNumber: number                      │
│ - deviceStatus: NetworkDeviceStatus          │
│ - errorMessage: string | null                │
├──────────────────────────────────────────────┤
│ + createSuccess(): PollingResult             │
│ + createFailure(): PollingResult             │
│ + isSuccessful(): boolean                    │
│ + hasFailed(): boolean                       │
│ + shouldRetry(): boolean                     │
└──────────────────────────────────────────────┘
                    │
                    │ contains
                    ◇
                    │
                    ↓
┌──────────────────────────────────────────────────────────────────────┐
│   «value object»                                                     │
│   PollingMetrics ⭐ (Multi-Ping Statistics)                          │
├──────────────────────────────────────────────────────────────────────┤
│ - responseTimes: number[]        // [12.3, 13.1, 12.8, 13.5]        │
│ - averageResponseTime: number    // 12.93                           │
│ - minResponseTime: number        // 12.3                            │
│ - maxResponseTime: number        // 13.5                            │
│ - jitter: number                 // 0.51 (standard deviation)       │
│ - packetsSent: number            // 4                               │
│ - packetsReceived: number        // 4                               │
│ - packetLoss: number             // 0.0 (percentage)                │
│ - ttl: number | null             // 64                              │
│ ─────────────────────────────────────────────────────────────────── │
│ Future SNMP metrics (Sprint 2+):                                    │
│ - uptime?: number                                                    │
│ - temperature?: number                                               │
│ - cpuUsage?: number                                                  │
│ - memoryUsage?: number                                               │
│ - diskUsage?: number                                                 │
│ - interfaceStats?: any                                               │
│ - bandwidth?: any                                                    │
├──────────────────────────────────────────────────────────────────────┤
│ + create(props): Result<PollingMetrics>                             │
│ + equals(other): boolean                                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Interaction Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM COMPONENTS INTERACTION                      │
└────────────────────────────────────────────────────────────────────────────┘


                          ┌─────────────────────┐
                          │  PollingScheduler   │
                          │  (Background Job)   │
                          └──────────┬──────────┘
                                     │
                     ┌───────────────┼───────────────┐
                     │               │               │
                     │ Every 5s      │ Uses          │ Logs to
                     ↓               ↓               ↓
         ┌──────────────────┐  ┌──────────────┐  ┌─────────┐
         │ NetworkDevice    │  │ Execute      │  │ Logger  │
         │ Repository       │  │ Polling      │  │ (Winston)
         │                  │  │ UseCase      │  └─────────┘
         │ • findAll()      │  └──────┬───────┘
         │ • filter by      │         │
         │   shouldPoll()   │         │ Orchestrates
         └──────────────────┘         │
                                      │
         ┌────────────────────────────┼─────────────────────────┐
         │                            │                         │
         │ Loads                 Uses │                    Saves│
         ↓                            ↓                         ↓
┌──────────────────┐        ┌──────────────────┐    ┌────────────────────┐
│ NetworkDevice    │        │ IcmpDevicePoller │    │ PollingResult      │
│ (Domain)         │        │ (Infrastructure) │    │ Repository         │
│                  │        │                  │    │                    │
│ Contains:        │        │ Executes:        │    │ Persists to        │
│ • PollingConfig  │───────>│ • 4 ICMP pings   │    │ TimescaleDB        │
│   - interval     │ reads  │ • Sequential     │    │                    │
│   - pingCount=4  │        │ • 100ms delay    │    │ Stores:            │
│   - enabled      │        │                  │    │ • responseTimes[]  │
│   - retryPolicy  │        │ Returns:         │    │ • avg, min, max    │
│ • status         │<───────│ PollingMetrics   │    │ • jitter           │
│ • ipAddress      │updates │ - responseTimes  │    │ • packet loss      │
└──────────────────┘        │ - statistics     │    │ • timestamp        │
                            │ - jitter         │    │ • status           │
                            └────────┬─────────┘    └────────────────────┘
                                     │                        │
                                     │ Uses                   │ Queries
                                     ↓                        ↓
                            ┌──────────────┐      ┌──────────────────────┐
                            │ 'ping' npm   │      │ TimescaleDB          │
                            │ package      │      │                      │
                            │              │      │ • Hypertable         │
                            │ • Cross-     │      │ • 1-day chunks       │
                            │   platform   │      │ • Compression        │
                            │ • ICMP       │      │ • Continuous         │
                            │   protocol   │      │   aggregates         │
                            └──────────────┘      │ • Hourly stats       │
                                                  └──────────────────────┘


┌────────────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW DIAGRAM                                 │
└────────────────────────────────────────────────────────────────────────────┘

NetworkDevice            PollingConfig         IcmpPoller          PollingMetrics
  (Entity)    ──────┬──>  (Entity)     ──────>  (Service)   ──────>  (Value Object)
              reads │                   config               returns
                    │                   • IP: 192.168.1.1            • [12.3, 13.1, 12.8, 13.5]
                    │                   • pingCount: 4               • avg: 12.93
                    │                   • timeout: 5s                • jitter: 0.51
                    │                                                 • packetLoss: 0%
                    │
                    │                                        PollingResult
                    │                                         (Aggregate)
                    │                                              │
                    │                                              │ contains metrics
                    │                                              ↓
                    └──────────────────────────────────────> Saved to DB
                                updates status                (TimescaleDB)
```

---

## Key Design Patterns Used

### 1. **Clean Architecture (Layered)**
```
Presentation → Application → Domain ← Infrastructure
   (API)         (Use Cases)  (Entities)  (Implementations)
```

### 2. **Domain-Driven Design (DDD)**
- **Aggregates**: NetworkDevice, PollingResult
- **Entities**: PollingConfiguration
- **Value Objects**: PollingMetrics, PollingStatus, PollingInterval
- **Repository Pattern**: INetworkDeviceRepository, IPollingResultRepository
- **Domain Events**: DevicePolledSuccessfullyEvent, etc.

### 3. **Dependency Inversion (SOLID)**
```
Application Layer defines:  IDevicePoller (interface)
Infrastructure implements:  IcmpDevicePoller (concrete)
                           ↑
                    Depends on abstraction, not implementation
```

### 4. **Template Method Pattern**
```
UseCase (abstract base class)
  - execute() {
      beforeExecute()
      executeImpl()  ← Implemented by concrete use cases
      afterExecute()
    }
```

### 5. **Result Pattern**
```typescript
// No exceptions thrown, explicit error handling
Result<T> = { isSuccess, isFailure, getValue(), getErrorValue() }
```

### 6. **Data Mapper Pattern**
```
PollingResultMapper
  - toDomain(prismaModel) → PollingResult
  - toPersistence(domainEntity) → PrismaModel
```

### 7. **Strategy Pattern**
```
IDevicePoller (strategy interface)
  ├─ IcmpDevicePoller (Sprint 1)
  └─ SnmpDevicePoller (Sprint 2, future)
```

---

## Multi-Ping Feature Highlights ⭐

### Configuration
- **Ping Count**: 1-10 pings per polling cycle (default: 4)
- **Execution Mode**: Sequential (default) or Parallel
- **Delay**: 100ms between sequential pings
- **Timeout**: 5 seconds per ping

### Metrics Collected
```typescript
PollingMetrics {
  responseTimes: [12.3, 13.1, 12.8, 13.5],  // Individual ping times
  averageResponseTime: 12.93,                // Mean
  minResponseTime: 12.3,                     // Minimum
  maxResponseTime: 13.5,                     // Maximum
  jitter: 0.51,                              // Standard deviation
  packetsSent: 4,                            // Total pings sent
  packetsReceived: 4,                        // Successful pings
  packetLoss: 0,                             // Percentage (0-100)
  ttl: 64                                    // Time to live
}
```

### Benefits
1. **More Accurate**: Multiple samples reduce single-ping anomalies
2. **Jitter Calculation**: Standard deviation shows network stability
3. **Packet Loss Detection**: Identifies intermittent connectivity issues
4. **Statistical Analysis**: Better insights than single-ping measurements

---

This diagram provides a comprehensive view of Sprint 1's multi-ping ICMP polling system architecture!
