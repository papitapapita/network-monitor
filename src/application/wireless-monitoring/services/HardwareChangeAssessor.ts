import { Result } from 'domain/shared/core';
import { MACAddress } from 'domain/shared/value-objects';
import { ILogger } from 'application/shared/interfaces';
import {
  CatalogModel,
  DeviceHardware,
  IDeviceHardwareQuery
} from '../interfaces';
import {
  DeviceIdentitySuggestionAction,
  DeviceIdentitySuggestionDTO,
  SwapCandidateDTO
} from '../dtos';
import {
  matchReportedModel,
  normalizeModelName
} from './matchReportedModel';

export function normalizeMac(mac: string): string {
  const result = MACAddress.create(mac);
  return result.isSuccess ? result.value.value : mac.toUpperCase();
}

export interface ReportedHardware {
  hardware: DeviceHardware;
  macAddress: string | null;
  deviceModel: string | null;
}

interface Differences {
  hardware: DeviceHardware;
  currentMac: string | null;
  polledMac: string | null;
  polledModel: string | null;
}

// Compares what radios report about their own hardware with inventory and
// says how each difference should be resolved (WLS-152, WLS-153). Takes a
// batch so the fleet view costs two lookups, not two per radio.
export class HardwareChangeAssessor {
  constructor(
    private readonly hardwareQuery: IDeviceHardwareQuery,
    private readonly logger: ILogger
  ) {}

  public async assess(
    reports: ReportedHardware[]
  ): Promise<Result<Map<string, DeviceIdentitySuggestionDTO[]>>> {
    const differences = reports.map((r) => this.differences(r));

    const swapsResult = await this.findSwapCandidates(differences);
    const catalogResult = await this.loadCatalogIfNeeded(differences);
    if (catalogResult.isFailure) {
      return Result.fail(catalogResult.error);
    }

    const byDevice = new Map<string, DeviceIdentitySuggestionDTO[]>();
    for (const d of differences) {
      const swapWith = d.polledMac
        ? (swapsResult.get(d.polledMac) ?? null)
        : null;
      const suggestions: DeviceIdentitySuggestionDTO[] = [];

      if (d.polledMac) {
        suggestions.push({
          field: 'macAddress',
          currentValue: d.hardware.macAddress,
          suggestedValue: d.polledMac,
          currentLabel: null,
          suggestedLabel: null,
          actions: swapWith ? ['SWAP'] : this.macActions(d),
          swapWith
        });
      }

      if (d.polledModel) {
        const match = matchReportedModel(
          d.polledModel,
          catalogResult.value,
          d.hardware.vendorId
        );
        suggestions.push({
          field: 'deviceModel',
          currentValue: d.hardware.deviceModelId,
          suggestedValue: match?.id ?? null,
          currentLabel: d.hardware.modelName,
          suggestedLabel: match?.model ?? d.polledModel,
          actions: swapWith
            ? ['SWAP']
            : d.hardware.inInventory
              ? ['UPDATE']
              : ['REPLACE'],
          swapWith
        });
      }

      byDevice.set(d.hardware.deviceId, suggestions);
    }
    return Result.ok(byDevice);
  }

  private differences(report: ReportedHardware): Differences {
    const { hardware } = report;
    const currentMac = hardware.macAddress
      ? normalizeMac(hardware.macAddress)
      : null;
    const reportedMac = report.macAddress
      ? normalizeMac(report.macAddress)
      : null;
    const reportedModel = report.deviceModel?.trim() || null;

    return {
      hardware,
      currentMac,
      polledMac:
        reportedMac && reportedMac !== currentMac
          ? reportedMac
          : null,
      polledModel:
        reportedModel &&
        normalizeModelName(reportedModel) !==
          normalizeModelName(hardware.modelName)
          ? reportedModel
          : null
    };
  }

  // A unit in service that reports a different MAC is most likely a swapped
  // box, but could be a typo when the MAC was entered — so both are offered,
  // replacement first.
  private macActions(
    d: Differences
  ): DeviceIdentitySuggestionAction[] {
    if (d.currentMac === null || d.hardware.inInventory) {
      return ['UPDATE'];
    }
    return ['REPLACE', 'UPDATE'];
  }

  // A reported MAC on another inventory record means the two units traded
  // places, which swap-hardware handles and replace would refuse (the MAC is
  // taken). A failed lookup only costs the swap hint, so it is not fatal.
  private async findSwapCandidates(
    differences: Differences[]
  ): Promise<Map<string, SwapCandidateDTO>> {
    const swaps = new Map<string, SwapCandidateDTO>();
    const macs = differences
      .map((d) => d.polledMac)
      .filter((mac): mac is string => mac !== null);
    if (macs.length === 0) return swaps;

    const ownersResult =
      await this.hardwareQuery.findDevicesByMac(macs);
    if (ownersResult.isFailure) {
      this.logger.warn('Device lookup by MAC failed', {
        error: ownersResult.error
      });
      return swaps;
    }
    for (const owner of ownersResult.value) {
      swaps.set(normalizeMac(owner.macAddress), {
        deviceId: owner.deviceId,
        name: owner.name
      });
    }
    return swaps;
  }

  private async loadCatalogIfNeeded(
    differences: Differences[]
  ): Promise<Result<CatalogModel[]>> {
    if (differences.every((d) => d.polledModel === null)) {
      return Result.ok([]);
    }
    return this.hardwareQuery.findCatalogModels();
  }
}
