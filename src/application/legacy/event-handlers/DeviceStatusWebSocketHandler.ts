import {
  IWebSocketService,
  IWebSocketEventHandler,
  WebSocketMessageType,
  WebSocketMessage,
  DeviceStatusChangedPayload,
  DeviceLifecyclePayload
} from '../../infrastructure/websocket/IWebSocketService';
import { DomainEvents } from '../../domain/shared/core/DomainEvents';
import {
  NetworkDeviceStatusChangedEvent,
  NetworkDeviceCreatedEvent,
  NetworkDeviceUpdatedEvent,
  NetworkDeviceDeletedEvent
} from '../../domain/device-inventory/events';
import { NetworkDeviceActivatedEvent } from '../../domain/device-inventory/events/NetworkDeviceActivatedEvent';
import { NetworkDeviceRestoredEvent } from '../../domain/device-inventory/events/NetworkDeviceRestoredEvent';
import { ILogger } from '../interfaces/ILogger';

/**
 * DeviceStatusWebSocketHandler
 *
 * REQ-002 (FR-002.9): Domain event handler that broadcasts device status changes
 * and lifecycle events to connected WebSocket clients in real-time.
 *
 * Critical Events (Real-Time Push):
 * - Device status changes: ONLINE → OFFLINE, OFFLINE → ONLINE
 * - Device lifecycle: Created, Activated, Deleted, Restored
 *
 * Message Delivery Target: <2 seconds latency (NFR-002.4)
 *
 * Architecture:
 * - Subscribes to domain events via DomainEvents dispatcher
 * - Transforms domain events to WebSocket messages
 * - Broadcasts to all connected clients (broadcast pattern)
 * - Logged for audit trail
 *
 * Usage:
 * ```typescript
 * const handler = new DeviceStatusWebSocketHandler(logger);
 * handler.subscribe(webSocketService);
 * ```
 */
