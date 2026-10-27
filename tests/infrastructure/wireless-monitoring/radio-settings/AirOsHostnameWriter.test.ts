// Source: src/infrastructure/wireless-monitoring/radio-settings/AirOsHostnameWriter.ts

import { Result } from '../../../../src/domain/shared/core';
import { SshCommandClient } from '../../../../src/infrastructure/device-backups/fetchers';
import { AirOsHostnameWriter } from '../../../../src/infrastructure/wireless-monitoring/radio-settings';

const LOGIN = {
  username: 'ubnt',
  password: 'secret',
  httpPort: 443,
  sshPort: 2222
};

describe('[WLS-224] AirOsHostnameWriter', () => {
  let run: jest.Mock;
  let writer: AirOsHostnameWriter;

  beforeEach(() => {
    run = jest.fn();
    writer = new AirOsHostnameWriter({
      run
    } as unknown as SshCommandClient);
  });

  it('should edit the running config, save it to flash and apply the name, over SSH on the device SSH port', async () => {
    run.mockResolvedValue(Result.ok('NMS-RENAMED\n'));

    const result = await writer.setHostname(
      '10.0.0.5',
      LOGIN,
      'AP Norte 2'
    );

    expect(result.isSuccess).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    const [ip, port, login, command] = run.mock.calls[0];
    expect([ip, port, login]).toEqual([
      '10.0.0.5',
      2222,
      { username: 'ubnt', password: 'secret' }
    ]);
    expect(command).toBe(
      "sed -i 's/^resolv\\.host\\.1\\.name=.*/resolv.host.1.name=AP Norte 2/' /tmp/system.cfg" +
        " && [ \"$(grep '^resolv\\.host\\.1\\.name=' /tmp/system.cfg)\" = 'resolv.host.1.name=AP Norte 2' ]" +
        ' && cfgmtd -w -p /etc/ >/dev/null 2>&1' +
        " && echo 'AP Norte 2' > /proc/sys/kernel/hostname" +
        ' && echo NMS-RENAMED'
    );
  });

  it('should fail when the radio does not print the marker, quoting what it said', async () => {
    run.mockResolvedValue(Result.ok('sh: cfgmtd: not found\n'));

    const result = await writer.setHostname('10.0.0.5', LOGIN, 'AP');

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'The radio did not confirm the new name: sh: cfgmtd: not found'
    );
  });

  it('should fail without quoting when the radio printed nothing', async () => {
    run.mockResolvedValue(Result.ok(''));

    const result = await writer.setHostname('10.0.0.5', LOGIN, 'AP');

    expect(result.error).toBe(
      'The radio did not confirm the new name'
    );
  });

  it('should pass on an SSH failure', async () => {
    run.mockResolvedValue(
      Result.fail('SSH connection refused on port 2222')
    );

    const result = await writer.setHostname('10.0.0.5', LOGIN, 'AP');

    expect(result.error).toBe('SSH connection refused on port 2222');
  });

  it.each(["AP'; reboot; '", 'AP/1', 'a'.repeat(33), ''])(
    'should never send %j to the shell',
    async (name) => {
      const result = await writer.setHostname(
        '10.0.0.5',
        LOGIN,
        name
      );

      expect(result.isFailure).toBe(true);
      expect(run).not.toHaveBeenCalled();
    }
  );
});
