import {
  DomainEvent,
  PollingConfigurationChangedEventProps,
  NetworkDeviceId,
  PollingConfigurationId
} from '../';

/**
 * PollingConfigurationChangedEvent - General polling configuration settings have been modified.
 *
 * Published By: NetworkDevice Aggregate
 * Published When: Configuration properties change that don't have dedicated events (retry policy, enabled state, etc.)
 *
 * Handlers:
 * - ConfigurationHistoryLogger: Records all configuration changes for audit trail
 * - NotificationService: Alerts administrators of configuration modifications
 * - ConfigurationCache: Invalidates cached polling configuration
 * - AuditLogger: Records configuration change for compliance
 * - PollingService: Reloads configuration for affected device
 *
 * Use Cases:
 * - Admin enables or disables polling for device (maintenance mode)
 * - Retry policy is updated (max attempts, backoff strategy, timeout)
 * - Multiple configuration fields changed simultaneously
 * - Configuration reset to default values
 * - Bulk configuration update applied to device group
 *
 * Business Rules:
 * - This is a GENERAL event for changes without specific events
 * - Specific changes have dedicated events:
 *   - Polling interval changes → PollingIntervalChangedEvent
 *   - Ping count changes → PingCountChangedEvent
 * - changeDescription is human-readable summary of what changed
 * - May represent single field change or multiple simultaneous changes
 * - Event published after successful validation and persistence
 * - Configuration change applies to next polling cycle
 * - Disabling polling stops all future polls until re-enabled
 *
 * @example
 * ```typescript
 * // Retry policy update
 * const event = new PollingConfigurationChangedEvent({
 *   aggregateId: PollingConfigurationId.create().value,
 *   networkDeviceId: NetworkDeviceId.create().value,
 *   deviceName: 'Core-Router-01',
 *   changeDescription: 'Retry policy updated: maxAttempts changed from 3 to 5',
 *   dateTimeOccurred: new Date()
 * });
 *
 * // Enabling/disabling polling
 * const event2 = new PollingConfigurationChangedEvent({
 *   aggregateId: PollingConfigurationId.create().value,
 *   networkDeviceId: NetworkDeviceId.create().value,
 *   deviceName: 'Maintenance-Switch',
 *   changeDescription: 'Polling disabled for scheduled maintenance',
 *   dateTimeOccurred: new Date()
 * });
 * ```
 */
export class PollingConfigurationChangedEvent extends DomainEvent<PollingConfigurationChangedEventProps> {
  constructor(props: PollingConfigurationChangedEventProps) {
    super(props);
  }

  get aggregateId(): NetworkDeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get pollingConfigurationId(): PollingConfigurationId {
    return this.props.pollingConfigurationId;
  }

  get deviceName(): string {
    return this.props.deviceName;
  }

  get changeDescription(): string {
    return this.props.changeDescription;
  }
}
