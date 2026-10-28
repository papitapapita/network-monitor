import { AlertSeverity } from 'domain/shared/enums';
import {
  RouterHealthChange,
  RouterSystemState,
  routerHealthValue
} from 'domain/device-monitoring/aggregates';
import { RouterHealthIssue } from 'domain/device-monitoring/props';
import { RouterHealthThresholds } from 'domain/device-monitoring/value-objects';
import {
  IAlertPublisher,
  ILogger,
  isSuppressedPublish
} from 'application/shared/interfaces';
import {
  IReportedOutageQuery,
  PortSpeedRouterCandidate
} from '../interfaces';

export const ROUTER_SYSTEM_SOURCE = 'Estado de routers';
// Plain alert types, so each can be muted for the whole install.
export const ROUTER_REBOOTED_ALERT_TYPE = 'router_rebooted';
export const ROUTER_HEALTH_ALERT_TYPE = 'router_health';
// MON-171: a down notice this close to the boot belongs to the reboot.
export const REBOOT_OUTAGE_WINDOW_MS = 10 * 60_000;

const ISSUE_NAME: Record<RouterHealthIssue, string> = {
  CPU: 'la CPU',
  MEMORY: 'la memoria libre',
  DISK: 'el disco libre',
  TEMPERATURE: 'la temperatura',
  VOLTAGE: 'el voltaje'
};

// MON-171, MON-174: the notices of the router system check, through the
// shared publisher so quiet hours and muted types apply.
export class RouterSystemNotifier {
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly outages: IReportedOutageQuery,
    private readonly logger: ILogger
  ) {}

  // MON-171: only a reboot the ping check did not already report. If the
  // down alerts cannot be read, the notice goes out: a repeat beats a miss.
  async notifyReboot(
    candidate: PortSpeedRouterCandidate,
    rebootedAt: Date,
    now: Date
  ): Promise<boolean> {
    const reported = await this.outages.wasReportedDown(
      candidate.deviceId,
      new Date(rebootedAt.getTime() - REBOOT_OUTAGE_WINDOW_MS),
      now
    );
    if (reported.isFailure) {
      this.logger.warn('Down alerts unavailable for a reboot', {
        deviceId: candidate.deviceId,
        error: reported.error
      });
    } else if (reported.value) {
      return false;
    }
    await this.publish(candidate, {
      type: ROUTER_REBOOTED_ALERT_TYPE,
      at: rebootedAt,
      resolved: false,
      summary: `El router "${candidate.deviceName}" se reinició`,
      detail: 'El ping no alcanzó a detectarlo caído.'
    });
    return true;
  }

  // MON-174: one notice per router and check for what opened, one for what
  // closed.
  async notifyHealth(
    candidate: PortSpeedRouterCandidate,
    state: RouterSystemState,
    change: RouterHealthChange,
    thresholds: RouterHealthThresholds,
    at: Date
  ): Promise<void> {
    const router = candidate.deviceName;
    const reading = state.reading;
    if (!reading) return;
    const value = (issue: RouterHealthIssue) =>
      formatValue(issue, routerHealthValue(issue, reading));

    if (change.raised.length > 0) {
      const lines = change.raised.map(
        (i) =>
          `${capitalize(problemText(i, value(i)))} (${limitText(i, thresholds)})`
      );
      await this.publish(candidate, {
        type: ROUTER_HEALTH_ALERT_TYPE,
        at,
        resolved: false,
        summary:
          change.raised.length === 1
            ? `${capitalize(problemText(change.raised[0]!, value(change.raised[0]!)))} en "${router}" (${limitText(change.raised[0]!, thresholds)})`
            : `${change.raised.length} problemas de salud en "${router}"`,
        detail:
          change.raised.length === 1
            ? null
            : lines.map((l) => `• ${l}`).join('\n')
      });
    }
    if (change.recovered.length > 0) {
      await this.publish(candidate, {
        type: ROUTER_HEALTH_ALERT_TYPE,
        at,
        resolved: true,
        summary:
          change.recovered.length === 1
            ? `Se normalizó ${ISSUE_NAME[change.recovered[0]!]} en "${router}" (${value(change.recovered[0]!)})`
            : `Se normalizaron ${change.recovered.length} problemas de salud en "${router}"`,
        detail:
          change.recovered.length === 1
            ? null
            : change.recovered
                .map(
                  (i) => `• ${capitalize(ISSUE_NAME[i])}: ${value(i)}`
                )
                .join('\n')
      });
    }
  }

  private async publish(
    candidate: PortSpeedRouterCandidate,
    notice: {
      type: string;
      at: Date;
      resolved: boolean;
      summary: string;
      detail: string | null;
    }
  ): Promise<void> {
    try {
      const result = await this.alertPublisher.publish({
        deviceId: candidate.deviceId,
        severity: AlertSeverity.WARNING,
        source: ROUTER_SYSTEM_SOURCE,
        summary: notice.summary,
        detail: notice.detail,
        occurredAt: notice.at,
        resolved: notice.resolved,
        type: notice.type
      });
      if (result.isFailure && !isSuppressedPublish(result.error)) {
        this.logger.error('Router notice not sent', undefined, {
          deviceId: candidate.deviceId,
          type: notice.type,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error(
        'Router notice failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

function problemText(
  issue: RouterHealthIssue,
  value: string
): string {
  switch (issue) {
    case 'CPU':
      return `CPU al ${value}`;
    case 'MEMORY':
      return `memoria libre al ${value}`;
    case 'DISK':
      return `disco libre al ${value}`;
    case 'TEMPERATURE':
      return `temperatura de ${value}`;
    case 'VOLTAGE':
      return `voltaje de ${value}`;
  }
}

function limitText(
  issue: RouterHealthIssue,
  t: RouterHealthThresholds
): string {
  switch (issue) {
    case 'CPU':
      return `más de ${t.cpuPercent} %`;
    case 'MEMORY':
      return `menos de ${t.minFreeMemoryPercent} %`;
    case 'DISK':
      return `menos de ${t.minFreeDiskPercent} %`;
    case 'TEMPERATURE':
      return `más de ${t.maxTemperatureC} °C`;
    case 'VOLTAGE':
      return `menos de ${formatNumber(t.minVoltage ?? 0)} V`;
  }
}

function formatValue(
  issue: RouterHealthIssue,
  value: number | null
): string {
  if (value === null) return 'sin dato';
  const unit =
    issue === 'TEMPERATURE' ? '°C' : issue === 'VOLTAGE' ? 'V' : '%';
  return `${formatNumber(value)} ${unit}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
