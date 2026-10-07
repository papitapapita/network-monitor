import { BackupFormat } from '../enums';

// `# oct/07/2026 03:00:01 by RouterOS 6.49.10` (v6) or
// `# 2026-10-07 03:00:01 by RouterOS 7.15` (v7): the moment of the export.
const ROUTEROS_EXPORT_HEADER = /^# .*? by (RouterOS .*)$/;

// What two reads of the same configuration have in common. Line endings and
// trailing whitespace vary with how the file was served, not with the
// configuration, so they never count as a change (BKP-005). The file kept for
// restoring is the one the device sent, never this form.
export class ConfigNormalizer {
  public static normalize(format: BackupFormat, raw: string): string {
    const lines = raw
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+$/, ''));
    while (lines.length > 0 && lines[lines.length - 1] === '')
      lines.pop();
    if (format === BackupFormat.ROUTEROS_EXPORT)
      ConfigNormalizer.dropExportDate(lines);
    return lines.join('\n');
  }

  // BKP-052: the date changes on every export; the version it names does not.
  private static dropExportDate(lines: string[]): void {
    const header = lines.findIndex((line) => line.trim() !== '');
    if (header < 0) return;
    const match = ROUTEROS_EXPORT_HEADER.exec(lines[header]);
    if (match) lines[header] = `# by ${match[1]}`;
  }
}
