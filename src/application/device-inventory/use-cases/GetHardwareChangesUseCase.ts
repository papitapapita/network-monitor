import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceHardwareQuery } from '../interfaces';
import { HardwareChangeAssessor } from '../services';
import {
  DeviceIdentitySuggestionDTO,
  HardwareChangeDTO,
  HardwareChangesResponseDTO
} from '../dtos';

// A MAC or serial filled in where none was on file is bookkeeping, not a
// hardware change, so on its own it does not list the device (WLS-154). A
// router naming itself differently does (DEV-216).
function isHardwareChange(s: DeviceIdentitySuggestionDTO): boolean {
  if (s.field === 'deviceModel' || s.field === 'name') return true;
  return s.currentValue !== null;
}

// WLS-154, DEV-215: every radio and MikroTik whose own report no longer
// matches its inventory record, in one list.
export class GetHardwareChangesUseCase extends UseCase<
  void,
  HardwareChangesResponseDTO
> {
  constructor(
    private readonly hardwareQuery: IDeviceHardwareQuery,
    private readonly hardwareAssessor: HardwareChangeAssessor,
    logger: ILogger
  ) {
    super(logger, 'GetHardwareChangesUseCase');
  }

  protected async executeImpl(): Promise<
    Result<HardwareChangesResponseDTO>
  > {
    const reportsResult =
      await this.hardwareQuery.findReportedHardware();
    if (reportsResult.isFailure) {
      return this.fail(reportsResult.error);
    }
    const reports = reportsResult.value.map((r) =>
      // DEV-215: every port of a MikroTik has its own MAC, so its serial is
      // what tells one box from another; the MAC only stands in when the
      // router has no serial (a CHR).
      r.source === 'ROUTER' && r.serialNumber
        ? { ...r, macAddress: null }
        : r
    );

    const assessed = await this.hardwareAssessor.assess(reports);
    if (assessed.isFailure) {
      return this.fail(assessed.error);
    }

    const devices: HardwareChangeDTO[] = [];
    for (const { hardware, source, reportedAt } of reports) {
      const suggestions = assessed.value.get(hardware.deviceId) ?? [];
      if (!suggestions.some(isHardwareChange)) continue;
      devices.push({
        deviceId: hardware.deviceId,
        name: hardware.name,
        source,
        collectedAt: reportedAt.toISOString(),
        suggestions
      });
    }
    devices.sort((a, b) => a.name.localeCompare(b.name));

    return this.ok({ devices });
  }
}
