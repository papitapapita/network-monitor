import ping from 'ping';
import { PingService } from '../../../../src/infrastructure/monitoring/ping/PingService';

// The `ping` package parses the system ping's output. These run its Windows
// parser on real ping.exe output with the options PingService passes, so a
// Spanish PC (ADR 0002) reads the same as an English one.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const parserFactory = require('ping/lib/parser/factory');

type ProbeOptions = Parameters<typeof ping.promise.probe>[1];

function optionsPassedByPingService(): Promise<ProbeOptions> {
  const probe = jest
    .spyOn(ping.promise, 'probe')
    .mockResolvedValue({ alive: true, time: 1 } as never);
  return new PingService()
    .ping('10.0.0.1')
    .then(() => probe.mock.calls[0][1]);
}

function parseWindows(options: ProbeOptions, lines: string[]) {
  const parser = parserFactory.createParser('10.0.0.1', 'win32', {
    ...options,
    v6: false
  });
  lines.forEach(parser.eat, parser);
  return parser.getResult() as {
    alive: boolean;
    time: number | 'unknown';
  };
}

describe('PingService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('[AGT-061] reads latency from Spanish Windows output', async () => {
    const options = await optionsPassedByPingService();

    const result = parseWindows(options, [
      'Haciendo ping a 10.0.0.1 con 32 bytes de datos:',
      'Respuesta desde 10.0.0.1: bytes=32 tiempo=7ms TTL=64',
      '',
      'Estadísticas de ping para 10.0.0.1:',
      '    Paquetes: enviados = 1, recibidos = 1, perdidos = 0',
      '    (0% perdidos),'
    ]);

    expect(result.alive).toBe(true);
    expect(result.time).toBe(7);
  });

  it('[AGT-061] reads latency from English Windows output', async () => {
    const options = await optionsPassedByPingService();

    const result = parseWindows(options, [
      'Pinging 10.0.0.1 with 32 bytes of data:',
      'Reply from 10.0.0.1: bytes=32 time=12ms TTL=64'
    ]);

    expect(result.time).toBe(12);
  });

  it('[AGT-061] a reply under a millisecond reads as 1 ms', async () => {
    const options = await optionsPassedByPingService();

    const result = parseWindows(options, [
      'Haciendo ping a 10.0.0.1 con 32 bytes de datos:',
      'Respuesta desde 10.0.0.1: bytes=32 tiempo<1m TTL=64'
    ]);

    expect(result.alive).toBe(true);
    expect(result.time).toBe(1);
  });

  it('[AGT-061] "destination host unreachable" from a router is not a reply', async () => {
    const options = await optionsPassedByPingService();

    const result = parseWindows(options, [
      'Haciendo ping a 10.0.0.9 con 32 bytes de datos:',
      'Respuesta desde 10.0.0.2: Host de destino inaccesible.',
      '',
      'Estadísticas de ping para 10.0.0.9:',
      '    Paquetes: enviados = 1, recibidos = 1, perdidos = 0'
    ]);

    expect(result.alive).toBe(false);
  });

  it('maps an alive probe to reachable with its latency', async () => {
    jest
      .spyOn(ping.promise, 'probe')
      .mockResolvedValue({ alive: true, time: 4.2 } as never);

    const result = await new PingService().ping('10.0.0.1');

    expect(result.value).toEqual({
      isReachable: true,
      latencyMs: 4.2
    });
  });

  it('maps a dead probe to unreachable with no latency', async () => {
    jest
      .spyOn(ping.promise, 'probe')
      .mockResolvedValue({ alive: false, time: 'unknown' } as never);

    const result = await new PingService().ping('10.0.0.1');

    expect(result.value).toEqual({
      isReachable: false,
      latencyMs: null
    });
  });

  it('a ping that cannot run is a failure, not an unreachable device', async () => {
    jest
      .spyOn(ping.promise, 'probe')
      .mockRejectedValue(new Error('spawn ping ENOENT'));

    const result = await new PingService().ping('10.0.0.1');

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('ENOENT');
  });
});
