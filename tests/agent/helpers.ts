import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import type { ILogger } from '../../src/application/shared/interfaces';

export function silentLogger(): ILogger {
  const logger: ILogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: () => logger,
    setLevel: jest.fn()
  };
  return logger;
}

export function tempDir(): { dir: string; remove: () => void } {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'nms-agent-test-'));
  return {
    dir,
    remove: () => rmSync(dir, { recursive: true, force: true })
  };
}
