import { DeviceStatus } from '../data/enums';
import {
  IPollerServiceWithEvents,
  PollingConfig
} from '../shared/interfaces/PollerService.interface';

export class PollerService implements IPollerServiceWithEvents {
  private config: PollingConfig | null = null;
  private devices: Map<string, DeviceStatus> = new Map();

  constructor() {}

  async initialize(config: PollingConfig): Promise<void> {
    this.config = config;

    //Initialize devices states
    for (const device of config.devices) {
      this.devices.set(device.apId, {
        device,
        isPaused: device.isPaused
      });
    }
  }

  async start(): Promise<void> {
    this.config?.devices;
  }
}
