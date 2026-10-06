import { Money } from 'domain/shared/value-objects';

// What the customer reads (BIL-320, BIL-321), in Spanish, in Colombian
// pesos and Colombian dates.

const pesos = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 2
});

const longDate = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Bogota'
});

// Calendar days are held as UTC midnight; formatting them in Bogotá would
// show the day before.
const longDay = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
});

export function formatPesos(amount: Money): string {
  return `$${pesos.format(amount.toNumber())}`;
}

export function formatInstant(instant: Date): string {
  return longDate.format(instant);
}

export function formatCalendarDay(day: Date): string {
  return longDay.format(day);
}

export function billEmail(input: {
  fullName: string;
  period: string;
  total: Money;
  dueDate: Date;
}): { subject: string; text: string } {
  return {
    subject: `Su cuenta del periodo ${input.period}`,
    text:
      `Hola ${input.fullName},\n\n` +
      `Adjuntamos su cuenta del periodo ${input.period} por ` +
      `${formatPesos(input.total)}. Puede pagarla hasta el ` +
      `${formatInstant(input.dueDate)}.\n\n` +
      'Gracias por su pago.'
  };
}

export function reminderEmail(input: {
  fullName: string;
  period: string;
  total: Money;
  cutDay: Date;
}): { subject: string; text: string } {
  return {
    subject: 'Recordatorio de pago de su servicio de internet',
    text:
      `Hola ${input.fullName},\n\n` +
      `Su cuenta del periodo ${input.period} por ` +
      `${formatPesos(input.total)} está vencida. Si no registramos el ` +
      `pago, el servicio se suspenderá el ${formatCalendarDay(input.cutDay)}.` +
      '\n\nSi ya pagó, puede ignorar este mensaje.'
  };
}

// The order of the WhatsApp template's body parameters (BIL-322).
export function reminderTemplateParams(input: {
  fullName: string;
  period: string;
  total: Money;
  cutDay: Date;
}): string[] {
  return [
    input.fullName,
    input.period,
    formatPesos(input.total),
    formatCalendarDay(input.cutDay)
  ];
}
