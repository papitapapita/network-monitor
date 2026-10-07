import { Result } from 'domain/shared/core';
import { BackupFormat } from 'domain/device-backups';
import {
  BackupCredentials,
  FetchedConfig,
  IConfigFetcher
} from 'application/device-backups/interfaces';
import { SshCommandClient } from './SshCommandClient';

export const NOT_A_ROUTEROS_EXPORT =
  'The device did not return a RouterOS export';

// RouterOS 7 hides passwords and keys from `/export` unless asked; RouterOS 6
// shows them and does not know the argument.
const EXPORT_WITH_SECRETS = '/export show-sensitive';
const EXPORT = '/export';
const UNKNOWN_ARGUMENT = /^(expected end of command|syntax error)/i;
// An export is a list of menus, each one a line starting with `/`.
const MENU_LINE = /^\/[a-z]/m;

// BKP-054: the text `/import` takes back, secrets included, so a restore
// leaves nothing to type in again.
export class RouterOsConfigFetcher implements IConfigFetcher {
  constructor(private readonly ssh: SshCommandClient) {}

  async fetch(
    ipAddress: string,
    credentials: BackupCredentials
  ): Promise<Result<FetchedConfig>> {
    const login = {
      username: credentials.username,
      password: credentials.password
    };
    let exported = await this.ssh.run(
      ipAddress,
      credentials.sshPort,
      login,
      EXPORT_WITH_SECRETS
    );
    if (
      exported.isSuccess &&
      UNKNOWN_ARGUMENT.test(exported.value.trim())
    )
      exported = await this.ssh.run(
        ipAddress,
        credentials.sshPort,
        login,
        EXPORT
      );
    if (exported.isFailure) return Result.fail(exported.error);

    if (!MENU_LINE.test(exported.value))
      return Result.fail(NOT_A_ROUTEROS_EXPORT);
    return Result.ok({
      format: BackupFormat.ROUTEROS_EXPORT,
      content: exported.value
    });
  }
}
