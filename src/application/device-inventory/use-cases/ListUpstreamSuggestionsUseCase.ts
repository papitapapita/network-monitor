import { Result } from 'domain/shared/core';
import { LocationId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IKnownDeviceLookup,
  IPoweringSwitchQuery,
  IReportedApQuery,
  IRouterNeighborQuery,
  ITopologyQuery
} from '../interfaces';
import {
  ListUpstreamSuggestionsRequestDTO,
  UpstreamSuggestionsResponseDTO
} from '../dtos';
import {
  RouterNeighborMap,
  UpstreamSuggester,
  findNeighborOwners
} from '../services';

export class ListUpstreamSuggestionsUseCase extends UseCase<
  ListUpstreamSuggestionsRequestDTO,
  UpstreamSuggestionsResponseDTO
> {
  constructor(
    private readonly topologyQuery: ITopologyQuery,
    private readonly reportedApQuery: IReportedApQuery,
    private readonly poweringSwitchQuery: IPoweringSwitchQuery,
    private readonly routerNeighborQuery: IRouterNeighborQuery,
    private readonly knownDevices: IKnownDeviceLookup,
    logger: ILogger
  ) {
    super(logger, 'ListUpstreamSuggestionsUseCase');
  }

  protected async executeImpl(
    request: ListUpstreamSuggestionsRequestDTO
  ): Promise<Result<UpstreamSuggestionsResponseDTO>> {
    let locationId: string | null = null;
    if (request.locationId !== undefined) {
      const parsed = LocationId.parse(request.locationId);
      if (parsed.isFailure) {
        return this.fail(`Invalid location ID: ${parsed.error}`);
      }
      locationId = parsed.value.toString();
    }

    const [rows, reportedAps, poweringSwitches, neighbors] =
      await Promise.all([
        this.topologyQuery.findAll(),
        this.reportedApQuery.findReportedAps(),
        this.poweringSwitchQuery.findPoweringSwitches(locationId),
        this.routerNeighborQuery.findRouterNeighbors()
      ]);
    if (rows.isFailure) {
      return this.fail(`Failed to load topology: ${rows.error}`);
    }
    if (reportedAps.isFailure) {
      return this.fail(
        `Failed to load the APs stations report: ${reportedAps.error}`
      );
    }
    if (poweringSwitches.isFailure) {
      return this.fail(
        `Failed to read the PoE switches: ${poweringSwitches.error}`
      );
    }

    if (neighbors.isFailure) {
      return this.fail(
        `Failed to read the routers' neighbours: ${neighbors.error}`
      );
    }
    const owners = await findNeighborOwners(
      this.knownDevices,
      neighbors.value.routers
    );
    if (owners.isFailure) return this.fail(owners.error);

    const neighborLinks = new RouterNeighborMap(
      neighbors.value.routers,
      owners.value,
      rows.value
    ).links();
    const suggestions = new UpstreamSuggester(rows.value).suggest(
      reportedAps.value,
      poweringSwitches.value.links,
      neighborLinks,
      locationId
    );
    return this.ok({
      suggestions,
      total: suggestions.length,
      unreadSwitches: poweringSwitches.value.unreadSwitches,
      unreadRouters: neighbors.value.unreadRouters
    });
  }
}
