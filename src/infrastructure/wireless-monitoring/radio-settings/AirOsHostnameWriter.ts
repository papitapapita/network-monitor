import { Result } from 'domain/shared/core';
import {
  IRadioHostnameWriter,
  RadioLogin
} from 'application/wireless-monitoring/interfaces';
import { SshCommandClient } from '../../device-backups/fetchers/SshCommandClient';

const DONE = 'NMS-RENAMED';
const NAME_LINE = 'resolv.host.1.name';
// RadioHostname already holds to this; checked again because the name ends
// up inside a shell command.
const SHELL_SAFE = /^[A-Za-z0-9 ._-]{1,32}$/;

// AirOS has no documented HTTP call for changing one setting, so the name is
// changed over SSH the way its own shell does (WLS-224): the running
// configuration in /tmp/system.cfg is edited, cfgmtd saves it to flash, and
// `hostname` applies it now. Nothing restarts, so the link stays up.
export class AirOsHostnameWriter implements IRadioHostnameWriter {
  constructor(private readonly ssh: SshCommandClient) {}

  async setHostname(
    ipAddress: string,
    login: RadioLogin,
    hostname: string
  ): Promise<Result<void>> {
    if (!SHELL_SAFE.test(hostname))
      return Result.fail(
        'The radio name has characters AirOS cannot take'
      );

    const line = `${NAME_LINE}=${hostname}`;
    const command = [
      `sed -i 's/^resolv\\.host\\.1\\.name=.*/${line}/' /tmp/system.cfg`,
      // The line is missing on a radio whose name was never set; sed then
      // changes nothing, and nothing must be saved.
      `grep -qxF '${line}' /tmp/system.cfg`,
      'cfgmtd -w -p /etc/ >/dev/null 2>&1',
      `hostname '${hostname}'`,
      `echo ${DONE}`
    ].join(' && ');

    const output = await this.ssh.run(
      ipAddress,
      login.sshPort,
      { username: login.username, password: login.password },
      command
    );
    if (output.isFailure) return Result.fail(output.error);
    if (!output.value.includes(DONE)) {
      const said = output.value.trim().slice(0, 200);
      return Result.fail(
        `The radio did not confirm the new name${said ? `: ${said}` : ''}`
      );
    }
    return Result.ok();
  }
}
