import { Result } from 'domain/shared/core';
import {
  IRouterHostReader,
  RouterHostsReading,
  RouterPortConnection
} from 'application/device-monitoring/interfaces';

// Stands in for a MikroTik's bridge host, ARP and lease tables: answers what
// the test set per host, and records every read.
export class FakeRouterHostReader implements IRouterHostReader {
  readonly reads: RouterPortConnection[] = [];
  private readonly answers = new Map<
    string,
    Result<RouterHostsReading>
  >();

  answer(host: string, result: Result<RouterHostsReading>): void {
    this.answers.set(host, result);
  }

  serve(host: string, reading: Partial<RouterHostsReading>): void {
    this.answer(
      host,
      Result.ok({
        ports: [],
        bridgeHosts: [],
        arp: [],
        leases: [],
        ...reading
      })
    );
  }

  reset(): void {
    this.reads.length = 0;
    this.answers.clear();
  }

  async read(
    connection: RouterPortConnection
  ): Promise<Result<RouterHostsReading>> {
    this.reads.push(connection);
    return (
      this.answers.get(connection.host) ??
      Result.fail(`No answer set for ${connection.host}`)
    );
  }
}