export class DeviceStatusWebSocketHandler
  implements IWebSocketEventHandler
{
  private webSocketService: IWebSocketService | null = null;
  private subscriptionHandles: Array<() => void> = [];

  constructor(private readonly logger: ILogger) {}

  /**
   * Subscribes to domain events and sets up WebSocket broadcasting.
   *
   * @param webSocketService - WebSocket service instance
   */
  public subscribe(webSocketService: IWebSocketService): void {
    this.webSocketService = webSocketService;

    // Subscribe to NetworkDeviceStatusChangedEvent
    const statusChangedHandle = DomainEvents.register(
      (event: NetworkDeviceStatusChangedEvent) =>
        this.handleStatusChanged(event),
      NetworkDeviceStatusChangedEvent.name
    );
    this.subscriptionHandles.push(statusChangedHandle);

    // Subscribe to NetworkDeviceCreatedEvent
    const createdHandle = DomainEvents.register(
      (event: NetworkDeviceCreatedEvent) =>
        this.handleDeviceCreated(event),
      NetworkDeviceCreatedEvent.name
    );
    this.subscriptionHandles.push(createdHandle);

    // Subscribe to NetworkDeviceUpdatedEvent
    const updatedHandle = DomainEvents.register(
      (event: NetworkDeviceUpdatedEvent) =>
        this.handleDeviceUpdated(event),
      NetworkDeviceUpdatedEvent.name
    );
    this.subscriptionHandles.push(updatedHandle);

    // Subscribe to NetworkDeviceDeletedEvent
    const deletedHandle = DomainEvents.register(
      (event: NetworkDeviceDeletedEvent) =>
        this.handleDeviceDeleted(event),
      NetworkDeviceDeletedEvent.name
    );
    this.subscriptionHandles.push(deletedHandle);

    // REQ-002: Subscribe to NetworkDeviceActivatedEvent
    const activatedHandle = DomainEvents.register(
      (event: NetworkDeviceActivatedEvent) =>
        this.handleDeviceActivated(event),
      NetworkDeviceActivatedEvent.name
    );
    this.subscriptionHandles.push(activatedHandle);

    // REQ-002: Subscribe to NetworkDeviceRestoredEvent
    const restoredHandle = DomainEvents.register(
      (event: NetworkDeviceRestoredEvent) =>
        this.handleDeviceRestored(event),
      NetworkDeviceRestoredEvent.name
    );
    this.subscriptionHandles.push(restoredHandle);

    this.logger.info(
      'DeviceStatusWebSocketHandler subscribed to domain events'
    );
  }

  /**
   * Unsubscribes from all domain events.
   * Called during graceful shutdown.
   */
  public unsubscribe(): void {
    this.subscriptionHandles.forEach((unsubscribe) => unsubscribe());
    this.subscriptionHandles = [];
    this.webSocketService = null;

    this.logger.info(
      'DeviceStatusWebSocketHandler unsubscribed from domain events'
    );
  }

  /**
   * Handles NetworkDeviceStatusChangedEvent.
   *
   * REQ-002: Critical event requiring real-time push.
   * Only broadcasts ONLINE/OFFLINE transitions.
   *
   * @private
   */
  private handleStatusChanged(
    event: NetworkDeviceStatusChangedEvent
  ): void {
    if (!this.webSocketService) {
      this.logger.warn(
        'WebSocket service not initialized, skipping status change broadcast'
      );
      return;
    }

    const { deviceId, previousStatus, newStatus, timestamp } = event;

    // REQ-002: Only broadcast critical status changes (ONLINE/OFFLINE)
    const isCriticalChange =
      previousStatus === 'ONLINE' ||
      newStatus === 'ONLINE' ||
      previousStatus === 'OFFLINE' ||
      newStatus === 'OFFLINE';

    if (!isCriticalChange) {
      this.logger.debug(
        `Skipping non-critical status change: ${previousStatus} → ${newStatus}`,
        {
          deviceId: deviceId.toString()
        }
      );
      return;
    }

    const payload: DeviceStatusChangedPayload = {
      deviceId: deviceId.toString(),
      previousStatus,
      newStatus,
      timestamp: timestamp.toISOString()
    };

    const message: WebSocketMessage<DeviceStatusChangedPayload> = {
      type: WebSocketMessageType.DEVICE_STATUS_CHANGED,
      payload,
      timestamp: new Date().toISOString()
    };

    this.webSocketService.broadcast(message);

    this.logger.info(
      `Broadcasted device status change: ${previousStatus} → ${newStatus}`,
      {
        deviceId: deviceId.toString(),
        connectionCount: this.webSocketService.getConnectionCount()
      }
    );
  }

  /**
   * Handles NetworkDeviceCreatedEvent.
   *
   * @private
   */
  private handleDeviceCreated(
    event: NetworkDeviceCreatedEvent
  ): void {
    if (!this.webSocketService) return;

    const payload: DeviceLifecyclePayload = {
      deviceId: event.deviceId.toString(),
      deviceName: event.name ?? null,
      ipAddress: event.ipAddress.toString(),
      timestamp: event.timestamp.toISOString()
    };

    const message: WebSocketMessage<DeviceLifecyclePayload> = {
      type: WebSocketMessageType.DEVICE_CREATED,
      payload,
      timestamp: new Date().toISOString()
    };

    this.webSocketService.broadcast(message);

    this.logger.debug('Broadcasted device created event', {
      deviceId: event.deviceId.toString()
    });
  }

  /**
   * Handles NetworkDeviceUpdatedEvent.
   *
   * @private
   */
  private handleDeviceUpdated(
    event: NetworkDeviceUpdatedEvent
  ): void {
    if (!this.webSocketService) return;

    const payload: DeviceLifecyclePayload = {
      deviceId: event.deviceId.toString(),
      deviceName: event.name ?? null,
      ipAddress: event.ipAddress.toString(),
      timestamp: event.timestamp.toISOString()
    };

    const message: WebSocketMessage<DeviceLifecyclePayload> = {
      type: WebSocketMessageType.DEVICE_UPDATED,
      payload,
      timestamp: new Date().toISOString()
    };

    this.webSocketService.broadcast(message);

    this.logger.debug('Broadcasted device updated event', {
      deviceId: event.deviceId.toString()
    });
  }

  /**
   * Handles NetworkDeviceDeletedEvent.
   *
   * REQ-002: Soft delete notification.
   *
   * @private
   */
  private handleDeviceDeleted(
    event: NetworkDeviceDeletedEvent
  ): void {
    if (!this.webSocketService) return;

    const payload: DeviceLifecyclePayload = {
      deviceId: event.deviceId.toString(),
      deviceName: event.name ?? null,
      ipAddress: event.ipAddress.toString(),
      timestamp: event.timestamp.toISOString()
    };

    const message: WebSocketMessage<DeviceLifecyclePayload> = {
      type: WebSocketMessageType.DEVICE_DELETED,
      payload,
      timestamp: new Date().toISOString()
    };

    this.webSocketService.broadcast(message);

    this.logger.info('Broadcasted device deleted event', {
      deviceId: event.deviceId.toString()
    });
  }

  /**
   * Handles NetworkDeviceActivatedEvent.
   *
   * REQ-002: DRAFT → ACTIVE transition notification.
   *
   * @private
   */
  private handleDeviceActivated(
    event: NetworkDeviceActivatedEvent
  ): void {
    if (!this.webSocketService) return;

    const payload: DeviceLifecyclePayload = {
      deviceId: event.deviceId.toString(),
      deviceName: event.name ?? null,
      ipAddress: event.ipAddress.toString(),
      timestamp: event.timestamp.toISOString()
    };

    const message: WebSocketMessage<DeviceLifecyclePayload> = {
      type: WebSocketMessageType.DEVICE_ACTIVATED,
      payload,
      timestamp: new Date().toISOString()
    };

    this.webSocketService.broadcast(message);

    this.logger.info('Broadcasted device activated event', {
      deviceId: event.deviceId.toString(),
      activatedBy: event.activatedBy
    });
  }

  /**
   * Handles NetworkDeviceRestoredEvent.
   *
   * REQ-002: Restore from soft delete notification.
   *
   * @private
   */
  private handleDeviceRestored(
    event: NetworkDeviceRestoredEvent
  ): void {
    if (!this.webSocketService) return;

    const payload: DeviceLifecyclePayload = {
      deviceId: event.deviceId.toString(),
      deviceName: event.name ?? null,
      ipAddress: event.ipAddress.toString(),
      timestamp: event.timestamp.toISOString()
    };

    const message: WebSocketMessage<DeviceLifecyclePayload> = {
      type: WebSocketMessageType.DEVICE_RESTORED,
      payload,
      timestamp: new Date().toISOString()
    };

    this.webSocketService.broadcast(message);

    this.logger.info('Broadcasted device restored event', {
      deviceId: event.deviceId.toString()
    });
  }
}
