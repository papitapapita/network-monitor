import { RouterOSAPI } from 'node-routeros';
import { Result } from 'domain/shared/core';
import {
  IRouterQueueService,
  RouterConnection,
  SuspensionQueue,
  SUSPENSION_QUEUE_PREFIX
} from 'application/service-enforcement/interfaces';
import { ILogger } from 'application/shared/interfaces';

const SUSPENSION_MAX_LIMIT = '1k/1k';
const CONNECT_TIMEOUT_SECONDS = 10;

interface QueuePrintRow {
  '.id'?: string;
  name?: string;
  target?: string;
}

export class RouterOsQueueService implements IRouterQueueService {
  constructor(private readonly logger?: ILogger) {}

  async listSuspensionQueues(
    connection: RouterConnection
  ): Promise<Result<SuspensionQueue[]>> {
    return this.withClient(connection, async (client) => {
      const rows = (await client.write(
        '/queue/simple/print'
      )) as QueuePrintRow[];
      return rows
        .filter((row) =>
          (row.name ?? '').startsWith(SUSPENSION_QUEUE_PREFIX)
        )
        .map((row) => ({
          name: row.name ?? '',
          targetIp: stripCidr(row.target ?? '')
        }));
    });
  }

  async addSuspensionQueue(
    connection: RouterConnection,
    queue: SuspensionQueue
  ): Promise<Result<void>> {
    return this.withClient(connection, async (client) => {
      await client.write('/queue/simple/add', [
        `=name=${queue.name}`,
        `=target=${queue.targetIp}/32`,
        `=max-limit=${SUSPENSION_MAX_LIMIT}`
      ]);
    });
  }

  async removeSuspensionQueue(
    connection: RouterConnection,
    name: string
  ): Promise<Result<void>> {
    return this.withClient(connection, async (client) => {
      const rows = (await client.write('/queue/simple/print', [
        `?name=${name}`
      ])) as QueuePrintRow[];
      // already gone — removal is idempotent
      if (rows.length === 0 || !rows[0]!['.id']) return;
      await client.write('/queue/simple/remove', [
        `=.id=${rows[0]!['.id']}`
      ]);
    });
  }

  // connect → run → close per operation: the reconciler cadence is slow
  // enough that managing a persistent socket is not worth the failure modes
  private async withClient<T>(
    connection: RouterConnection,
    operation: (client: RouterOSAPI) => Promise<T>
  ): Promise<Result<T>> {
    const client = new RouterOSAPI({
      host: connection.host,
      port: connection.port,
      user: connection.username,
      password: connection.password,
      timeout: CONNECT_TIMEOUT_SECONDS
    });

    try {
      await client.connect();
      const value = await operation(client);
      return Result.ok(value);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger?.warn('[RouterOsQueueService] operation failed', {
        host: connection.host,
        error: message
      });
      return Result.fail(`RouterOS API error: ${message}`);
    } finally {
      if (client.connected) {
        await client.close().catch(() => undefined);
      }
    }
  }
}

function stripCidr(target: string): string {
  // /queue/simple target can be a comma-separated list; suspension queues
  // are always created with a single /32 target
  return target.split(',')[0]!.replace(/\/\d+$/, '');
}
