import { RouterOSAPI } from 'node-routeros';
import { Result } from 'domain/shared/core';
import type {
  IRouterOsPrinter,
  RouterOsCommand,
  RouterOsPrintAnswer,
  RouterOsRow,
  RouterPortConnection
} from 'application/device-monitoring/interfaces';
import type { ILogger } from 'application/shared/interfaces';
import {
  MAX_ROUTEROS_PRINT_COMMANDS,
  MAX_ROUTEROS_PRINT_ROWS,
  MAX_ROUTEROS_VALUE_LENGTH,
  refuseRouterOsCommand
} from 'agent/protocol';
import { fromRouterOsText } from './routerOsText';

type RawRow = Record<string, unknown>;

export interface RouterOsSession {
  write(command: string, params?: string[]): Promise<RawRow[]>;
  close(): Promise<void>;
}

export type RouterOsConnect = (
  connection: RouterPortConnection,
  timeoutSeconds: number
) => Promise<RouterOsSession>;

const READ_TIMEOUT_MS = 15_000;

// AGT-123: one login, the allowed commands in turn, closed after. The same
// class runs on this server and inside the agent, so both refuse the same
// commands.
export class RouterOsApiPrinter implements IRouterOsPrinter {
  constructor(
    private readonly logger?: ILogger,
    private readonly connect: RouterOsConnect = connectWithRouterOsApi,
    private readonly timeoutMs: number = READ_TIMEOUT_MS
  ) {}

  async print(
    connection: RouterPortConnection,
    commands: RouterOsCommand[]
  ): Promise<Result<RouterOsPrintAnswer[]>> {
    if (commands.length > MAX_ROUTEROS_PRINT_COMMANDS) {
      return Result.fail('Too many RouterOS commands in one request');
    }
    let session: RouterOsSession | null = null;
    try {
      session = await this.connect(
        connection,
        Math.ceil(this.timeoutMs / 1000)
      );
      const answers = await withTimeout(
        runAll(session, commands),
        this.timeoutMs
      );
      return Result.ok(answers);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger?.warn('[RouterOsApiPrinter] read failed', {
        host: connection.host,
        error: message
      });
      return Result.fail(`RouterOS API error: ${message}`);
    } finally {
      await session?.close().catch(() => undefined);
    }
  }
}

async function runAll(
  session: RouterOsSession,
  commands: RouterOsCommand[]
): Promise<RouterOsPrintAnswer[]> {
  const answers: RouterOsPrintAnswer[] = [];
  let rowsLeft = MAX_ROUTEROS_PRINT_ROWS;
  for (const command of commands) {
    const refused = refuseRouterOsCommand(command);
    if (refused) {
      answers.push({ error: refused });
      continue;
    }
    try {
      const rows = (
        await session.write(command.command, command.params)
      ).map(toRow);
      if (rows.length > rowsLeft) {
        answers.push({ error: 'Too many rows to answer' });
        continue;
      }
      rowsLeft -= rows.length;
      answers.push({ rows });
    } catch (error) {
      answers.push({
        error: (error instanceof Error
          ? error.message
          : String(error)
        ).slice(0, 500)
      });
    }
  }
  return answers;
}

// The API answers strings, but a `!re` word without a value comes back as
// undefined; it is dropped rather than sent as "undefined". Values are cut to
// what an agent answer may carry, so one long comment cannot void the batch.
// UTF-8 text is restored first (MON-200).
function toRow(raw: RawRow): RouterOsRow {
  const row: RouterOsRow = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      row[key] = fromRouterOsText(value).slice(
        0,
        MAX_ROUTEROS_VALUE_LENGTH
      );
    }
  }
  return row;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer within ${ms} ms`)),
      ms
    );
  });
  return Promise.race([work, timeout]).finally(() =>
    clearTimeout(timer)
  );
}

async function connectWithRouterOsApi(
  connection: RouterPortConnection,
  timeoutSeconds: number
): Promise<RouterOsSession> {
  const client = new RouterOSAPI({
    host: connection.host,
    port: connection.login.apiPort,
    user: connection.login.username,
    password: connection.login.password,
    timeout: timeoutSeconds
  });
  // a socket dropped after login is emitted as 'error'; unheard, it would
  // take the whole process down
  client.on('error', () => undefined);
  await client.connect();
  return {
    write: async (command, params) =>
      (await client.write(command, params ?? [])) as RawRow[],
    close: async () => {
      if (client.connected) await client.close();
    }
  };
}
