# WebSocket Infrastructure - REQ-002

## Overview

This directory contains the WebSocket infrastructure for real-time device status updates according to REQ-002 (FR-002.9).

**Key Requirements:**
- Endpoint: `/ws/devices/status-updates`
- Authentication: JWT token required
- Concurrent connections: 1,000 limit (single-server)
- Message latency: <2 seconds (NFR-002.4)
- Critical events: Device status changes (ONLINE ↔ OFFLINE)
- Reconnection: Exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
- Fallback: HTTP polling (30s interval)

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Domain Layer                              │
│  NetworkDevice.updateStatus() → NetworkDeviceStatusChangedEvent│
└────────────────────────────┬─────────────────────────────────┘
                             │ Domain Events Dispatcher
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              Application Layer (Event Handlers)               │
│  DeviceStatusWebSocketHandler                                 │
│  - Subscribes to domain events                                │
│  - Transforms to WebSocket messages                           │
│  - Calls webSocketService.broadcast()                         │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│           Infrastructure Layer (WebSocket Service)            │
│  WebSocketService (implements IWebSocketService)              │
│  - Connection management                                      │
│  - Authentication (JWT validation)                            │
│  - Message broadcasting                                       │
│  - Health monitoring                                          │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                  WebSocket Clients (Frontend)                 │
│  - React/Vue/Angular UI                                       │
│  - Auto-reconnection logic                                    │
│  - Fallback to polling                                        │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Install Dependencies

```bash
npm install ws @types/ws
# OR
npm install socket.io @types/socket.io
```

**Recommendation**: Use `ws` for simplicity. Use `socket.io` if you need:
- Automatic reconnection (built-in)
- Broadcasting to rooms/namespaces
- Fallback transports (long polling)

### Step 2: Implement WebSocketService

Create `src/infrastructure/websocket/WebSocketService.ts`:

