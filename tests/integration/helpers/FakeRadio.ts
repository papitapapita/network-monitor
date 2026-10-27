import { Result } from 'domain/shared/core';
import {
  IAgentRadioSettings,
  IRadioHostnameWriter,
  RadioLogin,
  RadioSettingsAnswer,
  RadioTarget
} from 'application/wireless-monitoring/interfaces';

// Stands in for an AirOS radio this server talks to itself: the file its
// cfg.cgi serves, and the name it was given over SSH.
export class FakeRadio implements IRadioHostnameWriter {
  config: Result<string> = Result.ok('');
  rename: Result<void> = Result.ok();
  readonly reads: Array<{
    ip: string;
    port: number;
    username: string;
  }> = [];
  readonly renames: Array<{
    ip: string;
    login: RadioLogin;
    hostname: string;
  }> = [];

  async fetchConfig(
    ip: string,
    port: number,
    creds: { username: string; password: string }
  ): Promise<Result<string>> {
    this.reads.push({ ip, port, username: creds.username });
    return this.config;
  }

  async setHostname(
    ip: string,
    login: RadioLogin,
    hostname: string
  ): Promise<Result<void>> {
    this.renames.push({ ip, login, hostname });
    return this.rename;
  }

  reset(): void {
    this.config = Result.ok('');
    this.rename = Result.ok();
    this.reads.length = 0;
    this.renames.length = 0;
  }
}

const OFFLINE = {
  ok: false,
  reason: 'AGENT_OFFLINE',
  error: 'The agent is not connected'
} as const;

// Stands in for the on-site agent a radio sits behind.
export class FakeAgentRadioSettings implements IAgentRadioSettings {
  config: RadioSettingsAnswer<string> = OFFLINE;
  rename: RadioSettingsAnswer<void> = OFFLINE;
  readonly calls: Array<{
    agentId: string;
    target: RadioTarget;
    hostname?: string;
  }> = [];

  async fetchConfig(
    agentId: string,
    target: RadioTarget
  ): Promise<RadioSettingsAnswer<string>> {
    this.calls.push({ agentId, target });
    return this.config;
  }

  async setHostname(
    agentId: string,
    target: RadioTarget,
    hostname: string
  ): Promise<RadioSettingsAnswer<void>> {
    this.calls.push({ agentId, target, hostname });
    return this.rename;
  }

  reset(): void {
    this.config = OFFLINE;
    this.rename = OFFLINE;
    this.calls.length = 0;
  }
}
