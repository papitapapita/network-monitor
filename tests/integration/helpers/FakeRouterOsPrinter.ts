import { Result } from 'domain/shared/core';
import {
  IRouterOsPrinter,
  RouterOsCommand,
  RouterOsPrintAnswer,
  RouterOsRow,
  RouterPortConnection
} from 'application/device-monitoring/interfaces';

type Served = Record<string, RouterOsRow[]>;

// Stands in for a MikroTik's RouterOS API at the command level: answers the
// rows the test set per host and command, "no such command" for the rest,
// and records every batch.
export class FakeRouterOsPrinter implements IRouterOsPrinter {
  readonly batches: {
    connection: RouterPortConnection;
    commands: RouterOsCommand[];
  }[] = [];
  private readonly routers = new Map<string, Served | string>();

  serve(host: string, rows: Served): void {
    this.routers.set(host, rows);
  }

  // The router cannot be logged into.
  refuse(host: string, error: string): void {
    this.routers.set(host, error);
  }

  reset(): void {
    this.batches.length = 0;
    this.routers.clear();
  }

  async print(
    connection: RouterPortConnection,
    commands: RouterOsCommand[]
  ): Promise<Result<RouterOsPrintAnswer[]>> {
    this.batches.push({ connection, commands });
    const router = this.routers.get(connection.host);
    if (router === undefined) {
      return Result.fail(`No answer set for ${connection.host}`);
    }
    if (typeof router === 'string') return Result.fail(router);
    return Result.ok(
      commands.map((c) =>
        router[c.command]
          ? { rows: router[c.command]! }
          : { error: 'no such command' }
      )
    );
  }
}

// What an RB4011 on RouterOS 7 answers, with the given identity and serial.
export function rb4011(
  identity = 'Core-Insetel',
  serial = 'D4440E1A2B3C'
): Served {
  return {
    '/system/identity/print': [{ name: identity }],
    '/system/resource/print': [
      {
        uptime: '1d2h',
        version: '7.15.3 (stable)',
        'cpu-load': '9',
        'free-memory': '800000000',
        'total-memory': '1073741824',
        'free-hdd-space': '400000000',
        'total-hdd-space': '536870912',
        'board-name': 'RB4011iGS+'
      }
    ],
    '/system/routerboard/print': [
      {
        model: 'RB4011iGS+',
        'serial-number': serial,
        'current-firmware': '7.15.3',
        'upgrade-firmware': '7.15.3'
      }
    ],
    '/system/health/print': [
      { name: 'voltage', value: '24.1', type: 'V' },
      { name: 'temperature', value: '41', type: 'C' }
    ],
    '/interface/ethernet/print': [
      {
        name: 'ether1',
        'default-name': 'ether1',
        'orig-mac-address': 'DC:2C:6E:00:00:01'
      }
    ]
  };
}

// The security reads (MON-180) of a router left close to factory settings:
// telnet and an unrestricted API on, the admin user, discovery everywhere.
export function factorySecurity(): Served {
  return {
    '/ip/service/print': [
      { name: 'telnet', port: '23', address: '', disabled: 'false' },
      {
        name: 'winbox',
        port: '8291',
        address: '10.0.0.0/24',
        disabled: 'false'
      },
      { name: 'api', port: '8728', address: '', disabled: 'false' },
      { name: 'ftp', port: '21', address: '', disabled: 'true' }
    ],
    '/user/print': [{ name: 'admin', disabled: 'false' }],
    '/ip/neighbor/discovery-settings/print': [
      { 'discover-interface-list': 'all' }
    ]
  };
}
