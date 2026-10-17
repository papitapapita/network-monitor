import { Result } from 'domain/shared/core';
import { PoeMode, PoeStatus } from 'domain/power-control';
import {
  IPoeSwitchReader,
  PoePortReading,
  PoeSwitchConnection,
  PoeSwitchReading
} from 'application/power-control/interfaces';

// Stands in for a switch's RouterOS API or SwOS web UI: answers what the test
// set per host, and records every read.
export class FakePoeSwitchReader implements IPoeSwitchReader {
  readonly reads: PoeSwitchConnection[] = [];
  private readonly answers = new Map<
    string,
    Result<PoeSwitchReading>
  >();

  answer(host: string, result: Result<PoeSwitchReading>): void {
    this.answers.set(host, result);
  }

  serve(
    host: string,
    ports: PoePortReading[],
    version = '7.15.3'
  ): void {
    this.answer(host, Result.ok({ firmwareVersion: version, ports }));
  }

  reset(): void {
    this.reads.length = 0;
    this.answers.clear();
  }

  async read(
    connection: PoeSwitchConnection
  ): Promise<Result<PoeSwitchReading>> {
    this.reads.push(connection);
    return (
      this.answers.get(connection.host) ??
      Result.fail(`No answer set for ${connection.host}`)
    );
  }
}

export function poweredPort(
  port: string,
  label: string,
  powerWatts = 6.1
): PoePortReading {
  return {
    port,
    label,
    mode: PoeMode.AUTO,
    status: PoeStatus.POWERED,
    powerWatts,
    voltage: 24.1
  };
}
