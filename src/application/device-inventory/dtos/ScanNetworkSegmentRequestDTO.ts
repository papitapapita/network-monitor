/**
 * ScanNetworkSegmentRequestDTO
 *
 * Input DTO for the ScanNetworkSegmentUseCase.
 *
 * API Endpoint:
 * - POST /api/network/scan
 *
 * Validation Rules:
 * - segment: Required. IPv4 CIDR notation (e.g. "192.168.1.0/24").
 *   Maximum range: /22 (1024 usable hosts).
 *
 * @example
 * ```json
 * { "segment": "192.168.1.0/24" }
 * ```
 */
export interface ScanNetworkSegmentRequestDTO {
  segment: string;
}
