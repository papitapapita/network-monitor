import { IHandle } from 'domain/shared/interfaces';
import { WirelessSnapshotCreatedEvent } from 'domain/wireless-monitoring/events';
import {
  IWirelessSnapshotRepository,
  IWirelessDeviceConfigRepository
} from 'domain/wireless-monitoring/repository';
import { ILogger, IEventStreamHub } from 'application/shared/interfaces';
import { WirelessThroughputMapper } from '../mappers';
import {
  THROUGHPUT_EVENT,
  THROUGHPUT_FLEET_CHANNEL,
  throughputDeviceChannel
} from '../channels';

/**
 * Pushes each stored poll onto the live throughput streams.
 *
 * The event carries only identifiers, so the snapshot is re-read to get its
 * metrics. That read is skipped entirely when nobody is listening — polling a
 * fleet must not pay for a feature no operator has open.
 */
export class WirelessSnapshotCreatedThroughputHandler
  implements IHandle<WirelessSnapshotCreatedEvent>
{
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly configRepo: IWirelessDeviceConfigRepository,
    private readonly hub: IEventStreamHub,
    private readonly logger: ILogger
  ) {}

  async handle(event: WirelessSnapshotCreatedEvent): Promise<void> {
    const deviceId = event.deviceId.toString();
    const deviceChannel = throughputDeviceChannel(deviceId);

    const listeners =
      this.hub.clientCount(deviceChannel) +
      this.hub.clientCount(THROUGHPUT_FLEET_CHANNEL);
    if (listeners === 0) return;

    try {
      const snapshotResult = await this.snapshotRepo.findById(
        event.aggregateId
      );
      if (snapshotResult.isFailure || !snapshotResult.value) {
        this.logger.warn(
          'WirelessSnapshotCreatedThroughputHandler: snapshot unavailable',
          { deviceId, error: snapshotResult.error }
        );
        return;
      }

      const configResult =
        await this.configRepo.findByDeviceId(event.deviceId);
      if (configResult.isFailure) {
        this.logger.warn(
          'WirelessSnapshotCreatedThroughputHandler: config unavailable',
          { deviceId, error: configResult.error }
        );
        return;
      }

      const payload = WirelessThroughputMapper.toDTO(
        snapshotResult.value,
        configResult.value,
        new Date()
      );

      this.hub.publish(deviceChannel, THROUGHPUT_EVENT, payload);
      this.hub.publish(
        THROUGHPUT_FLEET_CHANNEL,
        THROUGHPUT_EVENT,
        payload
      );
    } catch (error) {
      // a broadcast failure must never fail the poll that produced it
      this.logger.error(
        'WirelessSnapshotCreatedThroughputHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error)),
        { deviceId }
      );
    }
  }
}
