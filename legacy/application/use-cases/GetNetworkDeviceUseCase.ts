import {
  Result,
  NetworkDeviceId
} from '../../../domain/device-inventory';
import { INetworkDeviceRepository } from '../../../domain/device-inventory/repository/INetworkDeviceRepository';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { NetworkDeviceResponseDTO } from '../dtos/network-device/NetworkDeviceDTO';
import { NetworkDeviceMapper } from '../mappers/NetworkDeviceMapper';

/**
 * GetNetworkDeviceUseCase
 *
 * Retrieves a single network device by its ID.
 */
export class GetNetworkDeviceUseCase extends UseCase<
  { id: string },
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'GetNetworkDeviceUseCase');
  }

  protected async executeImpl(request: {
    id: string;
  }): Promise<Result<NetworkDeviceResponseDTO>> {
    // Validate ID format
    const deviceId = NetworkDeviceId.create(request.id);
    if (deviceId.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Invalid device ID: ${deviceId.error}`
      );
    }

    // Find device
    const deviceResult = await this.deviceRepository.findById(
      deviceId.value
    );
    if (deviceResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(deviceResult.error!);
    }

    if (!deviceResult.value) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Network device with ID ${request.id} not found`
      );
    }

    // Convert to DTO
    const responseDTO = NetworkDeviceMapper.toDTO(deviceResult.value);
    return this.ok<NetworkDeviceResponseDTO>(responseDTO);
  }
}
