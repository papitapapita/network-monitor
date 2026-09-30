// Source: src/application/shared/use-cases/GetInstallerUseCase.ts

import { Readable } from 'stream';
import { GetInstallerUseCase } from '../../../../src/application/shared/use-cases/GetInstallerUseCase';
import {
  IInstallerStore,
  INSTALLERS_UNAVAILABLE,
  InstallerFile
} from '../../../../src/application/shared/interfaces/IInstallerStore';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';

const FILE: InstallerFile = {
  fileName: 'nms-agent-setup-0.1.0.exe',
  platform: 'windows',
  sizeBytes: 3,
  modifiedAt: new Date('2026-09-01T00:00:00Z')
};

function storeOpening(
  opened: Awaited<ReturnType<IInstallerStore['open']>>
): jest.Mocked<IInstallerStore> {
  return {
    list: jest.fn(),
    open: jest.fn().mockResolvedValue(opened)
  };
}

describe('GetInstallerUseCase', () => {
  it('[INS-042] hands back the installer and its stream', async () => {
    const stream = Readable.from(['abc']);
    const store = storeOpening(Result.ok({ file: FILE, stream }));
    const useCase = new GetInstallerUseCase(store, makeLogger());

    const result = await useCase.execute({ fileName: FILE.fileName });

    expect(store.open).toHaveBeenCalledWith(FILE.fileName);
    expect(result.value.stream).toBe(stream);
    expect(result.value.installer).toMatchObject({
      fileName: FILE.fileName,
      version: '0.1.0',
      sizeBytes: 3
    });
  });

  it('[INS-043] fails for a name the folder does not list', async () => {
    const useCase = new GetInstallerUseCase(
      storeOpening(Result.ok(null)),
      makeLogger()
    );

    expect(
      (await useCase.execute({ fileName: 'secrets.env' })).error
    ).toBe('Installer not found: secrets.env');
  });

  it('[INS-042] refuses when no installer folder is configured', async () => {
    const useCase = new GetInstallerUseCase(null, makeLogger());

    expect(
      (await useCase.execute({ fileName: FILE.fileName })).error
    ).toBe(INSTALLERS_UNAVAILABLE);
  });

  it('reports a folder it cannot read', async () => {
    const useCase = new GetInstallerUseCase(
      storeOpening(
        Result.fail('Installer folder cannot be read: EACCES')
      ),
      makeLogger()
    );

    expect(
      (await useCase.execute({ fileName: FILE.fileName })).error
    ).toContain('Installer folder cannot be read');
  });

  it('logs the installer, not the stream', async () => {
    const logger = makeLogger();
    const useCase = new GetInstallerUseCase(
      storeOpening(
        Result.ok({ file: FILE, stream: Readable.from(['abc']) })
      ),
      logger
    );

    await useCase.execute({ fileName: FILE.fileName });

    const completed = logger.info.mock.calls.find(([msg]) =>
      msg.includes('completed')
    );
    expect(completed![1]).toEqual({
      duration: expect.any(String),
      response: expect.objectContaining({ fileName: FILE.fileName })
    });
    expect(completed![1]!.response).not.toHaveProperty('stream');
  });
});
