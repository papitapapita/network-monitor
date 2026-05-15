import { AggregateRoot, Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { WirelessAlertRecordProps } from '../props/WirelessAlertRecordProps';
import { WirelessAlertRecordId } from 'domain/shared/ids';
import { WirelessAlertClearedEvent } from '../events/WirelessAlertCleared';

export class WirelessAlertRecord extends AggregateRoot<WirelessAlertRecordProps, WirelessAlertRecordId> {
  private constructor(props: WirelessAlertRecordProps, id: WirelessAlertRecordId) {
    super(props, id);
  }

  get deviceId(): DeviceId                   { return this.props.deviceId; }
  get metric(): string                       { return this.props.metric; }
  get severity(): 'WARNING' | 'CRITICAL'    { return this.props.severity; }
  get threshold(): number                    { return this.props.threshold; }
  get triggeredAt(): Date                    { return this.props.triggeredAt; }
  get clearedAt(): Date | null               { return this.props.clearedAt; }
  get isActive(): boolean                    { return this.props.isActive; }
  get lastValue(): number                    { return this.props.lastValue; }
  get message(): string                      { return this.props.message; }

  public static open(
    deviceId: DeviceId,
    metric: string,
    severity: 'WARNING' | 'CRITICAL',
    threshold: number,
    currentValue: number,
    message: string
  ): Result<WirelessAlertRecord> {
    const id = WirelessAlertRecordId.create();
    const record = new WirelessAlertRecord({
      deviceId,
      metric,
      severity,
      threshold,
      triggeredAt: new Date(),
      clearedAt: null,
      isActive: true,
      lastValue: currentValue,
      message,
    }, id);
    return Result.ok(record);
  }

  public static reconstitute(props: WirelessAlertRecordProps, id: WirelessAlertRecordId): WirelessAlertRecord {
    return new WirelessAlertRecord(props, id);
  }

  public updateValue(value: number): void {
    this.props.lastValue = value;
  }

  public clear(clearedAt: Date): Result<void> {
    if (!this.props.isActive) {
      return Result.fail('Alert is already cleared');
    }
    this.props.isActive = false;
    this.props.clearedAt = clearedAt;
    this.addDomainEvent(new WirelessAlertClearedEvent({
      aggregateId: this.id,
      deviceId: this.props.deviceId,
      metric: this.props.metric,
      severity: this.props.severity,
      clearedAt,
      dateTimeOccurred: new Date(),
    }));
    return Result.ok();
  }
}