```typescript
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { IWebSocketService, WebSocketConnection, WebSocketMessage } from './IWebSocketService';
import { ILogger } from '../../application/interfaces/ILogger';
import { verifyJWT } from '../auth/jwtUtils'; // Implement JWT verification

export class WebSocketService implements IWebSocketService {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, { ws: WebSocket; metadata: WebSocketConnection }> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private readonly logger: ILogger) {}

  async initialize(httpServer: any): Promise<void> {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws/devices/status-updates'
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat monitoring (every 30 seconds)
    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), 30000);

    this.logger.info('WebSocket server initialized on /ws/devices/status-updates');
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const connectionId = this.generateConnectionId();

    // REQ-002: Authenticate connection (JWT from query param or header)
    const token = this.extractToken(req);
    if (!token) {
      ws.close(1008, 'Authentication required');
      this.logger.warn('WebSocket connection rejected: No JWT token');
      return;
    }

    try {
      const decoded = await verifyJWT(token);
      const userId = decoded.userId;
      const userRole = decoded.role;

      // Store connection metadata
      const metadata: WebSocketConnection = {
        id: connectionId,
        userId,
        userRole,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        authenticated: true
      };

      this.connections.set(connectionId, { ws, metadata });

      // Send connection confirmation
      this.sendToConnection(connectionId, {
        type: WebSocketMessageType.CONNECTION_ESTABLISHED,
        payload: {
          connectionId,
          userId,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      // Set up event handlers
      ws.on('message', (data) => this.handleMessage(connectionId, data));
      ws.on('close', () => this.handleDisconnect(connectionId));
      ws.on('error', (error) => this.handleError(connectionId, error));
      ws.on('pong', () => this.handlePong(connectionId));

      this.logger.info('WebSocket connection established', {
        connectionId,
        userId,
        totalConnections: this.connections.size
      });

      // REQ-002: Alert if approaching connection limit
      if (this.connections.size > 800) {
        this.logger.warn('WebSocket connection count approaching limit', {
          current: this.connections.size,
          limit: 1000
        });
      }
    } catch (error) {
      ws.close(1008, 'Invalid authentication token');
      this.logger.warn('WebSocket connection rejected: Invalid JWT', { error });
    }
  }

  broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    let successCount = 0;
    let failureCount = 0;

    this.connections.forEach(({ ws, metadata }, connectionId) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
          successCount++;
        } catch (error) {
          failureCount++;
          this.logger.error('Failed to send message to connection', error as Error, {
            connectionId
          });
        }
      }
    });

    this.logger.debug('Broadcasted WebSocket message', {
      type: message.type,
      successCount,
      failureCount,
      totalConnections: this.connections.size
    });
  }

  sendToUser(userId: string, message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.connections.forEach(({ ws, metadata }) => {
      if (metadata.userId === userId && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
        sentCount++;
      }
    });

    this.logger.debug(`Sent message to user ${userId}`, { sentCount });
  }

  sendToConnection(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn(`Connection ${connectionId} not found`);
      return;
    }

    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  getActiveConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values()).map(({ metadata }) => metadata);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  closeConnection(connectionId: string, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.ws.close(1000, reason);
      this.connections.delete(connectionId);
      this.logger.info('Connection closed', { connectionId, reason });
    }
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections gracefully
    this.connections.forEach(({ ws }, connectionId) => {
      ws.close(1000, 'Server shutting down');
    });

    this.connections.clear();

    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          this.logger.info('WebSocket server shut down');
          resolve();
        });
      });
    }
  }

  isHealthy(): boolean {
    return this.wss !== null && this.wss.clients.size === this.connections.size;
  }

  // Private helper methods

  private handleMessage(connectionId: string, data: any): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle heartbeat/ping messages
      if (message.type === 'HEARTBEAT') {
        const connection = this.connections.get(connectionId);
        if (connection) {
          connection.metadata.lastHeartbeat = new Date();
        }
      }
    } catch (error) {
      this.logger.warn('Invalid WebSocket message received', {
        connectionId,
        error: (error as Error).message
      });
    }
  }

  private handleDisconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.logger.info('WebSocket connection closed', {
        connectionId,
        userId: connection.metadata.userId,
        duration: Date.now() - connection.metadata.connectedAt.getTime()
      });
      this.connections.delete(connectionId);
    }
  }

  private handleError(connectionId: string, error: Error): void {
    this.logger.error('WebSocket connection error', error, { connectionId });
  }

  private handlePong(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.metadata.lastHeartbeat = new Date();
    }
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds

    this.connections.forEach(({ ws, metadata }, connectionId) => {
      const timeSinceLastHeartbeat = now - metadata.lastHeartbeat.getTime();

      if (timeSinceLastHeartbeat > timeout) {
        this.logger.warn('Connection timed out', { connectionId });
        this.closeConnection(connectionId, 'Heartbeat timeout');
      } else {
        // Send ping to keep connection alive
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }
    });
  }

  private extractToken(req: IncomingMessage): string | null {
    // Try query parameter first: /ws/devices/status-updates?token=xxx
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const queryToken = url.searchParams.get('token');
    if (queryToken) return queryToken;

    // Try Authorization header: Authorization: Bearer xxx
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Step 3: Integrate with Express Server

In `src/server.ts` or `src/app.ts`:

```typescript
import { createServer } from 'http';
import express from 'express';
import { WebSocketService } from './infrastructure/websocket/WebSocketService';
import { DeviceStatusWebSocketHandler } from './application/event-handlers/DeviceStatusWebSocketHandler';
import { ConsoleLogger } from './infrastructure/logging/ConsoleLogger';

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket service
const logger = new ConsoleLogger();
const webSocketService = new WebSocketService(logger);
await webSocketService.initialize(httpServer);

// Subscribe to domain events
const wsEventHandler = new DeviceStatusWebSocketHandler(logger);
wsEventHandler.subscribe(webSocketService);

