import { createPollerService } from './poller.service';
import {
  CommunicationMethod,
  PollingConfig
} from '../data/interfaces/PollerService.interface';

const config: PollingConfig = {
  devices: [
    { apId: 'AP001', ipAddress: '172.16.30.10', isPaused: false },
    { apId: 'AP002', ipAddress: '172.16.30.11', isPaused: false }
  ],
  intervalMs: 30000, // 30 seconds
  maxRetries: 3,
  timeoutMs: 5000,
  method: CommunicationMethod.ICMP
};

const poller = createPollerService(config, {
  onResult: async (result) => {
    console.log('Poll result:', result);
    // Send to database, cache, etc.
  },
  onError: async (error) => {
    console.error('Poll error:', error);
    // Send to notification service
  }
});

await poller.start();
