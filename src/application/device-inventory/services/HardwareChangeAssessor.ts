import { Result } from 'domain/shared/core';
import { MACAddress } from 'domain/shared/value-objects';
import { ILogger } from 'application/shared/interfaces';
import {
  CatalogModel,
  DeviceHardware,
  IDeviceHardwareQuery,
  ReportedHardware
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

// Normalized reported name → catalog model ids confirmed for it.
type ConfirmedNames = Map<string, string[]>;

export function normalizeMac(mac: string): string {
  const result = MACAddress.create(mac);
  return result.isSuccess ? result.value.value : mac.toUpperCase();
}

export function normalizeSerial(serial: string): string {
  return serial.trim().toUpperCase();
}

// What one box says about itself. A radio reports its MAC and model; a
// MikroTik also its serial and the name it gives itself (DEV-215).
export type AssessedReport = Pick<
  ReportedHardware,
  'hardware' | 'macAddress' | 'deviceModel'
> &
  Partial<Pick<ReportedHardware, 'serialNumber' | 'identity'>>;

interface Differences {
  hardware: DeviceHardware;
  currentMac: string | null;
  polledMac: string | null;
  currentSerial: string | null;
  polledSerial: string | null;
  polledModel: string | null;
  polledIdentity: string | null;
}

// Compares what boxes report about their own hardware with inventory and
// says how each difference should be resolved (WLS-152, WLS-153, WLS-155,
// DEV-215, DEV-216). Takes a batch so the fleet view costs a few lookups,
// not a few per box.
export class HardwareChangeAssessor {
  constructor(
    private readonly hardwareQuery: IDeviceHardwareQuery,
    private readonly logger: ILogger
  ) {}

  public async assess(
    reports: AssessedReport[]
  ): Promise<Result<Map<string, DeviceIdentitySuggestionDTO[]>>> {
    const naive = reports.map((r) => this.differences(r));
    const confirmed = await this.loadConfirmedNamesIfNeeded(naive);
    const differences = naive.map((d) =>
      this.withoutConfirmedName(d, confirmed)
    );

    const macSwaps = await this.findSwapCandidatesByMac(differences);
    const serialSwaps =
      await this.findSwapCandidatesBySerial(differences);
    const catalogResult = await this.loadCatalogIfNeeded(differences);
    if (catalogResult.isFailure) {
      return Result.fail(catalogResult.error);
    }

    const byDevice = new Map<string, DeviceIdentitySuggestionDTO[]>();
    for (const d of differences) {
      const swapWith =
        (d.polledSerial ? serialSwaps.get(d.polledSerial) : null) ??
        (d.polledMac ? macSwaps.get(d.polledMac) : null) ??
        null;
      const suggestions: DeviceIdentitySuggestionDTO[] = [];

      if (d.polledIdentity) {
        suggestions.push({
          field: 'name',
          currentValue: d.hardware.name,
          suggestedValue: d.polledIdentity,
          currentLabel: null,
          suggestedLabel: null,
          actions: ['UPDATE'],
          swapWith: null
        });
      }

      if (d.polledSerial) {
        suggestions.push({
          field: 'serialNumber',
          currentValue: d.hardware.serialNumber,
          suggestedValue: d.polledSerial,
          currentLabel: null,
          suggestedLabel: null,
          actions: swapWith
            ? ['SWAP']
            : this.identifierActions(d.currentSerial, d.hardware),
          swapWith
        });
      }

      if (d.polledMac) {
        suggestions.push({
          field: 'macAddress',
          currentValue: d.hardware.macAddress,
          suggestedValue: d.polledMac,
          currentLabel: null,
          suggestedLabel: null,
          actions: swapWith
            ? ['SWAP']
            : this.identifierActions(d.currentMac, d.hardware),
          swapWith
        });
      }

      if (d.polledModel) {
        const match = matchReportedModel(
          d.polledModel,
          catalogResult.value,
          d.hardware.vendorId,
          confirmed.get(normalizeModelName(d.polledModel))
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

  private differences(report: AssessedReport): Differences {
    const { hardware } = report;
    const currentMac = hardware.macAddress
      ? normalizeMac(hardware.macAddress)
      : null;
    const reportedMac = report.macAddress
      ? normalizeMac(report.macAddress)
      : null;
    const currentSerial = hardware.serialNumber?.trim()
      ? normalizeSerial(hardware.serialNumber)
      : null;
    const reportedSerial = report.serialNumber?.trim()
      ? normalizeSerial(report.serialNumber)
      : null;
    const reportedModel = report.deviceModel?.trim() || null;
    const reportedIdentity = report.identity?.trim() || null;
    // The MAC or serial on file reported back means the same box, so a
    // different model name can only be the box and the catalog spelling it
    // differently.
    const sameBox =
      (currentMac !== null && reportedMac === currentMac) ||
      (currentSerial !== null && reportedSerial === currentSerial);

    return {
      hardware,
      currentMac,
      polledMac:
        reportedMac && reportedMac !== currentMac
          ? reportedMac
          : null,
      currentSerial,
      polledSerial:
        reportedSerial && reportedSerial !== currentSerial
          ? reportedSerial
          : null,
      polledModel:
        reportedModel &&
        !sameBox &&
        normalizeModelName(reportedModel) !==
          normalizeModelName(hardware.modelName)
          ? reportedModel
          : null,
      // DEV-216: case and surrounding spaces are not a different name
      polledIdentity:
        reportedIdentity &&
        reportedIdentity.toLowerCase() !==
          hardware.name.trim().toLowerCase()
          ? reportedIdentity
          : null
    };
  }

  private withoutConfirmedName(
    d: Differences,
    confirmed: ConfirmedNames
  ): Differences {
    if (!d.polledModel) return d;
    const ids =
      confirmed.get(normalizeModelName(d.polledModel)) ?? [];
    return ids.includes(d.hardware.deviceModelId)
      ? { ...d, polledModel: null }
      : d;
  }

  // Without the confirmations the check still works, it just reports naming
  // differences as model changes — not worth failing the response over.
  private async loadConfirmedNamesIfNeeded(
    differences: Differences[]
  ): Promise<ConfirmedNames> {
    const confirmed: ConfirmedNames = new Map();
    if (differences.every((d) => d.polledModel === null)) {
      return confirmed;
    }

    const result = await this.hardwareQuery.findConfirmedModelNames();
    if (result.isFailure) {
      this.logger.warn('Confirmed model names unavailable', {
        error: result.error
      });
      return confirmed;
    }
    for (const row of result.value) {
      const key = normalizeModelName(row.reportedModel);
      confirmed.set(key, [
        ...(confirmed.get(key) ?? []),
        row.deviceModelId
      ]);
    }
    return confirmed;
  }

  // A unit in service that reports a different MAC or serial is most likely
  // a swapped box, but could be a typo when it was entered — so both are
  // offered, replacement first.
  private identifierActions(
    current: string | null,
    hardware: DeviceHardware
  ): DeviceIdentitySuggestionAction[] {
    if (current === null || hardware.inInventory) {
      return ['UPDATE'];
    }
    return ['REPLACE', 'UPDATE'];
  }

  // A reported MAC on another inventory record means the two units traded
  // places, which swap-hardware handles and replace would refuse (the MAC is
  // taken). A failed lookup only costs the swap hint, so it is not fatal.
  private async findSwapCandidatesByMac(
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

  // DEV-216: the same for a serial a MikroTik reports.
  private async findSwapCandidatesBySerial(
    differences: Differences[]
  ): Promise<Map<string, SwapCandidateDTO>> {
    const swaps = new Map<string, SwapCandidateDTO>();
    const serials = differences
      .map((d) => d.polledSerial)
      .filter((serial): serial is string => serial !== null);
    if (serials.length === 0) return swaps;

    const ownersResult =
      await this.hardwareQuery.findDevicesBySerial(serials);
    if (ownersResult.isFailure) {
      this.logger.warn('Device lookup by serial failed', {
        error: ownersResult.error
      });
      return swaps;
    }
    for (const owner of ownersResult.value) {
      swaps.set(normalizeSerial(owner.serialNumber), {
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
