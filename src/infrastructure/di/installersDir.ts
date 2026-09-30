import { isAbsolute } from 'path';

// The folder agent installers are served from. Unset means this install
// offers no downloads. A relative path would depend on where the process was
// started, so it stops the boot. The folder itself is read per request, so it
// may be created or mounted after the backend starts.
export function loadInstallersDir(
  env: NodeJS.ProcessEnv
): string | null {
  const dir = env.INSTALLERS_DIR?.trim();
  if (!dir) return null;
  if (!isAbsolute(dir)) {
    throw new Error(
      `INSTALLERS_DIR: expected an absolute path, got "${env.INSTALLERS_DIR}"`
    );
  }
  return dir;
}
