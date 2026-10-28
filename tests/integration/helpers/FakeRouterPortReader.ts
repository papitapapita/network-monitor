import { Result } from 'domain/shared/core';
import {
  EthernetPortReading,
  IRouterPortReader,
  RouterPortConnection,
  RouterPortsReading
} from 'application/device-monitoring/interfaces';

// Stands in for a MikroTik's RouterOS API: answers what the test set per
// host, and records every read.
export class FakeRouterPortReader implements IRouterPortReader {
  readonly reads: RouterPortConnection[] = [];
  private readonly answers = new Map<
    string,
    Result<RouterPortsReading>
  >();

  answer(host: string, result: Result<RouterPortsReading>): void {
    this.answers.set(host, result);
  }

  serve(
    host: string,
    ports: EthernetPortReading[],
    identity = 'MikroTik'
  ): void {
    this.answer(host, Result.ok({ identity, ports }));
  }

  reset(): void {
    this.reads.length = 0;
    this.answers.clear();
  }

  async read(
    connection: RouterPortConnection
  ): Promise<Result<RouterPortsReading>> {
    this.reads.push(connection);
    return (
      this.answers.get(connection.host) ??
      Result.fail(`No answer set for ${connection.host}`)
    );
  }
}

export function linkedPort(
  name: string,
  rateMbps: number,
  comment: string | null = null
): EthernetPortReading {
  return { name, comment, linked: true, rateMbps, fullDuplex: true };
}

export function unlinkedPort(name: string): EthernetPortReading {
  return {
    name,
    comment: null,
    linked: false,
    rateMbps: null,
    fullDuplex: null
  };
}
