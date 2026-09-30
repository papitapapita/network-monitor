import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { GetInstallerUseCase } from 'application/shared/use-cases/GetInstallerUseCase';
import { INSTALLERS_UNAVAILABLE } from 'application/shared/interfaces';
import { FileSystemInstallerStore } from 'infrastructure/installation/FileSystemInstallerStore';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';

async function read(stream: NodeJS.ReadableStream): Promise<string> {
  let text = '';
  for await (const chunk of stream) text += chunk.toString();
  return text;
}

// No database: a real folder, read through the store the container builds.
describe('GetInstallerUseCase — integration', () => {
  const logger = new WinstonLogger();
  let dir: string;
  let useCase: GetInstallerUseCase;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nms-installers-'));
    await writeFile(
      join(dir, 'nms-agent-setup-0.1.0.exe'),
      'installer'
    );
    useCase = new GetInstallerUseCase(
      new FileSystemInstallerStore(dir),
      logger
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('[INS-042] streams the installer from the folder', async () => {
    const result = await useCase.execute({
      fileName: 'nms-agent-setup-0.1.0.exe'
    });

    expect(result.value.installer.sizeBytes).toBe(9);
    expect(await read(result.value.stream)).toBe('installer');
  });

  it('[INS-043] does not reach a file outside the folder', async () => {
    const outside = join(dirname(dir), 'outside-installer.exe');
    await writeFile(outside, 'nope');
    try {
      const result = await useCase.execute({
        fileName: '../outside-installer.exe'
      });

      expect(result.error).toContain('Installer not found');
    } finally {
      await rm(outside, { force: true });
    }
  });

  it('[INS-043] does not serve a non-installer file in the folder', async () => {
    await writeFile(join(dir, 'config.json'), '{}');

    const result = await useCase.execute({ fileName: 'config.json' });

    expect(result.error).toBe('Installer not found: config.json');
  });

  it('[INS-042] is unavailable when no folder is configured', async () => {
    const result = await new GetInstallerUseCase(
      null,
      logger
    ).execute({
      fileName: 'nms-agent-setup-0.1.0.exe'
    });

    expect(result.error).toBe(INSTALLERS_UNAVAILABLE);
  });
});
