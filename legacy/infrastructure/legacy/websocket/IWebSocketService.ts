/**
 * IWebSocketService
 *
 * Service interface for WebSocket real-time communication.
 *
 * REQ-002 (FR-002.9): Real-Time Updates via WebSocket
 * - Endpoint: /ws/devices/status-updates
 * - Requires authentication (JWT token)
 * - Supports multiple concurrent connections per user
 * - Critical events: Device status changes (ONLINE ↔ OFFLINE)
 * - Message delivery target: <2 seconds latency
 *
 * Features:
 * - Connection management (connect, disconnect, authentication)
 * - Message broadcasting (to all clients or specific users)
 * - Connection health monitoring
 * - Automatic cleanup of stale connections
 *
 * Implementation Notes:
 * - Single-server WebSocket (1,000 concurrent connections limit)
 * - Sticky sessions required in load-balanced environments
 * - For scaling >1,000 connections, migrate to Redis pub/sub
 */

/**
 * WebSocket message types for device status updates.
 * REQ-002: JSON format with type, deviceId, status, timestamp.
 */
export enum WebSocketMessageType {
  DEVICE_STATUS_CHANGED = 'DEVICE_STATUS_CHANGED',
  DEVICE_CREATED = 'DEVICE_CREATED',
  DEVICE_UPDATED = 'DEVICE_UPDATED',
  DEVICE_DELETED = 'DEVICE_DELETED',
  DEVICE_ACTIVATED = 'DEVICE_ACTIVATED',
  DEVICE_RESTORED = 'DEVICE_RESTORED',
  CONNECTION_ESTABLISHED = 'CONNECTION_ESTABLISHED',
  HEARTBEAT = 'HEARTBEAT'
}

/**
 * Base structure for all WebSocket messages.
 */
export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  payload: T;
  timestamp: string; // ISO 8601
}

/**
 * Device status change message payload.
 * REQ-002: Critical event requiring real-time push.
 */
export interface DeviceStatusChangedPayload {
  deviceId: string;
  previousStatus: string;
  newStatus: string;
  timestamp: string; // ISO 8601
}

/**
 * Device lifecycle event payloads.
 */
export interface DeviceLifecyclePayload {
  deviceId: string;
  deviceName: string | null;
  ipAddress: string;
  timestamp: string;
}

/**
 * Connection established confirmation payload.
 */
export interface ConnectionEstablishedPayload {
  connectionId: string;
  userId: string;
  timestamp: string;
}

/**
 * WebSocket connection metadata.
 */
export interface WebSocketConnection {
  id: string;
  userId: string;
  userRole?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  authenticated: boolean;
}

/**
 * WebSocket service interface.
 *
 * Provides real-time communication capabilities for device status updates.
 */
export interface IWebSocketService {
  /**
   * Initializes the WebSocket server.
   * Should be called once during application startup.
   *
   * @param port - Port number for WebSocket server (optional, uses HTTP server upgrade)
   * @param httpServer - HTTP server instance for upgrade handling
   */
  initialize(httpServer: any): Promise<void>;

  /**
   * Broadcasts a message to all connected clients.
   *
   * REQ-002: Used for critical device status changes.
   *
   * @param message - Message to broadcast
   */
  broadcast(message: WebSocketMessage): void;

  /**
   * Sends a message to specific user's connections.
   *
   * @param userId - Target user ID
   * @param message - Message to send
   */
  sendToUser(userId: string, message: WebSocketMessage): void;

  /**
   * Sends a message to a specific connection.
   *
   * @param connectionId - Target connection ID
   * @param message - Message to send
   */
  sendToConnection(connectionId: string, message: WebSocketMessage): void;

  /**
   * Gets all active connections.
   * Useful for monitoring and diagnostics.
   *
   * @returns Array of active connections
   */
  getActiveConnections(): WebSocketConnection[];

  /**
   * Gets connection count.
   * REQ-002: Monitor to alert if >800 (approaching 1,000 limit).
   *
   * @returns Number of active connections
   */
  getConnectionCount(): number;

  /**
   * Closes a specific connection.
   *
   * @param connectionId - Connection to close
   * @param reason - Reason for closure (logged)
   */
  closeConnection(connectionId: string, reason: string): void;

  /**
   * Closes all connections and shuts down WebSocket server.
   * Called during graceful shutdown.
   */
  shutdown(): Promise<void>;

  /**
   * Health check for WebSocket service.
   *
   * @returns True if service is healthy, false otherwise
   */
  isHealthy(): boolean;
}

/**
 * WebSocket event handler interface.
 *
 * Implemented by domain event handlers that push updates via WebSocket.
 */
export interface IWebSocketEventHandler {
  /**
   * Subscribes to domain events and broadcasts via WebSocket.
   *
   * @param webSocketService - WebSocket service instance
   */
  subscribe(webSocketService: IWebSocketService): void;

  /**
   * Unsubscribes from domain events.
   * Called during shutdown.
   */
  unsubscribe(): void;
}
