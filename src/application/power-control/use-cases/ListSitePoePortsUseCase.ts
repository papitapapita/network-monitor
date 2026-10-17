import { Result } from 'domain/shared/core';
import { LocationId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ListSitePoePortsRequestDTO,
  SitePoePortsResponseDTO
} from '../dtos';
import { IPoeSwitchTargetsQuery } from '../interfaces';
import { SitePoeInspector } from '../services';

export class ListSitePoePortsUseCase extends UseCase<
  ListSitePoePortsRequestDTO,
  SitePoePortsResponseDTO
> {
  constructor(
    private readonly targets: IPoeSwitchTargetsQuery,
    private readonly inspector: SitePoeInspector,
    logger: ILogger
  ) {
    super(logger, 'ListSitePoePortsUseCase');
  }

  protected async executeImpl(
    request: ListSitePoePortsRequestDTO
  ): Promise<Result<SitePoePortsResponseDTO>> {
    const locationId = LocationId.parse(request.locationId);
    if (locationId.isFailure)
      return this.fail(`Invalid location ID: ${locationId.error}`);
    const id = locationId.value.toString();

    const site = await this.targets.findSite(id);
    if (site.isFailure) return Result.fail(site.error);
    if (!site.value) return this.fail('Location not found');

    const candidates = await this.targets.listSwitchesAtSite(id);
    if (candidates.isFailure) return Result.fail(candidates.error);

    const switches = await this.inspector.inspect(
      id,
      candidates.value
    );
    if (switches.isFailure) return Result.fail(switches.error);

    return this.ok({
      locationId: id,
      locationName: site.value.locationName,
      switches: switches.value
    });
  }
}
