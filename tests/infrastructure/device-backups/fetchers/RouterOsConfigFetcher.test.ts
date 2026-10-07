// Source: src/infrastructure/device-backups/fetchers/RouterOsConfigFetcher.ts

import { Result } from '../../../../src/domain/shared/core';
import { BackupFormat } from '../../../../src/domain/device-backups';
import {
  NOT_A_ROUTEROS_EXPORT,
  RouterOsConfigFetcher,
  SshCommandClient
} from '../../../../src/infrastructure/device-backups/fetchers';

const EXPORT =
  '# 2026-10-07 03:00:01 by RouterOS 7.15\n/ip address\nadd address=10.0.0.1/24 interface=ether1\n';
const CREDENTIALS = {
  username: 'admin',
  password: 'secret',
  httpPort: 443,
  sshPort: 2222
};

describe('RouterOsConfigFetcher', () => {
  let run: jest.Mock;
  let fetcher: RouterOsConfigFetcher;

  beforeEach(() => {
    run = jest.fn();
    fetcher = new RouterOsConfigFetcher({
      run
    } as unknown as SshCommandClient);
  });

  it('[BKP-054] should export with the secrets, over SSH on the device SSH port', async () => {
    run.mockResolvedValue(Result.ok(EXPORT));

    const result = await fetcher.fetch('10.0.0.1', CREDENTIALS);

    expect(result.value).toEqual({
      format: BackupFormat.ROUTEROS_EXPORT,
      content: EXPORT
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      '10.0.0.1',
      2222,
      { username: 'admin', password: 'secret' },
      '/export show-sensitive'
    );
  });

  it.each([
    'expected end of command (line 1 column 9)',
    'syntax error (line 1 column 9)'
  ])(
    '[BKP-054] should fall back to a plain export when RouterOS 6 answers "%s"',
    async (answer) => {
      run
        .mockResolvedValueOnce(Result.ok(`${answer}\r\n`))
        .mockResolvedValueOnce(Result.ok(EXPORT));

      const result = await fetcher.fetch('10.0.0.1', CREDENTIALS);

      expect(result.value.content).toBe(EXPORT);
      expect(run).toHaveBeenLastCalledWith(
        '10.0.0.1',
        2222,
        expect.anything(),
        '/export'
      );
    }
  );

  it('[BKP-054] should fail an answer that is not an export', async () => {
    run.mockResolvedValue(
      Result.ok('not enough permissions (9)\r\n')
    );

    const result = await fetcher.fetch('10.0.0.1', CREDENTIALS);

    expect(result.error).toBe(NOT_A_ROUTEROS_EXPORT);
  });

  it('should pass on an SSH error', async () => {
    run.mockResolvedValue(
      Result.fail(
        'SSH login rejected: check the device username and password'
      )
    );

    const result = await fetcher.fetch('10.0.0.1', CREDENTIALS);

    expect(result.error).toBe(
      'SSH login rejected: check the device username and password'
    );
  });
});
