import { mkdtemp, rm, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ListInstallersUseCase } from 'application/shared/use-cases/ListInstallersUseCase';
import { INSTALLERS_UNAVAILABLE } from 'application/shared/interfaces';
import { FileSystemInstallerStore } from 'infrastructure/installation/FileSystemInstallerStore';
import { loadInstallersDir } from 'infrastructure/di/installersDir';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';

// No database: a real folder, read through the store the container builds.
describe('ListInstallersUseCase — integration', () => {
  const logger = new WinstonLogger();
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nms-installers-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const useCaseFor = (installersDir: string | null) =>
    new ListInstallersUseCase(
      installersDir
        ? new FileSystemInstallerStore(installersDir)
        : null,
      logger
    );

  it('[INS-042] lists what is in the folder, newest first', async () => {
    const older = join(dir, 'nms-agent-setup-0.1.0.exe');
    await writeFile(older, 'old');
    await utimes(
      older,
      new Date('2026-01-01'),
      new Date('2026-01-01')
    );
    await writeFile(join(dir, 'nms-agent-setup-0.2.0.exe'), 'new');
    await writeFile(join(dir, 'notes.txt'), 'ignored');

    const result = await useCaseFor(dir).execute();

    expect(result.value.installers.map((i) => i.version)).toEqual([
      '0.2.0',
      '0.1.0'
    ]);
  });

  it('[INS-042] offers a file dropped in after start, without a restart', async () => {
    const useCase = useCaseFor(dir);
    expect((await useCase.execute()).value.installers).toEqual([]);

    await writeFile(
      join(dir, 'nms-agent-0.1.0-linux-x64.tar.gz'),
      'x'
    );

    expect((await useCase.execute()).value.installers).toHaveLength(
      1
    );
  });

  it('[INS-042] is unavailable when INSTALLERS_DIR is unset', async () => {
    const result = await useCaseFor(loadInstallersDir({})).execute();

    expect(result.error).toBe(INSTALLERS_UNAVAILABLE);
  });

  it('fails when the folder is missing', async () => {
    const result = await useCaseFor(join(dir, 'missing')).execute();

    expect(result.error).toContain('Installer folder cannot be read');
  });
});
