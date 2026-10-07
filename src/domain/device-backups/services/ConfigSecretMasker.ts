import { BackupFormat } from '../enums';

export const MASKED_SECRET = '********';

// AirOS keys are dotted paths (`users.1.password`, `wpasupplicant.profile.1.
// network.1.psk`). `key` counts only as the last part: `wpa.1.key.1.mgmt`
// names the key type, not the key.
const AIROS_SECRET_PART = /pass|psk|secret|community|token|private/i;

// RouterOS arguments are `name=value`, the value quoted when it holds spaces:
// `wpa2-pre-shared-key="a b"`, `secret=x`, `private-key="..."`.
const ROUTEROS_ARGUMENT =
  /(^|\s)([A-Za-z0-9-]+)=("(?:[^"\\]|\\.)*"|\S*)/g;
const ROUTEROS_SECRET_NAME =
  /pass|psk|secret|community|token|private|key$/i;

// Hides the values of passwords, wireless keys and community strings in a
// configuration line, keeping the name so a reader still sees which setting
// changed (BKP-071).
export class ConfigSecretMasker {
  public static maskLine(format: BackupFormat, line: string): string {
    switch (format) {
      case BackupFormat.AIROS_CFG:
        return ConfigSecretMasker.maskAirOs(line);
      case BackupFormat.ROUTEROS_EXPORT:
        return ConfigSecretMasker.maskRouterOs(line);
    }
  }

  private static maskAirOs(line: string): string {
    const eq = line.indexOf('=');
    if (eq <= 0) return line;
    const parts = line.slice(0, eq).split('.');
    const secret =
      parts.some((part) => AIROS_SECRET_PART.test(part)) ||
      /key$/i.test(parts[parts.length - 1]);
    return secret && eq < line.length - 1
      ? `${line.slice(0, eq + 1)}${MASKED_SECRET}`
      : line;
  }

  // BKP-053
  private static maskRouterOs(line: string): string {
    if (line.trimStart().startsWith('#')) return line;
    return line.replace(
      ROUTEROS_ARGUMENT,
      (whole, lead: string, name: string, value: string) =>
        ROUTEROS_SECRET_NAME.test(name) &&
        value !== '' &&
        value !== '""'
          ? `${lead}${name}=${MASKED_SECRET}`
          : whole
    );
  }
}
