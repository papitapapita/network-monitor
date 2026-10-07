import { BackupFormat } from '../enums';

// What two reads of the same configuration have in common. Line endings and
// trailing whitespace vary with how the file was served, not with the
// configuration, so they never count as a change (BKP-005). The file kept for
// restoring is the one the device sent, never this form.
export class ConfigNormalizer {
  public static normalize(
    _format: BackupFormat,
    raw: string
  ): string {
    const lines = raw
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+$/, ''));
    while (lines.length > 0 && lines[lines.length - 1] === '')
      lines.pop();
    return lines.join('\n');
  }
}
