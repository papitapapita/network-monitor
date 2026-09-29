import { spawn } from 'child_process';

// Seals the agent token before it is written to disk (ADR 0002, R2).
export interface ISecretProtector {
  readonly kind: 'dpapi' | 'file-permissions';
  protect(plain: string): Promise<string>;
  unprotect(sealed: string): Promise<string>;
}

// Linux: the token file itself is the protection — created 0600, owned by
// the service account.
export class FilePermissionProtector implements ISecretProtector {
  readonly kind = 'file-permissions' as const;

  async protect(plain: string): Promise<string> {
    return plain;
  }

  async unprotect(sealed: string): Promise<string> {
    return sealed;
  }
}

export type PowerShellRunner = (
  script: string,
  stdin: string
) => Promise<string>;

// Current-user scope: the service runs as its own account and enrolls
// itself, so only that account can read the token back — not another user
// of the PC, and not an administrator copying the file elsewhere.
const PROTECT = `Add-Type -AssemblyName System.Security
$plain = [Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd())
$sealed = [Security.Cryptography.ProtectedData]::Protect($plain, $null, 'CurrentUser')
[Convert]::ToBase64String($sealed)`;

const UNPROTECT = `Add-Type -AssemblyName System.Security
$sealed = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
$plain = [Security.Cryptography.ProtectedData]::Unprotect($sealed, $null, 'CurrentUser')
[Text.Encoding]::UTF8.GetString($plain)`;

// Windows DPAPI through PowerShell, which every supported Windows ships:
// no native module to compile into the single executable. The secret goes
// through stdin, never the command line, where other processes can see it.
export class DpapiProtector implements ISecretProtector {
  readonly kind = 'dpapi' as const;

  constructor(
    private readonly run: PowerShellRunner = runPowerShell
  ) {}

  async protect(plain: string): Promise<string> {
    return (await this.run(PROTECT, plain)).trim();
  }

  async unprotect(sealed: string): Promise<string> {
    return (await this.run(UNPROTECT, sealed)).trim();
  }
}

export function runPowerShell(
  script: string,
  stdin: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(`PowerShell exited ${code}: ${stderr.trim()}`)
        );
    });
    child.stdin.end(stdin);
  });
}
