import SettingsManager from './services/settings.service';
import ping from 'ping';
import { AccessPointConfig } from './data/types/AccessPointConfig';
import EventEmitter from 'events';

interface PollingJob {
  timer: NodeJS.Timeout;
  ap: AccessPointConfig;
}

export class PollingScheduler extends EventEmitter {
  private settingsManager: SettingsManager;
  private jobs: Map<string, PollingJob> = new Map();

  constructor(settingsManager: SettingsManager) {
    super();
    this.settingsManager = settingsManager;
    this.settingsManager.onSettingsUpdated(() => this.refreshJobs());
    this.settingsManager.onAPAdded(() => this.refreshJobs());
    this.settingsManager.onAPRemoved(() => this.refreshJobs());
  }

  async start() {
    await this.settingsManager.initialize();
    this.refreshJobs();
  }

  stop() {
    for (const { timer } of this.jobs.values()) {
      clearInterval(timer);
    }
    this.jobs.clear();
  }

  private refreshJobs() {
    // Stop all current jobs
    this.stop();
    // Start polling for all enabled APs
    const aps = this.settingsManager.getAPList();
    for (const ap of aps) {
      if (ap.enabled !== false) {
        this.startPolling(ap);
      }
    }
  }

  private startPolling(ap: AccessPointConfig) {
    const poll = async () => {
      try {
        const res = await ping.promise.probe(ap.IPaddress, {
          timeout: ap.timeout ? ap.timeout / 1000 : 3
        });
        this.emit('polled', { ap, result: res });
        if (!res.alive) {
          this.emit('poll-failed', { ap, result: res });
        }
      } catch (err) {
        this.emit('poll-error', { ap, error: err });
      }
    };
    // Immediately poll, then set interval
    poll();
    const timer = setInterval(poll, ap.frequencyToPoll || 15000);
    this.jobs.set(ap.IPaddress, { timer, ap });
  }

  pauseAP(IPaddress: string) {
    const job = this.jobs.get(IPaddress);
    if (job) {
      clearInterval(job.timer);
      this.jobs.delete(IPaddress);
    }
  }

  resumeAP(IPaddress: string) {
    const ap = this.settingsManager.getAP(IPaddress);
    if (ap && ap.enabled !== false) {
      this.startPolling(ap);
    }
  }
}

// Example usage
if (require.main === module) {
  (async () => {
    const settingsManager = new SettingsManager();
    const scheduler = new PollingScheduler(settingsManager);
    scheduler.on('polled', ({ ap, result }) => {
      console.log(
        `Polled ${ap.IPaddress}: ${result.alive ? 'UP' : 'DOWN'}`
      );
    });
    scheduler.on('poll-failed', ({ ap }) => {
      console.warn(`AP ${ap.IPaddress} is DOWN!`);
    });
    scheduler.on('poll-error', ({ ap, error }) => {
      console.error(`Error polling ${ap.IPaddress}:`, error);
    });
    await scheduler.start();
  })();
}
