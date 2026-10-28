import { AlertSeverity } from 'domain/shared/enums';
import {
  PortHealthChange,
  PortIssueRef,
  RouterPortCounters
} from 'domain/device-monitoring/aggregates';
import { RouterHealthThresholds } from 'domain/device-monitoring/value-objects';
import {
  IAlertPublisher,
  ILogger,
  isSuppressedPublish
} from 'application/shared/interfaces';
import {
  EthernetPortReading,
  PortSpeedRouterCandidate
} from '../interfaces';

export const PORT_HEALTH_SOURCE = 'Estado de puertos';
// A plain alert type, so it can be muted for the whole install (MON-197).
export const PORT_HEALTH_ALERT_TYPE = 'port_health';

// MON-197: one notice per router and check for what opened, one for what
// closed, through the shared publisher so quiet hours and muted types apply.
export class PortHealthNotifier {
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async notify(
    candidate: PortSpeedRouterCandidate,
    ports: EthernetPortReading[],
    counters: RouterPortCounters,
    change: PortHealthChange,
    thresholds: RouterHealthThresholds,
    at: Date
  ): Promise<void> {
    const router = candidate.deviceName;
    const byName = new Map(ports.map((p) => [p.name, p]));
    const label = (ref: PortIssueRef) => {
      const comment = byName.get(ref.portName)?.comment;
      return comment ? `${ref.portName} (${comment})` : ref.portName;
    };
    const problem = (ref: PortIssueRef) =>
      problemText(
        ref,
        counters,
        byName.get(ref.portName) ?? null,
        thresholds
      );
    const recovery = (ref: PortIssueRef) =>
      recoveryText(ref, byName.get(ref.portName) ?? null);

    if (change.raised.length > 0) {
      const [one] = change.raised;
      await this.publish(candidate, at, false, {
        summary:
          change.raised.length === 1
            ? `El puerto ${label(one!)} de "${router}" ${problem(one!)}`
            : `${change.raised.length} problemas en puertos de "${router}"`,
        detail:
          change.raised.length === 1
            ? null
            : change.raised
                .map((r) => `• ${label(r)}: ${problem(r)}`)
                .join('\n')
      });
    }
    if (change.recovered.length > 0) {
      const [one] = change.recovered;
      await this.publish(candidate, at, true, {
        summary:
          change.recovered.length === 1
            ? `El puerto ${label(one!)} de "${router}" ${recovery(one!)}`
            : `Se normalizaron ${change.recovered.length} problemas en puertos de "${router}"`,
        detail:
          change.recovered.length === 1
            ? null
            : change.recovered
                .map((r) => `• ${label(r)}: ${recovery(r)}`)
                .join('\n')
      });
    }
  }

  private async publish(
    candidate: PortSpeedRouterCandidate,
    at: Date,
    resolved: boolean,
    message: { summary: string; detail: string | null }
  ): Promise<void> {
    try {
      const result = await this.alertPublisher.publish({
        deviceId: candidate.deviceId,
        severity: AlertSeverity.WARNING,
        source: PORT_HEALTH_SOURCE,
        summary: message.summary,
        detail: message.detail,
        occurredAt: at,
        resolved,
        type: PORT_HEALTH_ALERT_TYPE
      });
      if (result.isFailure && !isSuppressedPublish(result.error)) {
        this.logger.error('Port health notice not sent', undefined, {
          deviceId: candidate.deviceId,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error(
        'Port health notice failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

function problemText(
  ref: PortIssueRef,
  counters: RouterPortCounters,
  port: EthernetPortReading | null,
  t: RouterHealthThresholds
): string {
  const counter = counters.port(ref.portName);
  switch (ref.issue) {
    case 'ERRORS':
      return `sigue sumando errores (+${formatNumber(counter?.errorsAdded ?? 0)} en el último chequeo)`;
    case 'FLAPPING': {
      const times = counter?.linkDownsAdded ?? 0;
      return `se cayó ${formatNumber(times)} ${times === 1 ? 'vez' : 'veces'} en el último chequeo`;
    }
    case 'SFP_RX_LOW':
      return `recibe ${dbm(port?.sfp?.rxPowerDbm ?? null)} por la fibra (menos de ${dbm(t.minSfpRxPowerDbm)})`;
  }
}

function recoveryText(
  ref: PortIssueRef,
  port: EthernetPortReading | null
): string {
  switch (ref.issue) {
    case 'ERRORS':
      return 'dejó de sumar errores';
    case 'FLAPPING':
      return 'dejó de caerse';
    case 'SFP_RX_LOW':
      return `volvió a recibir bien por la fibra (${dbm(port?.sfp?.rxPowerDbm ?? null)})`;
  }
}

function dbm(value: number | null): string {
  return value === null ? 'sin dato' : `${formatNumber(value)} dBm`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}
