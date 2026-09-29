import { promises as fs } from 'fs';

// Write-then-rename, so a crash or power cut mid-write leaves the previous
// file whole instead of a truncated one.
export async function writeFileAtomic(
  filePath: string,
  data: string,
  mode = 0o600
): Promise<void> {
  const temp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temp, data, { mode });
  await fs.rename(temp, filePath);
}

export async function readFileIfExists(
  filePath: string
): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return null;
    throw error;
  }
}

export async function removeIfExists(
  filePath: string
): Promise<void> {
  await fs.rm(filePath, { force: true });
}
