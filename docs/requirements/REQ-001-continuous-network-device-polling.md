# REQ-001: Continuous Network Device Polling

## Metadata

| Field                      | Value                   |
| -------------------------- | ----------------------- |
| **Requirement ID**         | REQ-001                 |
| **Sprint**                 | Sprint 1                |
| **Priority**               | High                    |
| **Status**                 | Planned                 |
| **Created**                | 2025-12-03              |
| **Last Updated**           | 2025-12-03              |
| **Epic**                   | Network Monitoring Core |
| **Estimated Story Points** | TBD                     |

---

## Feature Overview

### Summary

The system must continuously poll Network Devices at regular, configurable intervals to monitor their status and health. Polling frequency should be adjustable to balance between system responsiveness and resource utilization, with default intervals varying based on device type.

### Business Value

Continuous monitoring enables network administrators to:

- Detect network issues proactively
- Ensure critical infrastructure uptime
- Balance monitoring granularity with system performance
- Maintain visibility across heterogeneous network environments

---

## Domain Context

### Affected Bounded Contexts

- **Network Monitoring Context** (Primary)
- **Device Management Context**

### Involved Aggregates

- **NetworkDevice Aggregate** (Network Monitoring Context)
  - NetworkDevice (Root)
  - DeviceMonitoring (Entity)
- **Configuration Aggregate** (to be defined)
  - PollingConfiguration (Entity)

### Key Domain Concepts

- **Polling Interval**: Time between consecutive polling attempts for a device
- **Polling Cycle**: Single execution of device status check
- **Device Type**: Classification affecting default polling frequency (Access Point, Station, Router, etc.)
- **Polling Status**: Result state of a polling attempt (Success, Timeout, Error)

---

## User Stories

### Primary User Story

```
Como administrador de la red necesito monitorear constantemente Network Devices
cruciales para el funcionamiento de la red. Necesito monitorear con un intervalo
por horas de la conexión de los clientes.
```

**Translation**: _As a network administrator, I need to constantly monitor Network Devices crucial for network operation. I need to monitor client connections at hourly intervals._

### Decomposed User Stories

#### US-001.1: Basic Device Polling

**As a** network administrator
**I want** the system to automatically poll Network Devices at regular intervals
**So that** I can continuously monitor their status without manual intervention

#### US-001.2: Configurable Polling Intervals

**As a** network administrator
**I want** to configure polling intervals through the interface
**So that** I can balance monitoring responsiveness with system load based on my network's needs

#### US-001.3: Device-Type-Based Default Polling

**As a** network administrator
**I want** different device types to have appropriate default polling frequencies
**So that** critical devices are monitored more frequently while less critical ones don't overwhelm the system

---

## Acceptance Criteria

### AC-001.1: Successful Device Polling

- **Given** a Network Device is registered in the system
- **When** the polling interval elapses
- **Then** the system must successfully execute a polling request to the device
- **And** record the polling result (success/failure, response time, timestamp)

### AC-001.2: Configurable Polling Intervals via UI

- **Given** I am logged in as an administrator
- **When** I navigate to polling configuration settings
- **Then** I must be able to view and modify polling intervals for device types
- **And** changes must take effect within the next polling cycle
- **And** the system must validate that intervals are within acceptable ranges (1 second to 24 hours)

### AC-001.3: Default Polling Frequencies by Device Type

- **Given** a new Network Device is added to the system
- **When** no custom polling interval is specified
- **Then** the system must apply default polling frequency based on device type:
  - Access Points: 15 seconds
  - Stations (Clients): 1 hour
  - Routers: 30 seconds
  - Switches: 30 seconds
  - Other devices: 1 minute (fallback default)

---

## Functional Requirements

### FR-001.1: Polling Engine

The system must implement a polling engine that:

- Executes polling operations at configured intervals
- Supports concurrent polling of multiple devices
- Maintains polling state across system restarts
- Tracks polling history and results

### FR-001.2: Polling Configuration Management

The system must provide:

- CRUD operations for polling configurations
- Device-type-based default configurations
- Device-specific override configurations
- Configuration validation and bounds checking

### FR-001.3: Polling Result Recording

Each polling attempt must record:

- Device ID
- Timestamp (ISO 8601 format)
- Response time (milliseconds)
- Status (Success, Timeout, Error, Unreachable)
- Error details (if applicable)

### FR-001.4: Multi-Vendor Support

The polling mechanism must support:

- Mikrotik devices (via RouterOS API)
- Ubiquiti devices (via UNMS/UISP API or SSH)
- Extensible architecture for additional vendors

