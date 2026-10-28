import { z } from 'zod';

/**
 * Zod validation schemas for network scan HTTP endpoints.
 *
 * Covered endpoints:
 * - POST /api/network/scan  (scanNetworkSegmentSchema)
 */

// =====================================
// SCAN SCHEMA
// =====================================

/**
 * Schema for POST /api/network/scan
 *
 * Validates the CIDR segment to probe (e.g. "192.168.1.0/24") and the agent
 * to probe it from, if any. CIDR format and range limits, and whether the
 * agent exists, are enforced inside the use case.
 */
export const scanNetworkSegmentSchema = z.object({
  body: z.object({
    segment: z.string().min(1, 'segment cannot be empty'),
    agentId: z.string().max(64).nullable().optional()
  })
});

// =====================================
// TYPE EXPORTS
// =====================================

export type ScanNetworkSegmentInput = z.infer<
  typeof scanNetworkSegmentSchema
>['body'];
