import { Result } from 'domain/shared/core';
import { RouterPortConnection } from './IRouterPortReader';

export type RouterOsRow = Record<string, string>;

// One read-only RouterOS API command, e.g. `/system/resource/print`, with
// its `=.proplist=…` or `?query` words.
export interface RouterOsCommand {
  command: string;
  params: string[];
}

// One command's answer: its rows, or why that command alone failed.
export type RouterOsPrintAnswer =
  | { rows: RouterOsRow[] }
  | { error: string };

// AGT-123: runs a batch of read-only commands in one login, on site from
// this server and off site through the router's agent. Fails as a whole only
// when the router cannot be logged into; one refused command answers with
// its error and the rest still run. Changes nothing on the router.
export interface IRouterOsPrinter {
  print(
    connection: RouterPortConnection,
    commands: RouterOsCommand[]
  ): Promise<Result<RouterOsPrintAnswer[]>>;
}
