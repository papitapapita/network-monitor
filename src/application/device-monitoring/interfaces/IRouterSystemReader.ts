import { Result } from 'domain/shared/core';
import { RouterSystemReadingProps } from 'domain/device-monitoring/props';
import { RouterPortConnection } from './IRouterPortReader';

export type RouterSystemReading = RouterSystemReadingProps;

// MON-160: a MikroTik's identity, hardware, versions and health, read once.
// Changes nothing on the router.
export interface IRouterSystemReader {
  read(
    connection: RouterPortConnection
  ): Promise<Result<RouterSystemReading>>;
}
