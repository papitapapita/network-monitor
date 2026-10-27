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
      external: ['*.node', 'cpu-features'],
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
    // Everything it borrows from the backend: the ping probe and the
    // wireless collectors it runs for the backend (AGT-101), the RouterOS
    // client it changes suspension queues with (AGT-111), the config
    // fetchers it takes backups with (AGT-114), the router traffic reader
    // (AGT-117), the radio hostname writer (AGT-120), the logger, and Result.
    expect(
      backendCode
        .filter((input) => !input.startsWith('src/domain/shared/'))
        .sort()
    ).toEqual([
      'src/application/device-monitoring/services/PingCycleProbe.ts',
      'src/application/service-enforcement/interfaces/IRouterQueueService.ts',
      'src/domain/device-backups/enums/BackupFormat.ts',
      'src/domain/device-backups/enums/BackupOutcome.ts',
      'src/domain/device-backups/enums/BackupTrigger.ts',
      'src/domain/device-backups/enums/index.ts',
      'src/infrastructure/device-backups/fetchers/AirOsConfigFetcher.ts',
      'src/infrastructure/device-backups/fetchers/ConfigFetcherRegistry.ts',
      'src/infrastructure/device-backups/fetchers/RouterOsConfigFetcher.ts',
      'src/infrastructure/device-backups/fetchers/SshCommandClient.ts',
      'src/infrastructure/device-backups/fetchers/index.ts',
      'src/infrastructure/logging/WinstonLogger.ts',
      'src/infrastructure/monitoring/ping/PingService.ts',
      'src/infrastructure/monitoring/router-traffic/RouterOsTrafficReader.ts',
      'src/infrastructure/service-enforcement/RouterOsQueueService.ts',
      'src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts',
      'src/infrastructure/wireless-monitoring/collectors/MimosaSnmpCollector.ts',
      'src/infrastructure/wireless-monitoring/collectors/SnmpClient.ts',
      'src/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector.ts',
      'src/infrastructure/wireless-monitoring/collectors/WirelessCollectorRegistry.ts',
      'src/infrastructure/wireless-monitoring/collectors/index.ts',
      'src/infrastructure/wireless-monitoring/radio-settings/AirOsHostnameWriter.ts',
      'src/infrastructure/wireless-monitoring/radio-settings/RadioHostnameWriterRegistry.ts'
    ]);
  });
});
