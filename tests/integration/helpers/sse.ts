import http from 'http';
import { AddressInfo } from 'net';
import { Application } from 'express';

export interface SseResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  // parsed `event:`/`data:` frames; comment frames (`: ping`) are skipped
  events: { event: string; data: unknown }[];
  // set instead of events when the server answered with JSON rather than a stream
  body: unknown;
}

/**
 * Opens a real socket against the app and reads the SSE stream until
 * `expectEvents` frames have arrived, then closes it.
 *
 * Supertest buffers whole responses, so it can never return from a connection
 * the server deliberately holds open — this helper exists for that reason.
 */
export async function readSseStream(
  app: Application,
  path: string,
  options: {
    token?: string;
    bearer?: boolean;
    expectEvents?: number;
    timeoutMs?: number;
  } = {}
): Promise<SseResponse> {
  const {
    token,
    bearer = false,
    expectEvents = 1,
    timeoutMs = 5000
  } = options;

  const server = http.createServer(app);
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', resolve)
  );
  const { port } = server.address() as AddressInfo;

  const url =
    token && !bearer
      ? `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : path;

  try {
    return await new Promise<SseResponse>((resolve, reject) => {
      const req = http.get(
        {
          host: '127.0.0.1',
          port,
          path: url,
          headers:
            token && bearer
              ? { Authorization: `Bearer ${token}` }
              : {}
        },
        (res) => {
          let buffer = '';
          const events: SseResponse['events'] = [];

          const finish = (): void => {
            clearTimeout(timer);
            res.destroy();
            req.destroy();
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              events,
              body: parseJson(buffer)
            });
          };

          const timer = setTimeout(() => {
            clearTimeout(timer);
            res.destroy();
            req.destroy();
            reject(
              new Error(
                `Timed out after ${timeoutMs}ms waiting for ${expectEvents} SSE event(s); got ${events.length}. Buffer: ${buffer}`
              )
            );
          }, timeoutMs);

          // a non-stream answer is a complete JSON body, not frames
          const isStream = (
            res.headers['content-type'] ?? ''
          ).includes('text/event-stream');

          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            buffer += chunk;
            if (!isStream) return;

            let sep = buffer.indexOf('\n\n');
            while (sep !== -1) {
              const frame = buffer.slice(0, sep);
              buffer = buffer.slice(sep + 2);

              const parsed = parseFrame(frame);
              if (parsed) events.push(parsed);

              sep = buffer.indexOf('\n\n');
            }

            if (events.length >= expectEvents) finish();
          });

          res.on('end', finish);
        }
      );

      req.on('error', reject);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function parseFrame(
  frame: string
): { event: string; data: unknown } | null {
  const lines = frame.split('\n');
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(':')) continue; // heartbeat / retry comment
    if (line.startsWith('event: ')) event = line.slice(7);
    if (line.startsWith('data: ')) dataLines.push(line.slice(6));
  }

  if (event === null || dataLines.length === 0) return null;
  return { event, data: parseJson(dataLines.join('\n')) };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
