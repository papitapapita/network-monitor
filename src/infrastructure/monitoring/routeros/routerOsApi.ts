import { Channel, RouterOSAPI } from 'node-routeros';

type PacketHandler = (packet: string[]) => void;

// RouterOS 7.18 and later answer a command with no rows `!empty`, then
// `!done`. node-routeros (1.6.9 included) knows no `!empty`: it throws from an
// event handler, out of reach of any catch, and the process dies. Skipping it
// lets the `!done` after it finish the command with no rows.
const proto = Channel.prototype as unknown as {
  processPacket: PacketHandler;
};
const processPacket = proto.processPacket;
proto.processPacket = function (
  this: Channel,
  packet: string[]
): void {
  if (packet[0] === '!empty') return;
  processPacket.call(this, packet);
};

export { RouterOSAPI };
