import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { SubscriptionStatusDTO } from 'application/shared/dtos';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';
import { INotificationService } from '../interfaces';
import { TelegramFormatting } from '../shared';

const DAY_MS = 24 * 60 * 60 * 1000;
// How long before the paid period ends the daily reminder starts.
export const REMINDER_LEAD_DAYS = 5;

export type SubscriptionReminderOutcome = 'SENT' | 'NOT_DUE';

// ADR 0002, R17: the customer hears about non-payment before anything stops,
// every day until the lock, and once more on the day it locks. Sent straight
// to the install's chat, not through the alert publisher: these must reach the
// customer precisely when alerts are silenced. Called once a day by its
// orchestrator.
export class SendSubscriptionReminderUseCase extends UseCase<
  void,
  SubscriptionReminderOutcome
> {
  constructor(
    private readonly getSubscriptionStatus: GetSubscriptionStatusUseCase,
    private readonly notificationService: INotificationService,
    logger: ILogger
  ) {
    super(logger, 'SendSubscriptionReminderUseCase');
  }

  protected async executeImpl(): Promise<
    Result<SubscriptionReminderOutcome>
  > {
    const status = await this.getSubscriptionStatus.execute();
    if (status.isFailure) return this.fail(status.error);

    const now = new Date();
    const text = this.reminderText(status.value, now);
    if (text === null) return this.ok('NOT_DUE');

    const sent = await this.notificationService.send({
      title: '💳 Suscripción',
      body: [
        '💳 *SUSCRIPCIÓN*',
        '',
        TelegramFormatting.escapeMd(text)
      ].join('\n'),
      metadata: {
        deviceId: null,
        deviceName: null,
        ipAddress: null,
        severity: 'WARNING',
        timestamp: now.toISOString()
      }
    });
    if (sent.isFailure) {
      return this.fail(
        `Failed to send subscription reminder: ${sent.error}`
      );
    }
    return this.ok('SENT');
  }

  private reminderText(
    status: SubscriptionStatusDTO,
    now: Date
  ): string | null {
    if (status.state === 'NOT_ENFORCED') return null;
    const paidThrough = new Date(status.paidThrough!);
    const graceEndsAt = new Date(status.graceEndsAt!);
    const lockedAt = new Date(status.lockedAt!);
    const when = (d: Date) => TelegramFormatting.formatLocalTime(d);

    switch (status.state) {
      case 'ACTIVE':
        if (
          paidThrough.getTime() - now.getTime() >
          REMINDER_LEAD_DAYS * DAY_MS
        ) {
          return null;
        }
        return (
          `La suscripción vence el ${when(paidThrough)}. ` +
          'Realiza el pago para que el servicio continúe sin interrupción.'
        );
      case 'GRACE':
        return (
          `La suscripción venció el ${when(paidThrough)}. ` +
          `El ${when(graceEndsAt)} el servicio pasa a solo lectura: ` +
          'se detienen el monitoreo y las alertas.'
        );
      case 'READ_ONLY':
        return (
          'Servicio en solo lectura por falta de pago: el monitoreo y las ' +
          `alertas están detenidos. El ${when(lockedAt)} se bloquea el ` +
          'acceso al panel. Ningún dato se borra.'
        );
      case 'LOCKED':
        // Once, on the day it locks; after that the lock screen says it.
        if (now.getTime() - lockedAt.getTime() >= DAY_MS) return null;
        return (
          'El acceso al panel quedó bloqueado por falta de pago. ' +
          'Los datos se conservan y todo se restablece al recibir el pago.'
        );
    }
  }
}
