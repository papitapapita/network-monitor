import { DeviceStatusWebSocketHandler } from '../../../src/application/event-handlers/DeviceStatusWebSocketHandler';
import {
  IWebSocketService,
  WebSocketMessageType,
  DeviceStatusChangedPayload,
  DeviceLifecyclePayload
} from '../../../src/infrastructure/websocket/IWebSocketService';
import { DomainEvents } from '../../../src/domain/shared/core/DomainEvents';
import {
  NetworkDeviceStatusChangedEvent,
  NetworkDeviceCreatedEvent,
  NetworkDeviceUpdatedEvent,
  NetworkDeviceDeletedEvent
} from '../../../../src/domain/device-inventory/events';
import { NetworkDeviceActivatedEvent } from '../../../src/domain/legacy/events/NetworkDeviceActivatedEvent';
import { NetworkDeviceRestoredEvent } from '../../../src/domain/legacy/events/NetworkDeviceRestoredEvent';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import {
  NetworkDeviceId,
  IPAddress,
  NetworkDeviceStatus
} from '../../../../src/domain/device-inventory';

describe('DeviceStatusWebSocketHandler Integration Tests', () => {
  // ========================================
  // Mocks
  // ========================================

  let handler: DeviceStatusWebSocketHandler;
  let mockWebSocketService: jest.Mocked<IWebSocketService>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    // Mock WebSocket service
    mockWebSocketService = {
      broadcast: jest.fn(),
      getConnectionCount: jest.fn().mockReturnValue(5),
      sendToClient: jest.fn(),
      closeClient: jest.fn(),
      closeAll: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    handler = new DeviceStatusWebSocketHandler(mockLogger);
    handler.subscribe(mockWebSocketService);

    // Clear domain events before each test
    DomainEvents.clearHandlers();
    handler.subscribe(mockWebSocketService);
  });

  afterEach(() => {
    handler.unsubscribe();
    DomainEvents.clearHandlers();
    jest.clearAllMocks();
  });

  // ========================================
  // Subscription Tests
  // ========================================

  describe('Subscription', () => {
    it('should subscribe to WebSocket service successfully', () => {
      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DeviceStatusWebSocketHandler subscribed to domain events'
      );
    });

    it('should unsubscribe from all events', () => {
      // Act
      handler.unsubscribe();

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DeviceStatusWebSocketHandler unsubscribed from domain events'
      );
    });

    it('should not broadcast after unsubscribe', () => {
      // Arrange
      handler.unsubscribe();

      const event = new NetworkDeviceStatusChangedEvent(
        NetworkDeviceId.create().value,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        new Date()
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Status Changed Event Tests
  // ========================================

  describe('NetworkDeviceStatusChangedEvent', () => {
    it('should broadcast OFFLINE → ONLINE status change', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const timestamp = new Date();
      const event = new NetworkDeviceStatusChangedEvent(
        deviceId,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        timestamp
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(1);
      const broadcastedMessage =
        mockWebSocketService.broadcast.mock.calls[0][0];
      expect(broadcastedMessage.type).toBe(
        WebSocketMessageType.DEVICE_STATUS_CHANGED
      );
      expect(broadcastedMessage.payload.deviceId).toBe(
        deviceId.toString()
      );
      expect(broadcastedMessage.payload.previousStatus).toBe(
        'OFFLINE'
      );
      expect(broadcastedMessage.payload.newStatus).toBe('ONLINE');
      expect(broadcastedMessage.payload.timestamp).toBe(
        timestamp.toISOString()
      );
    });

    it('should broadcast ONLINE → OFFLINE status change', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const event = new NetworkDeviceStatusChangedEvent(
        deviceId,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        new Date()
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(1);
      const broadcastedMessage =
        mockWebSocketService.broadcast.mock.calls[0][0];
      expect(broadcastedMessage.payload.previousStatus).toBe(
        'ONLINE'
      );
      expect(broadcastedMessage.payload.newStatus).toBe('OFFLINE');
    });

    it('should NOT broadcast non-critical status changes (ONLINE → MAINTENANCE)', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const event = new NetworkDeviceStatusChangedEvent(
        deviceId,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.MAINTENANCE,
        new Date()
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Skipping non-critical status change'
        ),
        expect.any(Object)
      );
    });

    it('should NOT broadcast non-critical status changes (MAINTENANCE → UNKNOWN)', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const event = new NetworkDeviceStatusChangedEvent(
        deviceId,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.UNKNOWN,
        new Date()
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).not.toHaveBeenCalled();
    });

    it('should include connection count in log', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const event = new NetworkDeviceStatusChangedEvent(
        deviceId,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        new Date()
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Broadcasted device status change'),
        expect.objectContaining({ connectionCount: 5 })
      );
    });

    it('should handle status change when WebSocket service not initialized', () => {
      // Arrange
      handler.unsubscribe();
      const newHandler = new DeviceStatusWebSocketHandler(mockLogger);
      // Don't subscribe to WebSocket service

      const event = new NetworkDeviceStatusChangedEvent(
        NetworkDeviceId.create().value,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        new Date()
      );

      // Subscribe to domain events without WebSocket service
      (newHandler as any).webSocketService = null;

      // Act
      DomainEvents.register(
        (e: NetworkDeviceStatusChangedEvent) =>
          (newHandler as any).handleStatusChanged(e),
        NetworkDeviceStatusChangedEvent.name
      );
      DomainEvents.dispatch(event);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WebSocket service not initialized, skipping status change broadcast'
      );
      expect(mockWebSocketService.broadcast).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Device Created Event Tests
  // ========================================

  describe('NetworkDeviceCreatedEvent', () => {
    it('should broadcast device created event', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;
      const timestamp = new Date();

      const event = new NetworkDeviceCreatedEvent(
        deviceId,
        'Router-Core-01',
        ipAddress,
        timestamp
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(1);
      const broadcastedMessage =
        mockWebSocketService.broadcast.mock.calls[0][0];
      expect(broadcastedMessage.type).toBe(
        WebSocketMessageType.DEVICE_CREATED
      );
      expect(broadcastedMessage.payload.deviceId).toBe(
        deviceId.toString()
      );
      expect(broadcastedMessage.payload.deviceName).toBe(
        'Router-Core-01'
      );
      expect(broadcastedMessage.payload.ipAddress).toBe(
        '192.168.1.100'
      );
      expect(broadcastedMessage.payload.timestamp).toBe(
        timestamp.toISOString()
      );
    });

    it('should handle device created with null name (DRAFT mode)', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;

      const event = new NetworkDeviceCreatedEvent(
        deviceId,
        null,
        ipAddress,
        new Date()
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(1);
      const broadcastedMessage =
        mockWebSocketService.broadcast.mock.calls[0][0];
      expect(broadcastedMessage.payload.deviceName).toBeNull();
    });
  });

  // ========================================
  // Device Updated Event Tests
  // ========================================

  describe('NetworkDeviceUpdatedEvent', () => {
    it('should broadcast device updated event', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;
      const timestamp = new Date();

      const event = new NetworkDeviceUpdatedEvent(
        deviceId,
        'Router-Core-01-Updated',
        ipAddress,
        timestamp
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(1);
      const broadcastedMessage =
        mockWebSocketService.broadcast.mock.calls[0][0];
      expect(broadcastedMessage.type).toBe(
        WebSocketMessageType.DEVICE_UPDATED
      );
      expect(broadcastedMessage.payload.deviceId).toBe(
        deviceId.toString()
      );
      expect(broadcastedMessage.payload.deviceName).toBe(
        'Router-Core-01-Updated'
      );
    });
  });

  // ========================================
  // Device Deleted Event Tests
  // ========================================

  describe('NetworkDeviceDeletedEvent', () => {
    it('should broadcast device deleted event', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;
      const timestamp = new Date();

      const event = new NetworkDeviceDeletedEvent(
        deviceId,
        'Router-Core-01',
        ipAddress,
        timestamp
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(1);
      const broadcastedMessage =
        mockWebSocketService.broadcast.mock.calls[0][0];
      expect(broadcastedMessage.type).toBe(
        WebSocketMessageType.DEVICE_DELETED
      );
      expect(broadcastedMessage.payload.deviceId).toBe(
        deviceId.toString()
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Broadcasted device deleted event',
        expect.any(Object)
      );
    });
  });

  // ========================================
  // Device Activated Event Tests (REQ-002)
  // ========================================

  describe('NetworkDeviceActivatedEvent (REQ-002)', () => {
    it('should broadcast device activated event', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;
      const timestamp = new Date();

      const event = new NetworkDeviceActivatedEvent(
        deviceId,
        'Router-Core-01',
        ipAddress,
        'test-user',
        timestamp
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(1);
      const broadcastedMessage =
        mockWebSocketService.broadcast.mock.calls[0][0];
      expect(broadcastedMessage.type).toBe(
        WebSocketMessageType.DEVICE_ACTIVATED
      );
      expect(broadcastedMessage.payload.deviceId).toBe(
        deviceId.toString()
      );
      expect(broadcastedMessage.payload.deviceName).toBe(
        'Router-Core-01'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Broadcasted device activated event',
        expect.objectContaining({ activatedBy: 'test-user' })
      );
    });

    it('should include activated-by user in log', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;

      const event = new NetworkDeviceActivatedEvent(
        deviceId,
        'Router-Core-01',
        ipAddress,
        'admin@company.com',
        new Date()
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ activatedBy: 'admin@company.com' })
      );
    });
  });

  // ========================================
  // Device Restored Event Tests (REQ-002)
  // ========================================

  describe('NetworkDeviceRestoredEvent (REQ-002)', () => {
    it('should broadcast device restored event', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;
      const timestamp = new Date();

      const event = new NetworkDeviceRestoredEvent(
        deviceId,
        'Router-Core-01',
        ipAddress,
        timestamp
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(1);
      const broadcastedMessage =
        mockWebSocketService.broadcast.mock.calls[0][0];
      expect(broadcastedMessage.type).toBe(
        WebSocketMessageType.DEVICE_RESTORED
      );
      expect(broadcastedMessage.payload.deviceId).toBe(
        deviceId.toString()
      );
      expect(broadcastedMessage.payload.deviceName).toBe(
        'Router-Core-01'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Broadcasted device restored event',
        expect.any(Object)
      );
    });
  });

  // ========================================
  // Message Format Tests
  // ========================================

  describe('Message Format', () => {
    it('should include timestamp in all messages', () => {
      // Arrange
      const event = new NetworkDeviceCreatedEvent(
        NetworkDeviceId.create().value,
        'Router-01',
        IPAddress.create('192.168.1.100').value,
        new Date()
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      const broadcastedMessage =
        mockWebSocketService.broadcast.mock.calls[0][0];
      expect(broadcastedMessage.timestamp).toBeDefined();
      expect(typeof broadcastedMessage.timestamp).toBe('string');
      expect(
        new Date(broadcastedMessage.timestamp).getTime()
      ).toBeGreaterThan(0);
    });

    it('should format payload correctly for status change', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const timestamp = new Date();
      const event = new NetworkDeviceStatusChangedEvent(
        deviceId,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        timestamp
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      const payload = mockWebSocketService.broadcast.mock.calls[0][0]
        .payload as DeviceStatusChangedPayload;
      expect(payload).toEqual({
        deviceId: deviceId.toString(),
        previousStatus: 'OFFLINE',
        newStatus: 'ONLINE',
        timestamp: timestamp.toISOString()
      });
    });

    it('should format payload correctly for lifecycle events', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;
      const timestamp = new Date();
      const event = new NetworkDeviceCreatedEvent(
        deviceId,
        'Router-01',
        ipAddress,
        timestamp
      );

      // Act
      DomainEvents.dispatch(event);

      // Assert
      const payload = mockWebSocketService.broadcast.mock.calls[0][0]
        .payload as DeviceLifecyclePayload;
      expect(payload).toEqual({
        deviceId: deviceId.toString(),
        deviceName: 'Router-01',
        ipAddress: '192.168.1.100',
        timestamp: timestamp.toISOString()
      });
    });
  });

  // ========================================
  // Integration Workflow Tests
  // ========================================

  describe('Integration Workflows', () => {
    it('should handle multiple events in sequence', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;
      const timestamp = new Date();

      const createdEvent = new NetworkDeviceCreatedEvent(
        deviceId,
        'Router-01',
        ipAddress,
        timestamp
      );

      const activatedEvent = new NetworkDeviceActivatedEvent(
        deviceId,
        'Router-01',
        ipAddress,
        'test-user',
        timestamp
      );

      const statusChangeEvent = new NetworkDeviceStatusChangedEvent(
        deviceId,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        timestamp
      );

      // Act
      DomainEvents.dispatch(createdEvent);
      DomainEvents.dispatch(activatedEvent);
      DomainEvents.dispatch(statusChangeEvent);

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(3);
      expect(
        mockWebSocketService.broadcast.mock.calls[0][0].type
      ).toBe(WebSocketMessageType.DEVICE_CREATED);
      expect(
        mockWebSocketService.broadcast.mock.calls[1][0].type
      ).toBe(WebSocketMessageType.DEVICE_ACTIVATED);
      expect(
        mockWebSocketService.broadcast.mock.calls[2][0].type
      ).toBe(WebSocketMessageType.DEVICE_STATUS_CHANGED);
    });

    it('should handle device lifecycle: Create → Activate → Delete → Restore', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;

      // Act
      DomainEvents.dispatch(
        new NetworkDeviceCreatedEvent(
          deviceId,
          'Router-01',
          ipAddress,
          new Date()
        )
      );
      DomainEvents.dispatch(
        new NetworkDeviceActivatedEvent(
          deviceId,
          'Router-01',
          ipAddress,
          'user1',
          new Date()
        )
      );
      DomainEvents.dispatch(
        new NetworkDeviceDeletedEvent(
          deviceId,
          'Router-01',
          ipAddress,
          new Date()
        )
      );
      DomainEvents.dispatch(
        new NetworkDeviceRestoredEvent(
          deviceId,
          'Router-01',
          ipAddress,
          new Date()
        )
      );

      // Assert
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(4);
      const messageTypes =
        mockWebSocketService.broadcast.mock.calls.map(
          (call) => call[0].type
        );
      expect(messageTypes).toEqual([
        WebSocketMessageType.DEVICE_CREATED,
        WebSocketMessageType.DEVICE_ACTIVATED,
        WebSocketMessageType.DEVICE_DELETED,
        WebSocketMessageType.DEVICE_RESTORED
      ]);
    });
  });
});
