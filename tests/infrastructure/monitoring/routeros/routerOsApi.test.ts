// Source: src/infrastructure/monitoring/routeros/routerOsApi.ts

import { Channel, Connector } from 'node-routeros';
import '../../../../src/infrastructure/monitoring/routeros/routerOsApi';

type PacketHandler = (packet: string[]) => void;

function makeChannel(): { channel: Channel; reply: PacketHandler } {
  let handler: PacketHandler = () => undefined;
  const connector = {
    read: (_tag: string, callback: PacketHandler) => {
      handler = callback;
    },
    write: () => undefined,
    stopRead: () => undefined
  } as unknown as Connector;
  return {
    channel: new Channel(connector),
    reply: (packet) => handler(packet)
  };
}

describe('routerOsApi', () => {
  it("[MON-202] reads RouterOS 7's !empty reply as no rows instead of crashing", async () => {
    const { channel, reply } = makeChannel();
    const rows = channel.write(['/ip/dhcp-server/lease/print']);

    expect(() => reply(['!empty'])).not.toThrow();
    reply(['!done']);

    await expect(rows).resolves.toEqual([]);
  });

  it('[MON-202] still reads rows as before', async () => {
    const { channel, reply } = makeChannel();
    const rows = channel.write(['/ip/arp/print']);

    reply(['!re', '=address=10.0.7.21']);
    reply(['!done']);

    await expect(rows).resolves.toEqual([{ address: '10.0.7.21' }]);
  });
});
