// Source: src/infrastructure/monitoring/network-scanner/ArpTableReader.ts

import { parseArpTable } from '../../../../src/infrastructure/monitoring/network-scanner/ArpTableReader';

const SPANISH_WINDOWS = [
  '',
  'Interfaz: 192.168.1.10 --- 0xb',
  '  Dirección de Internet          Dirección física      Tipo',
  '  192.168.1.1           dc-2c-6e-11-22-33     dinámico',
  '  192.168.1.20          f4-92-bf-aa-bb-cc     dinámico',
  '  192.168.1.255         ff-ff-ff-ff-ff-ff     estático',
  '  224.0.0.22            01-00-5e-00-00-16     estático',
  '  239.255.255.250       01-00-5e-7f-ff-fa     estático',
  ''
].join('\r\n');

const LINUX_PROC = [
  'IP address       HW type     Flags       HW address            Mask     Device',
  '10.0.0.1         0x1         0x2         dc:2c:6e:11:22:33     *        eth0',
  '10.0.0.7         0x1         0x0         00:00:00:00:00:00     *        eth0'
].join('\n');

describe('parseArpTable', () => {
  it('[AGT-121] reads a Spanish Windows `arp -a` by the shape of its rows', () => {
    expect(parseArpTable(SPANISH_WINDOWS)).toEqual(
      new Map([
        ['192.168.1.1', 'DC:2C:6E:11:22:33'],
        ['192.168.1.20', 'F4:92:BF:AA:BB:CC']
      ])
    );
  });

  it('[AGT-121] reads /proc/net/arp and skips unresolved entries', () => {
    expect(parseArpTable(LINUX_PROC)).toEqual(
      new Map([['10.0.0.1', 'DC:2C:6E:11:22:33']])
    );
  });

  it('[AGT-121] keeps the first MAC when an address is listed on two interfaces', () => {
    const text = [
      'Interfaz: 10.0.0.2 --- 0x4',
      '  10.0.0.1   aa-bb-cc-dd-ee-01   dinámico',
      'Interfaz: 10.0.0.3 --- 0x9',
      '  10.0.0.1   aa-bb-cc-dd-ee-02   dinámico'
    ].join('\r\n');

    expect(parseArpTable(text).get('10.0.0.1')).toBe(
      'AA:BB:CC:DD:EE:01'
    );
  });

  it('returns an empty table for text with no rows', () => {
    expect(parseArpTable('No se encontraron entradas ARP.')).toEqual(
      new Map()
    );
  });
});
