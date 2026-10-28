import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { isIPv4 } from 'net';
import { promisify } from 'util';

const run = promisify(execFile);

const MAC_SHAPE = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

// The whole ARP table at once, IP → MAC (AGT-121). Windows prints `arp -a`
// in the PC's language, so a row is found by its shape — an IPv4 address and
// a MAC on one line — never by its headings.
export class ArpTableReader {
  async read(): Promise<Map<string, string>> {
    if (process.platform === 'linux') {
      return parseArpTable(await readFile('/proc/net/arp', 'utf8'));
    }
    const { stdout } = await run('arp', ['-a'], {
      windowsHide: true,
      timeout: 10_000
    });
    return parseArpTable(stdout);
  }
}

export function parseArpTable(text: string): Map<string, string> {
  const table = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    const ip = tokens.find((t) => isIPv4(t));
    const raw = tokens.find((t) => MAC_SHAPE.test(t));
    if (!ip || !raw) continue;
    const mac = raw.replace(/-/g, ':').toUpperCase();
    if (!isUnicast(mac) || table.has(ip)) continue;
    table.set(ip, mac);
  }
  return table;
}

// Drops Linux's unresolved 00:00:00:00:00:00, broadcast, and the multicast
// rows Windows lists for 224.x and 239.x.
function isUnicast(mac: string): boolean {
  if (mac === '00:00:00:00:00:00') return false;
  return (parseInt(mac.slice(0, 2), 16) & 1) === 0;
}