// Start HTTP server (WebSocket upgrade handled automatically)
httpServer.listen(3000, () => {
  console.log('Server listening on port 3000');
  console.log('WebSocket endpoint: ws://localhost:3000/ws/devices/status-updates');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  wsEventHandler.unsubscribe();
  await webSocketService.shutdown();
  httpServer.close();
});
```

### Step 4: Client Implementation (Frontend)

```typescript
class DeviceStatusWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

  constructor(
    private token: string,
    private onMessage: (message: any) => void
  ) {}

  connect(): void {
    const wsUrl = `ws://localhost:3000/ws/devices/status-updates?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;

      // Start heartbeat
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.onMessage(message);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed', event.code, event.reason);
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error', error);
    };
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached, falling back to polling');
      this.fallbackToPolling();
      return;
    }

    const delay = this.reconnectDelays[this.reconnectAttempts] || 30000;
    this.reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
      }
    }, 30000); // Every 30 seconds
  }

  private fallbackToPolling(): void {
    // Implement HTTP polling fallback (every 30 seconds)
    setInterval(async () => {
      const response = await fetch('/api/devices?limit=20');
      const data = await response.json();
      // Update UI with fresh data
    }, 30000);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
}

// Usage in React/Vue component
const client = new DeviceStatusWebSocketClient(jwtToken, (message) => {
  switch (message.type) {
    case 'DEVICE_STATUS_CHANGED':
      console.log('Device status changed:', message.payload);
      // Update UI state
      break;
    case 'DEVICE_CREATED':
      console.log('New device created:', message.payload);
      // Add to device list
      break;
    // Handle other event types...
  }
});

client.connect();
```

## Testing

### Manual Testing

```bash
# Install wscat for testing
npm install -g wscat

# Connect to WebSocket endpoint (replace TOKEN with valid JWT)
wscat -c "ws://localhost:3000/ws/devices/status-updates?token=YOUR_JWT_TOKEN"

# Send heartbeat
> {"type":"HEARTBEAT"}

# Trigger status change (via API) and watch for broadcast
curl -X PUT http://localhost:3000/api/devices/abc-123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"OFFLINE"}'

# Expected WebSocket message:
< {"type":"DEVICE_STATUS_CHANGED","payload":{"deviceId":"abc-123","previousStatus":"ONLINE","newStatus":"OFFLINE","timestamp":"2026-01-07T..."},"timestamp":"2026-01-07T..."}
```

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Create artillery config (artillery-websocket.yml)
config:
  target: "ws://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Ramp up to 600 connections"
scenarios:
  - name: "WebSocket connection"
    engine: "ws"
    flow:
      - connect:
          url: "/ws/devices/status-updates?token=TEST_TOKEN"
      - think: 300
      - send:
          data: '{"type":"HEARTBEAT"}'
      - think: 30

# Run load test
artillery run artillery-websocket.yml
```

## Monitoring

### Health Check Endpoint

Add to `src/presentation/http/routes/health.routes.ts`:

```typescript
router.get('/health/websocket', (req, res) => {
  const isHealthy = webSocketService.isHealthy();
  const connectionCount = webSocketService.getConnectionCount();

  res.status(isHealthy ? 200 : 503).json({
    healthy: isHealthy,
    connectionCount,
    maxConnections: 1000,
    utilizationPercent: (connectionCount / 1000) * 100
  });
});
```

### Metrics to Monitor

- **Connection count**: Alert if >800 (approaching limit)
- **Message latency**: Target <2 seconds (p95)
- **Failed broadcasts**: Alert if failure rate >5%
- **Heartbeat timeouts**: Alert if >10 per minute
- **Reconnection rate**: Alert if excessive (indicates connectivity issues)

## Security Considerations

1. **Authentication**: JWT token required for all connections
2. **Rate Limiting**: Implement per-user connection limits (max 3 concurrent)
3. **Message Validation**: Validate all incoming messages (ignore unrecognized types)
4. **DoS Protection**: Connection limit (1,000), heartbeat timeout (60s)
5. **TLS/WSS**: Use WSS (WebSocket Secure) in production

## Scaling Beyond 1,000 Connections

When connection count approaches 1,000:

1. **Implement Redis Pub/Sub**:
   ```typescript
   // Instead of in-memory broadcast, publish to Redis
   redis.publish('device-status-updates', JSON.stringify(message));

   // Each WebSocket server subscribes to Redis
   redis.subscribe('device-status-updates', (message) => {
     // Broadcast to local connections only
     localConnections.forEach(ws => ws.send(message));
   });
   ```

2. **Load Balancer Configuration**:
   - Enable sticky sessions (same user → same server)
   - OR implement Redis pub/sub for cross-server broadcasting

3. **Horizontal Scaling**:
   - Deploy multiple WebSocket server instances
   - Use Redis for inter-server communication
   - Load balancer distributes connections

## Troubleshooting

### Issue: Connections dropping frequently
- Check heartbeat interval (too aggressive?)
- Verify network stability
- Check server resource usage (CPU, memory)

### Issue: Messages not received
- Verify domain events are being dispatched
- Check WebSocketService broadcast logic
- Verify client WebSocket connection is open

### Issue: Authentication failures
- Verify JWT token is valid and not expired
- Check token extraction logic (query param vs header)
- Verify JWT secret matches between client and server

## References

- REQ-002: Network Device CRUD Operations
- FR-002.9: Real-Time Updates via WebSocket
- NFR-002.4: WebSocket Message Latency (<2s)
- NFR-002.8: WebSocket Reliability (auto-reconnect)