---

## Non-Functional Requirements

### Performance Requirements

#### NFR-001.1: CPU Utilization

- Polling operations must not exceed **5% CPU usage** on the monitoring server under normal load
- CPU usage must be measured during continuous polling of target device capacity

#### NFR-001.2: Scalability

- The system must handle **1,000 Network Devices** simultaneously without polling delays
- Polling delays defined as: >10% of configured interval beyond expected execution time
- Target capacity: 10,000 devices (for stress testing)

#### NFR-001.3: Response Time

- Polling result must be processed and stored within **500ms** of receiving device response
- Dashboard updates must reflect status changes within **2 seconds** of polling completion

### Reliability Requirements

#### NFR-001.4: Retry Logic

- Failed polling attempts must be retried **3 times** with exponential backoff
- Retry intervals: 1s, 2s, 4s
- After 3 failed attempts, device marked as "Down" or "Unreachable"

#### NFR-001.5: Fault Tolerance

- Polling engine must gracefully handle individual device failures without affecting other devices
- System must recover from crashes and resume polling within **30 seconds**

### Usability Requirements

#### NFR-001.6: UI Configuration

- Polling interval settings must be accessible within **2 clicks** from the main dashboard
- Configuration changes must provide immediate visual feedback
- Configuration UI must include helpful descriptions and recommended values

#### NFR-001.7: Real-Time Dashboard Updates

- Status changes must be reflected in the dashboard in **real-time** (< 2s latency)
- Dashboard must clearly indicate last successful poll time for each device
- Visual indicators for device status (Online, Offline, Degraded, Unknown)

---

## Technical Constraints

### TC-001.1: Multi-Vendor Device Support

- Must work with various Network Device brands: Mikrotik, Ubiquiti, and potentially others
- Protocol variations must be abstracted behind a common interface

### TC-001.2: Dynamic Configuration Storage

- Polling intervals must be stored persistently (database)
- Configuration must be managed dynamically without system restarts
- Support for both global (device-type) and per-device settings

### TC-001.3: Network Dependency

- Requires stable network connection between monitoring server and target devices
- Must handle network partitions gracefully

---

## Dependencies

### Internal Dependencies

- **Network Device Aggregate**: Must be implemented with DeviceMonitoring entity
- **Device Repository**: For retrieving devices to poll
- **Configuration Service**: For managing polling settings
- **Event Bus**: For publishing polling events to dashboard

### External Dependencies

- **Network Connectivity**: Stable connection to monitored devices
- **Device Availability**: Devices must be powered on and network-accessible
- **Vendor APIs**: RouterOS API (Mikrotik), UNMS/SSH (Ubiquiti)

---

## Assumptions

### Business Assumptions

- ISPs and network administrators prefer a balance between frequent polling and system load
- Not all devices require the same monitoring frequency
- Administrators will actively tune polling intervals based on their specific needs

### Technical Assumptions

- Network Devices will respond to polling requests within **10 seconds** under normal conditions
- Network latency between monitoring server and devices is generally **< 100ms**
- Database can handle **1,000 writes/second** for polling result storage

---

## Risk Analysis

### Risk 1: Network Overload

**Severity**: Medium
**Probability**: Medium
**Description**: Frequent polling may increase network traffic load, potentially affecting production traffic.

**Indicators**:

- Increased network bandwidth utilization
- Packet loss or latency spikes correlated with polling cycles

**Mitigation**:

- Implement adaptive polling that adjusts frequency based on network congestion detection
- Provide bandwidth usage monitoring and alerting
- Use efficient protocols (binary vs. text-based where possible)

### Risk 2: Delayed or Timeout Responses

**Severity**: Medium
**Probability**: High
**Description**: If a Network Device is slow to respond, it might be incorrectly marked as offline.

**Indicators**:

- Frequent status flapping (online → offline → online)
- High timeout rates for specific devices

**Mitigation**:

- Implement configurable timeout thresholds per device type
- Use retry logic with exponential backoff
- Allow administrators to set custom timeout values for problematic devices
- Track response time trends to identify degrading devices

### Risk 3: Scalability Bottlenecks

**Severity**: High
**Probability**: Medium
**Description**: Large number of devices could slow down polling, causing delays or system overload.

**Indicators**:

- Polling cycles taking longer than configured intervals
- Database write queue buildup
- CPU or memory exhaustion

**Mitigation**:

- Implement batch polling to reduce simultaneous requests
- Use connection pooling and async I/O
- Distribute polling load across multiple worker processes
- Implement database write batching and buffering
- Consider horizontal scaling architecture for very large deployments

