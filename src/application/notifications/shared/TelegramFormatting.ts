const TIME_ZONE = 'America/Bogota';

export class TelegramFormatting {
  static escapeMd(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
  }

  // Inside a MarkdownV2 link target only `)` and `\` are special.
  static link(label: string, url: string): string {
    const target = url.replace(/[)\\]/g, '\\$&');
    return `[${TelegramFormatting.escapeMd(label)}](${target})`;
  }

  static formatLocalTime(date: Date): string {
    return date.toLocaleString('es-CO', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  // For a summary line: `las 14:05` today, `el 04/10 a las 14:05` otherwise.
  static formatSince(date: Date, now: Date = new Date()): string {
    const time = date.toLocaleTimeString('es-CO', {
      timeZone: TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const day = (d: Date) => {
      const parts = new Intl.DateTimeFormat('es-CO', {
        timeZone: TIME_ZONE,
        day: '2-digit',
        month: '2-digit'
      }).formatToParts(d);
      const part = (type: string) =>
        parts.find((p) => p.type === type)?.value.padStart(2, '0');
      return `${part('day')}/${part('month')}`;
    };
    return day(date) === day(now)
      ? `las ${time}`
      : `el ${day(date)} a las ${time}`;
  }
}
