import { RouterSystemReadingProps } from '../props';

export const ROUTER_AUDIT_FINDING_CODES = [
  'FIRMWARE_BEHIND',
  'PLAINTEXT_SERVICE',
  'UNRESTRICTED_SERVICE',
  'ADMIN_USER',
  'DISCOVERY_ON_ALL_INTERFACES'
] as const;
export type RouterAuditFindingCode =
  (typeof ROUTER_AUDIT_FINDING_CODES)[number];

export const ROUTER_AUDIT_PARTS = [
  'SERVICES',
  'USERS',
  'DISCOVERY'
] as const;
export type RouterAuditPart = (typeof ROUTER_AUDIT_PARTS)[number];

export interface RouterAuditFinding {
  code: RouterAuditFindingCode;
  // the IP service a service finding is about
  service: string | null;
  port: number | null;
}

export interface RouterAuditResult {
  findings: RouterAuditFinding[];
  // what the router did not let the app read, so was not checked
  unchecked: RouterAuditPart[];
}

// MON-182: services that send passwords in the clear.
export const PLAINTEXT_SERVICES: readonly string[] = [
  'telnet',
  'ftp',
  'www'
];
const ANYWHERE = ['0.0.0.0/0', '::/0'];

// MON-181..185: what is worth fixing on a router, judged from its last
// reading. Nothing here raises an alert; the audit is a list.
export class RouterAudit {
  static of(reading: RouterSystemReadingProps): RouterAuditResult {
    const findings: RouterAuditFinding[] = [];
    const unchecked: RouterAuditPart[] = [];

    if (
      reading.currentFirmware !== null &&
      reading.upgradeFirmware !== null &&
      reading.currentFirmware !== reading.upgradeFirmware
    ) {
      findings.push({
        code: 'FIRMWARE_BEHIND',
        service: null,
        port: null
      });
    }

    const security = reading.security;
    const services = security?.services ?? null;
    if (services === null) unchecked.push('SERVICES');
    else {
      const enabled = services.filter((s) => s.enabled);
      for (const s of enabled) {
        if (PLAINTEXT_SERVICES.includes(s.name)) {
          findings.push(serviceFinding('PLAINTEXT_SERVICE', s));
        }
      }
      for (const s of enabled) {
        if (s.allowedAddresses.every((a) => ANYWHERE.includes(a))) {
          findings.push(serviceFinding('UNRESTRICTED_SERVICE', s));
        }
      }
    }

    const userNames = security?.userNames ?? null;
    if (userNames === null) unchecked.push('USERS');
    else if (userNames.includes('admin')) {
      findings.push({
        code: 'ADMIN_USER',
        service: null,
        port: null
      });
    }

    const discovery = security?.discoveryInterfaceList ?? null;
    if (discovery === null) unchecked.push('DISCOVERY');
    else if (discovery === 'all') {
      findings.push({
        code: 'DISCOVERY_ON_ALL_INTERFACES',
        service: null,
        port: null
      });
    }

    return { findings: distinct(findings), unchecked };
  }

  // MON-186: 6.49.10 < 7.9 < 7.21.4; a pre-release (7.22beta3, 7.22rc1)
  // comes before its release. Null (unknown) sorts last.
  static compareVersions(a: string | null, b: string | null): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    const left = versionParts(a);
    const right = versionParts(b);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const diff = (left[i] ?? 0) - (right[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }
}

function distinct(
  findings: RouterAuditFinding[]
): RouterAuditFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.code}|${f.service}|${f.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function serviceFinding(
  code: RouterAuditFindingCode,
  service: { name: string; port: number | null }
): RouterAuditFinding {
  return { code, service: service.name, port: service.port };
}

const PRE_RELEASE: Record<string, number> = {
  alpha: -3,
  beta: -2,
  rc: -1
};

// 7.22beta3 → [7, 22, -2, 3]: a release counts as a 0 after its numbers,
// so a beta (-2) and rc (-1) sort below it.
function versionParts(version: string): number[] {
  const match = /^(\d+(?:\.\d+)*)(?:(alpha|beta|rc)(\d*))?/.exec(
    version
  );
  if (!match) return [];
  const parts = match[1]!.split('.').map(Number);
  if (match[2]) {
    parts.push(PRE_RELEASE[match[2]]!, Number(match[3] || 0));
  }
  return parts;
}
