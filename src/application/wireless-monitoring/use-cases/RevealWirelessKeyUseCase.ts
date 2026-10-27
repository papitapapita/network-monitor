import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IRadioSettingsGateway,
  RADIO_SETTINGS_FAILURES
} from '../interfaces';
import {
  RevealWirelessKeyRequestDTO,
  RevealedWirelessKeyDTO
} from '../dtos';
import { RadioTargetSources, resolveRadioTarget } from '../services';

// The Wi-Fi key is read from the radio each time, never from a stored
// backup, which may be days old (WLS-220). Whether the caller unlocked it is
// the route's question (IDN-086).
export class RevealWirelessKeyUseCase extends UseCase<
  RevealWirelessKeyRequestDTO,
  RevealedWirelessKeyDTO
> {
  constructor(
    private readonly sources: RadioTargetSources,
    private readonly gateway: IRadioSettingsGateway,
    logger: ILogger,
    private readonly clock: () => Date = () => new Date()
  ) {
    super(logger, 'RevealWirelessKeyUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'key' in data) {
      return {
        deviceId: (data as RevealedWirelessKeyDTO).deviceId
      };
    }
    return data;
  }

  protected async beforeExecute(
    request: RevealWirelessKeyRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: RevealWirelessKeyRequestDTO
  ): Promise<Result<RevealedWirelessKeyDTO>> {
    const deviceId = DeviceId.parse(request.deviceId.trim());
    if (deviceId.isFailure) {
      return this.fail(`Invalid device ID: ${deviceId.error}`);
    }

    const resolved = await resolveRadioTarget(
      this.sources,
      deviceId.value
    );
    if (resolved.isFailure) {
      return this.fail(
        `Cannot read the Wi-Fi key — ${resolved.error}`
      );
    }
    const { reach, target } = resolved.value;

    const answer = await this.gateway.readWirelessSecurity(
      reach,
      target
    );
    if (!answer.ok) {
      return this.fail(
        `Cannot read the Wi-Fi key — ${RADIO_SETTINGS_FAILURES[answer.reason]}: ${answer.error}`
      );
    }

    this.logger.warn('Wi-Fi key revealed', {
      deviceId: deviceId.value.toString(),
      revealedBy: request.revealedBy
    });

    const reading = answer.value;
    return this.ok({
      deviceId: deviceId.value.toString(),
      role: reading.role,
      ssid: reading.ssid,
      security: reading.security,
      key: reading.key,
      readAt: this.clock().toISOString()
    });
  }
}
