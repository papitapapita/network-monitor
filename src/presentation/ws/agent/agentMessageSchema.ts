import { z } from 'zod';
import { AgentMessage } from 'agent/protocol';

const epochMs = z.number().int().nonnegative();
const version = z.string().trim().min(1).max(32);

const pingResult = z.union([
  z.object({
    id: z.string().min(1).max(64),
    d: z.number().int().nonnegative(),
    at: epochMs,
    reachable: z.boolean(),
    latencyMs: z.number().nonnegative().nullable(),
    attempts: z.number().int().positive()
  }),
  z.object({
    id: z.string().min(1).max(64),
    d: z.number().int().nonnegative(),
    at: epochMs,
    probeError: z.string().max(500),
    attempts: z.number().int().positive()
  })
]);

const agentMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    // Any version passes here, however old, so the session can answer it
    // with "update required" (R18) instead of a bare protocol error.
    protocolVersion: z.number().int().nonnegative(),
    agentVersion: version,
    sentAt: epochMs
  }),
  z.object({
    type: z.literal('heartbeat'),
    agentVersion: version,
    sentAt: epochMs
  }),
  z.object({
    type: z.literal('config.ack'),
    version: z.string().min(1).max(64)
  }),
  z.object({
    type: z.literal('results'),
    batchId: z.string().min(1).max(64),
    results: z.array(pingResult).max(5000)
  })
]);

export function parseAgentMessage(raw: string): AgentMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = agentMessage.safeParse(json);
  return parsed.success ? (parsed.data as AgentMessage) : null;
}
