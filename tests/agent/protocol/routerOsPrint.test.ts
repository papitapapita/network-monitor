// Source: src/agent/protocol/messages.ts (refuseRouterOsCommand)

import {
  ROUTEROS_PRINT_COMMANDS,
  refuseRouterOsCommand
} from '../../../src/agent/protocol';

describe('refuseRouterOsCommand', () => {
  it('[AGT-123] should allow every listed command without words', () => {
    for (const command of ROUTEROS_PRINT_COMMANDS) {
      if (command.endsWith('/monitor')) continue;
      expect(
        refuseRouterOsCommand({ command, params: [] })
      ).toBeNull();
    }
  });

  it('[AGT-123] should list only reads', () => {
    for (const command of ROUTEROS_PRINT_COMMANDS) {
      expect(command).toMatch(/\/(print|monitor)$/);
    }
  });

  it('[AGT-123] should refuse a command off the list', () => {
    expect(
      refuseRouterOsCommand({ command: '/system/reboot', params: [] })
    ).toBe('Command not allowed: /system/reboot');
    expect(
      refuseRouterOsCommand({
        command: '/ip/address/add',
        params: []
      })
    ).toMatch(/not allowed/);
  });

  it('[AGT-123] should allow property lists, queries and once', () => {
    expect(
      refuseRouterOsCommand({
        command: '/interface/ethernet/print',
        params: ['=.proplist=name,mac-address', '?disabled=false']
      })
    ).toBeNull();
    expect(
      refuseRouterOsCommand({
        command: '/interface/ethernet/monitor',
        params: ['=numbers=ether1,ether2', '=once=']
      })
    ).toBeNull();
  });

  it('[AGT-123] should refuse any other word', () => {
    expect(
      refuseRouterOsCommand({
        command: '/user/print',
        params: ['=password=x']
      })
    ).toBe('Word not allowed: =password=x');
  });

  it('[AGT-123] should refuse a monitor that would not stop', () => {
    expect(
      refuseRouterOsCommand({
        command: '/interface/ethernet/monitor',
        params: ['=numbers=ether1']
      })
    ).toBe('A monitor must answer once');
  });

  it('[AGT-123] should refuse too many words', () => {
    expect(
      refuseRouterOsCommand({
        command: '/ip/arp/print',
        params: Array.from({ length: 9 }, () => '=once=')
      })
    ).toBe('Too many command words');
  });
});
