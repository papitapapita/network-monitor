import { build } from 'esbuild';
import path from 'path';

// ADR 0002: the agent must not carry a database, Express, the DI container
// or a use case. ESLint checks the agent's own imports; this checks
// everything they pull in, by bundling the agent the way it ships.
describe('agent import boundary', () => {
  let inputs: string[];
  let packages: Set<string>;

  beforeAll(async () => {
    const root = path.resolve(__dirname, '../..');
    const result = await build({
      entryPoints: [path.join(root, 'src/agent/main.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      metafile: true,
      logLevel: 'silent',
      absWorkingDir: root
    });
    inputs = Object.keys(result.metafile!.inputs);
    packages = new Set(
      inputs
        .filter((input) => input.startsWith('node_modules/'))
        .map((input) => {
          const parts = input.split('/');
          return parts[1].startsWith('@')
            ? `${parts[1]}/${parts[2]}`
            : parts[1];
        })
    );
  }, 60_000);

  it('bundles no database, HTTP framework or DI container', () => {
    for (const forbidden of [
      '@prisma/client',
      '@prisma/adapter-pg',
      'pg',
      'express',
      'jsonwebtoken',
      'bcrypt'
    ]) {
      expect(packages).not.toContain(forbidden);
    }
    expect(
      inputs.filter((i) => i.includes('generated/prisma'))
    ).toEqual([]);
    expect(
      inputs.filter((i) => i.includes('infrastructure/di/'))
    ).toEqual([]);
  });

  it('reaches no use case, repository, aggregate or presentation code', () => {
    const backendCode = inputs.filter(
      (input) =>
        input.startsWith('src/') && !input.startsWith('src/agent/')
    );

    expect(
      backendCode.filter((input) =>
        /use-cases|repositor|aggregates|persistence|presentation/.test(
          input
        )
      )
    ).toEqual([]);
    // Everything it borrows from the backend: the probe, its result type,
    // the logger, and Result.
    expect(
      backendCode.filter(
        (input) => !input.startsWith('src/domain/shared/')
      )
    ).toEqual(
      expect.arrayContaining([
        'src/infrastructure/monitoring/ping/PingService.ts',
        'src/application/device-monitoring/services/PingCycleProbe.ts'
      ])
    );
    expect(
      backendCode.filter(
        (input) => !input.startsWith('src/domain/shared/')
      )
    ).toHaveLength(3);
  });
});
