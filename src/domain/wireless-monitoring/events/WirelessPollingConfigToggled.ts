import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { WirelessPollingConfigId } from 'domain/shared/ids';
import { WirelessPollingConfigToggledEventProps } from '../props';

/**
 * WirelessPollingConfigToggledEvent — A polling config has been enabled or disabled.
 *
 * Published By: WirelessPollingConfig aggregate
 * Published When: WirelessPollingConfig.enable() or WirelessPollingConfig.disable() causes a state change
 *
 * Handlers:
 * - WirelessPollingConfigToggledHandler: Adjusts the scheduler's active polling set
 */
export class WirelessPollingConfigToggledEvent extends DomainEvent<WirelessPollingConfigToggledEventProps> {
  constructor(props: WirelessPollingConfigToggledEventProps) {
    super(props);
  }

  get aggregateId(): WirelessPollingConfigId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }
}
