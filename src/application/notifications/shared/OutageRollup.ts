import { Result } from 'domain/shared/core';
import { Alert } from 'domain/notifications/aggregates';
import { IAlertRepository } from 'domain/notifications/repository';
import { ILogger } from 'application/shared/interfaces';
import { IOutageTopologyQuery, OutageDeviceDTO } from '../interfaces';
import { AffectedDeviceDTO } from '../dtos';

const ALERT_TYPE = 'device_unreachable';
const MAX_DEPTH = 64;

// The devices that went down behind a root alert (NOT-241/243).
export class OutageRollup {
  constructor(
    private readonly alertRepository: IAlertRepository,
    private readonly topology: IOutageTopologyQuery,
    private readonly logger: ILogger
  ) {}

  // Called as the root is about to page, so its message names every device
  // down behind it — not only those whose own delay already ran out. A
  // device already paged on its own is left alone: it went down first, and
  // that page stands.
  async attachDownstream(root: Alert): Promise<void> {
    const downstream = await this.topology.findDownstream(
      root.deviceId.toString()
    );
    if (downstream.isFailure) {
      this.logger.warn(
        'Could not read the devices behind a root alert',
        {
          alertId: root.id.toString(),
          error: downstream.error
        }
      );
      return;
    }
    if (downstream.value.length === 0) return;

    const open =
      await this.alertRepository.findAllOpenByType(ALERT_TYPE);
    if (open.isFailure) {
      this.logger.warn('Could not read the open down alerts', {
        alertId: root.id.toString(),
        error: open.error
      });
      return;
    }

    const behind = new Set(downstream.value.map((d) => d.deviceId));
    for (const alert of open.value) {
      if (!behind.has(alert.deviceId.toString())) continue;
      if (alert.notifiedAt !== null) continue;
      if (alert.causedByAlertId?.equals(root.id)) continue;
      if (alert.attachTo(root.id).isFailure) continue;

      const saved = await this.alertRepository.save(alert);
      if (saved.isFailure) {
        this.logger.warn(
          'Could not attach a device to its root alert',
          {
            alertId: alert.id.toString(),
            rootAlertId: root.id.toString(),
            error: saved.error
          }
        );
      }
    }
  }

  async affected(root: Alert): Promise<Result<AffectedDeviceDTO[]>> {
    const attached = await this.alertRepository.findAffectedBy(
      root.id
    );
    if (attached.isFailure) return Result.fail(attached.error);
    if (attached.value.length === 0) return Result.ok([]);

    const downstream = await this.topology.findDownstream(
      root.deviceId.toString()
    );
    if (downstream.isFailure) return Result.fail(downstream.error);
    const devices = new Map<string, OutageDeviceDTO>(
      downstream.value.map((d) => [d.deviceId, d])
    );

    // A link changed since the outage began leaves an attached device
    // outside the subtree; it is still named, just without a via.
    const missing = attached.value
      .map((a) => a.deviceId.toString())
      .filter((id) => !devices.has(id));
    if (missing.length > 0) {
      const found = await this.topology.findByIds(missing);
      if (found.isFailure) return Result.fail(found.error);
      for (const d of found.value) {
        devices.set(d.deviceId, { ...d, upstreamDeviceId: null });
      }
    }

    // One alert per device: the newest decides whether it is back.
    const byDevice = new Map<string, Alert>();
    for (const alert of attached.value) {
      byDevice.set(alert.deviceId.toString(), alert);
    }

    const rootId = root.deviceId.toString();
    const list: AffectedDeviceDTO[] = [];
    for (const [deviceId, alert] of byDevice) {
      const device = devices.get(deviceId);
      const viaDeviceId = this.via(
        deviceId,
        rootId,
        devices,
        byDevice
      );
      list.push({
        deviceId,
        name: device?.name ?? 'Dispositivo eliminado',
        ipAddress:
          device?.ipAddress ??
          (alert.details.ipAddress as string | null | undefined) ??
          null,
        status: alert.isOpen ? 'DOWN' : 'UP',
        viaDeviceId,
        viaDeviceName:
          viaDeviceId === null
            ? null
            : (devices.get(viaDeviceId)?.name ?? null)
      });
    }
    return Result.ok(list);
  }

  private via(
    deviceId: string,
    rootId: string,
    devices: Map<string, OutageDeviceDTO>,
    affected: Map<string, Alert>
  ): string | null {
    let current = devices.get(deviceId)?.upstreamDeviceId ?? null;
    for (let hop = 0; current !== null && hop < MAX_DEPTH; hop++) {
      if (current === rootId) return null;
      if (affected.has(current)) return current;
      current = devices.get(current)?.upstreamDeviceId ?? null;
    }
    return null;
  }
}
