import { Result } from 'domain/shared/core';
import {
  InterfaceTrafficReading,
  IRouterTrafficReader,
  RouterConnectionTarget
} from 'application/device-monitoring/interfaces';

// Stands in for a router's RouterOS API: answers what the test set per host,
// and records every read.
export class FakeRouterTrafficReader implements IRouterTrafficReader {
  readonly reads: RouterConnectionTarget[] = [];
  released = 0;
  private readonly answers = new Map<
    string,
    Result<InterfaceTrafficReading[]>
  >();

  answer(
    host: string,
    result: Result<InterfaceTrafficReading[]>
  ): void {
    this.answers.set(host, result);
  }

  async read(
    router: RouterConnectionTarget
  ): Promise<Result<InterfaceTrafficReading[]>> {
    this.reads.push(router);
    return (
      this.answers.get(router.host) ??
      Result.fail(`No answer set for ${router.host}`)
    );
  }

  async releaseAll(): Promise<void> {
    this.released++;
  }
}