### Risk 4: Database Performance Degradation

**Severity**: High
**Probability**: Medium
**Description**: High-frequency polling generates massive amounts of time-series data, potentially degrading database performance.

**Indicators**:

- Slow query performance
- Database storage growth
- Write operation delays

**Mitigation**:

- Use time-series optimized storage (TimescaleDB, InfluxDB)
- Implement data retention policies (aggregate old data, archive, or delete)
- Use separate read/write databases if necessary
- Index optimization for time-based queries

---

## Alternative Solutions Considered

### Alternative 1: Event-Driven Monitoring

**Description**: Instead of fixed-interval polling, implement event-driven triggers where devices push status updates.

**Pros**:

- Reduced network traffic
- Near-instant status updates
- Lower server resource usage

**Cons**:

- Requires devices to support push notifications (SNMP traps, webhooks)
- Not all device vendors support this
- Missed events if connection is temporarily lost
- Harder to detect "silent" failures

**Decision**: Not selected for initial implementation, but may be added as complementary feature for supported devices.

### Alternative 2: Hierarchical Polling

**Description**: Use different polling frequencies based on device health (healthy devices polled less frequently).

**Pros**:

- Automatic load optimization
- More efficient resource usage

**Cons**:

- Complex logic
- May miss rapid degradation of "healthy" devices
- Requires sophisticated health scoring algorithm

**Decision**: Deferred to future iteration; start with simpler fixed-interval approach.

---

## Security Considerations

### SEC-001: DDoS Prevention

**Requirement**: Ensure polling does not create self-inflicted DDoS conditions
**Implementation**:

- Rate limiting on polling requests per device
- Maximum concurrent polling connections (e.g., 100 simultaneous)
- Circuit breaker pattern for repeatedly failing devices

### SEC-002: Authentication & Authorization

**Requirement**: Prevent unauthorized polling configuration modifications
**Implementation**:

- Role-based access control (RBAC)
- Admins: Full read/write access to polling configuration
- Viewers: Read-only access to current polling settings
- Audit logging of all configuration changes

### SEC-003: Credential Management

**Requirement**: Secure storage of device credentials used for polling
**Implementation**:

- Encrypt credentials at rest (AES-256)
- Use secrets management service (e.g., HashiCorp Vault, AWS Secrets Manager)
- Never log credentials in polling logs

---

## User Roles & Permissions

| Role              | View Polling Status | View Polling Config | Modify Polling Config | View Logs |
| ----------------- | ------------------- | ------------------- | --------------------- | --------- |
| **Administrator** | ✓                   | ✓                   | ✓                     | ✓         |
| **Operator**      | ✓                   | ✓                   | ✗                     | ✓         |
| **Viewer**        | ✓                   | ✓ (read-only)       | ✗                     | ✗         |

---

## Audit & Logging Requirements

### Polling Operation Logs

**Retention**: 6 months (then archive or delete)

**Required Fields**:

- Timestamp (ISO 8601, UTC)
- Device ID
- Device IP Address
- Polling Result (Success, Timeout, Error, Unreachable)
- Response Time (ms)
- Error Message (if applicable)
- Retry Attempt Number (if applicable)

**Example**:

```json
{
  "timestamp": "2025-12-03T14:23:45.123Z",
  "deviceId": "dev_12345",
  "deviceIp": "192.168.1.100",
  "result": "SUCCESS",
  "responseTime": 45,
  "retryAttempt": 0
}
```

### Configuration Change Logs

**Retention**: 2 years

**Required Fields**:

- Timestamp
- User ID
- Action (Create, Update, Delete)
- Resource (Device Type or Device ID)
- Old Value
- New Value

**Example**:

```json
{
  "timestamp": "2025-12-03T14:20:00.000Z",
  "userId": "admin_001",
  "action": "UPDATE",
  "resource": "polling_config.access_point",
  "oldValue": { "interval": 15 },
  "newValue": { "interval": 30 }
}
```

---

## Testing Requirements

### Unit Testing

- Test polling engine logic with mocked devices
- Test configuration validation
- Test retry logic and exponential backoff
- Test device-type-based default assignment
- **Coverage Target**: > 80%

### Integration Testing

- Test end-to-end polling flow with real device APIs
- Test configuration persistence and retrieval
- Test event publishing to dashboard
- Test multi-vendor device support

### Performance Testing

**Load Testing**:

- Simulate 1,000 devices with default intervals
- Measure CPU, memory, network usage
- Verify polling delays remain < 10% of interval
- **Target**: < 5% CPU, < 500MB memory

