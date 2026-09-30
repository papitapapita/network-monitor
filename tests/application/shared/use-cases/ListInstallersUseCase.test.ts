// Source: src/application/shared/use-cases/ListInstallersUseCase.ts

import { ListInstallersUseCase } from '../../../../src/application/shared/use-cases/ListInstallersUseCase';
import {
  IInstallerStore,
  INSTALLERS_UNAVAILABLE,
  InstallerFile
} from '../../../../src/application/shared/interfaces/IInstallerStore';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';

function file(
  fileName: string,
  modifiedAt: string,
  platform: InstallerFile['platform'] = 'windows'
): InstallerFile {
  return {
    fileName,
    platform,
    sizeBytes: 1024,
    modifiedAt: new Date(modifiedAt)
  };
}

function storeWith(
  result: Result<InstallerFile[]>
): jest.Mocked<IInstallerStore> {
  return {
    list: jest.fn().mockResolvedValue(result),
    open: jest.fn()
  };
}

describe('ListInstallersUseCase', () => {
  it('[INS-042] lists installers newest first', async () => {
    const useCase = new ListInstallersUseCase(
      storeWith(
        Result.ok([
          file('nms-agent-setup-0.1.0.exe', '2026-09-01T00:00:00Z'),
          file(
            'nms-agent-0.2.0-linux-x64.tar.gz',
            '2026-09-20T00:00:00Z',
            'linux'
          ),
          file('nms-agent-setup-0.2.0.exe', '2026-09-20T00:00:00Z')
        ])
      ),
      makeLogger()
    );

    const result = await useCase.execute();

    expect(result.value.installers.map((i) => i.fileName)).toEqual([
      'nms-agent-0.2.0-linux-x64.tar.gz',
      'nms-agent-setup-0.2.0.exe',
      'nms-agent-setup-0.1.0.exe'
    ]);
  });

  it('[INS-042] reads the version from the file name', async () => {
    const useCase = new ListInstallersUseCase(
      storeWith(
        Result.ok([
          file('nms-agent-setup-1.12.3.exe', '2026-09-01T00:00:00Z'),
          file('agent.msi', '2026-08-01T00:00:00Z')
        ])
      ),
      makeLogger()
    );

    const { installers } = (await useCase.execute()).value;

    expect(installers[0]).toEqual({
      fileName: 'nms-agent-setup-1.12.3.exe',
      platform: 'windows',
      version: '1.12.3',
      sizeBytes: 1024,
      modifiedAt: '2026-09-01T00:00:00.000Z'
    });
    expect(installers[1].version).toBeNull();
  });

  it('[INS-042] refuses when no installer folder is configured', async () => {
    const useCase = new ListInstallersUseCase(null, makeLogger());

    expect((await useCase.execute()).error).toBe(
      INSTALLERS_UNAVAILABLE
    );
  });

  it('reports a folder it cannot read', async () => {
    const useCase = new ListInstallersUseCase(
      storeWith(
        Result.fail('Installer folder cannot be read: ENOENT')
      ),
      makeLogger()
    );

    expect((await useCase.execute()).error).toContain(
      'Installer folder cannot be read'
    );
  });
});
