import { promises as fs } from 'fs';
import path from 'path';
import { ResultBuffer } from '../../../src/agent/results/ResultBuffer';
import { PingResultWire } from '../../../src/agent/protocol';
import { silentLogger, tempDir } from '../helpers';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('ResultBuffer', () => {
  let dir: string;
  let remove: () => void;
  let now: number;

  const open = () =>
    ResultBuffer.open(dir, silentLogger(), { now: () => now });
  const result = (id: string, at = now): PingResultWire => ({
    id,
    d: 1,
    at,
    reachable: true,
    latencyMs: 2,
    attempts: 1
  });
  const segmentFiles = () => fs.readdir(path.join(dir, 'results'));

  beforeEach(() => {
    ({ dir, remove } = tempDir());
    now = 100 * HOUR;
  });

  afterEach(() => remove());

  it('[AGT-063] sends the newest results first', async () => {
    const buffer = await open();
    buffer.add(result('old', now - 30 * MINUTE));
    buffer.add(result('older', now - 40 * MINUTE));
    buffer.add(result('live'));

    expect(buffer.take(2).map((r) => r.id)).toEqual([
      'live',
      'older'
    ]);
    expect(buffer.take(2).map((r) => r.id)).toEqual(['old']);
  });

  it('[AGT-064] a sent result stays buffered until acknowledged', async () => {
    const buffer = await open();
    buffer.add(result('a'));
    buffer.take(10);

    expect(buffer.size).toBe(1);
    expect(buffer.take(10)).toEqual([]);

    buffer.acknowledge(['a']);
    expect(buffer.size).toBe(0);
  });

  it('[AGT-064] a released result is sent again', async () => {
    const buffer = await open();
    buffer.add(result('a'));
    buffer.add(result('b'));
    buffer.take(10);

    buffer.releaseAll();

    expect(
      buffer
        .take(10)
        .map((r) => r.id)
        .sort()
    ).toEqual(['a', 'b']);
  });

  it('[AGT-064] survives a restart, including results sent but not acknowledged', async () => {
    const first = await open();
    first.add(result('a', now - 2 * MINUTE));
    first.add(result('b', now - MINUTE));
    first.add(result('c'));
    first.take(1);
    await first.close();

    const reopened = await open();

    expect(reopened.take(10).map((r) => r.id)).toEqual([
      'c',
      'b',
      'a'
    ]);
  });

  it('[AGT-064] an acknowledgement is not remembered across a restart; the backend dedups the resend', async () => {
    const first = await open();
    first.add(result('a'));
    first.add(result('b'));
    await first.persist();
    first.take(1);
    first.acknowledge(['b']);
    await first.close();

    const reopened = await open();

    expect(reopened.size).toBe(2);
  });

  it('[AGT-064] drops results older than 24 hours', async () => {
    const buffer = await open();
    buffer.add(result('stale', now - 25 * HOUR));
    buffer.add(result('fresh', now - 23 * HOUR));

    const dropped = buffer.prune();

    expect(dropped).toBe(1);
    expect(buffer.take(10).map((r) => r.id)).toEqual(['fresh']);
  });

  it('[AGT-064] drops what went past 24 hours while the agent was stopped', async () => {
    const first = await open();
    first.add(result('a'));
    await first.close();

    now += 25 * HOUR;
    const reopened = await open();

    expect(reopened.size).toBe(0);
    expect(await segmentFiles()).toEqual([]);
  });

  it('[AGT-064] deletes a segment file once all its results are acknowledged', async () => {
    const buffer = await open();
    buffer.add(result('a'));
    await buffer.persist();
    expect(await segmentFiles()).toHaveLength(1);

    now += 15 * MINUTE;
    buffer.take(10);
    buffer.acknowledge(['a']);
    await buffer.persist();

    expect(await segmentFiles()).toEqual([]);
  });

  it('[AGT-064] keeps the open segment until a later one takes over', async () => {
    const buffer = await open();
    buffer.add(result('a'));
    buffer.take(10);
    buffer.acknowledge(['a']);
    await buffer.persist();
    expect(await segmentFiles()).toHaveLength(1);

    now += 15 * MINUTE;
    buffer.prune();
    await buffer.persist();

    expect(await segmentFiles()).toEqual([]);
  });

  it('[AGT-064] skips a line cut short by a crash and keeps the rest', async () => {
    const buffer = await open();
    buffer.add(result('a'));
    await buffer.close();
    const [file] = await segmentFiles();
    await fs.appendFile(
      path.join(dir, 'results', file),
      '{"id":"b","d":'
    );

    const reopened = await open();

    expect(reopened.take(10).map((r) => r.id)).toEqual(['a']);
  });

  it('keeps one copy of a result added twice', async () => {
    const buffer = await open();
    buffer.add(result('a'));
    buffer.add(result('a'));

    expect(buffer.size).toBe(1);
  });

  it('[AGT-066] clear removes every buffered result, in memory and on disk', async () => {
    const buffer = await open();
    buffer.add(result('a'));
    await buffer.persist();

    await buffer.clear();

    expect(buffer.size).toBe(0);
    expect(await segmentFiles()).toEqual([]);
    expect((await open()).size).toBe(0);
  });
});