**Stress Testing**:

- Simulate 10,000 devices simultaneously
- Identify breaking points and bottlenecks
- Measure database write performance under load
- **Goal**: Understand system limits for capacity planning

**Soak Testing**:

- Run continuous polling for 48 hours with 1,000 devices
- Monitor for memory leaks or performance degradation
- **Goal**: Ensure stability for production deployment

### Chaos Testing

- Simulate network congestion
- Simulate device timeouts and failures
- Simulate database unavailability
- Verify adaptive polling mechanisms and failover behavior

---

## Integration Requirements

### INT-001: Third-Party Alerting

The monitoring system must integrate with:

- **Slack**: Webhook-based notifications
- **Discord**: Webhook-based notifications
- **Email**: SMTP-based notifications
- **Future**: Telegram, Microsoft Teams, PagerDuty

**Integration Points**:

- Device status changes (Up → Down, Down → Up)
- Polling failure thresholds exceeded
- Configuration changes

### INT-002: API Export

Polling results must be exportable via REST API:

- **Endpoint**: `GET /api/v1/polling/results`
- **Query Parameters**: deviceId, startTime, endTime, status
- **Response Format**: JSON
- **Authentication**: API key or OAuth2
- **Rate Limiting**: 100 requests/minute per API key

**Use Cases**:

- External analytics platforms
- Custom dashboards
- Reporting tools
- Data warehousing

---

## Failover & Redundancy

### FAIL-001: Retry Mechanism

- Failed polling attempts retried **3 times** with exponential backoff (1s, 2s, 4s)
- After 3 failures, device marked as "Down"
- Subsequent polling continues at normal interval to detect recovery

### FAIL-002: Graceful Degradation

- If database is temporarily unavailable, queue polling results in memory (max 1,000 entries)
- When database recovers, flush queued results
- If queue exceeds limit, log warning and drop oldest entries

### FAIL-003: System Recovery

- Polling engine must resume operations within **30 seconds** of system restart
- No manual intervention required
- State recovered from database (last poll times, configurations)

---

## Maintenance & Support Requirements

### Error Reporting

System logs must provide clear, actionable error messages:

- **Bad**: "Error polling device"
- **Good**: "Timeout polling device dev_12345 (192.168.1.100) after 10s - Device unreachable or network issue"

### Diagnostic Tools

- Admin dashboard showing:
  - Per-device polling status and history
  - System-wide polling success rate
  - Response time distribution
  - Active polling worker status
  - Queue depths and processing rates

### Documentation

- API documentation for polling endpoints
- Configuration guide with recommended values
- Troubleshooting guide for common issues
- Performance tuning guide

---

## Definition of Done

This requirement is considered complete when:

- [ ] All acceptance criteria are met and verified
- [ ] Polling engine implemented and tested with Mikrotik and Ubiquiti devices
- [ ] Configuration UI implemented with validation
- [ ] Default polling frequencies configured for all device types
- [ ] Unit tests written with > 80% coverage
- [ ] Integration tests pass with real devices
- [ ] Performance testing completed successfully (1,000 devices, < 5% CPU)
- [ ] Stress testing completed (10,000 devices)
- [ ] Security review completed (authentication, credential storage, rate limiting)
- [ ] API documentation published
- [ ] Logging and audit trails implemented
- [ ] Code reviewed and approved
- [ ] Deployed to staging environment
- [ ] User acceptance testing (UAT) passed
- [ ] Production deployment plan approved

---

## Related Documents

- [ARCHITECTURE.md](/docs/ARCHITECTURE.md)
- [DOMAIN-MODEL.md](/docs/DOMAIN-MODEL.md)
- [UBIQUITOUS-LANGUAGE.md](/docs/UBIQUITOUS-LANGUAGE.md)
- [EVENT-FLOWS.md](/docs/EVENT-FLOWS.md)

---

## Notes

### Open Questions

1. Should polling intervals be configurable per individual device, or only per device type?
   - **Proposal**: Support both, with per-device overriding per-type
2. What data retention policy for raw polling logs?
   - **Proposal**: 6 months detailed logs, then aggregate to hourly summaries for 2 years
3. Should we implement adaptive polling in Sprint 1 or defer?
   - **Proposal**: Defer to Sprint 2, start with fixed intervals

### Future Enhancements

- Adaptive polling based on network conditions
- Predictive failure detection using ML on polling trends
- Geographic distribution of polling servers for multi-region deployments
- Support for SNMP trap-based event notifications
- Customizable polling protocols per vendor
