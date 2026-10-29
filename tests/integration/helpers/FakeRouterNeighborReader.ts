import { Result } from 'domain/shared/core';
import {
  IRouterNeighborReader,
  RouterNeighborReading,
  RouterNeighborsReading,
  RouterPortConnection
} from 'application/device-monitoring/interfaces';

// Stands in for a MikroTik's neighbour table: answers what the test set per
// host, and records every read.
export class FakeRouterNeighborReader
  implements IRouterNeighborReader
{
  readonly reads: RouterPortConnection[] = [];
  private readonly answers = new Map<
    string,
    Result<RouterNeighborsReading>
  >();

  answer(host: string, result: Result<RouterNeighborsReading>): void {
    this.answers.set(host, result);
  }

  serve(
    host: string,
    neighbors: RouterNeighborReading[],
    ports: { name: string; comment: string | null }[] = []
  ): void {
    this.answer(host, Result.ok({ ports, neighbors }));
  }

  reset(): void {
    this.reads.length = 0;
    this.answers.clear();
  }

  async read(
    connection: RouterPortConnection
  ): Promise<Result<RouterNeighborsReading>> {
    this.reads.push(connection);
    return (
      this.answers.get(connection.host) ??
      Result.fail(`No answer set for ${connection.host}`)
    );
  }
}

export function neighbor(
  port: string,
  overrides: Partial<RouterNeighborReading> = {}
): RouterNeighborReading {
  return {
    port,
    macAddress: null,
    ipAddress: null,
    identity: null,
    platform: null,
    board: null,
    version: null,
    remoteInterface: 'br0',
    ...overrides
  };
}
