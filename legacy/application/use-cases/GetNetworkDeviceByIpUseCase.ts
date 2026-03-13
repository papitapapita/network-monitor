import { Result, IPAddress } from '../../../domain/device-inventory';
import { INetworkDeviceRepository } from '../../../domain/device-inventory/repository/INetworkDeviceRepository';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import {
  GetNetworkDeviceByIpDTO,
  NetworkDeviceResponseDTO
} from '../dtos/network-device/NetworkDeviceDTO';
import { NetworkDeviceMapper } from '../mappers/NetworkDeviceMapper';

/**
 * GetNetworkDeviceByIpUseCase
 *
 * Retrieves a network device by its IP address.
 */
export class GetNetworkDeviceByIpUseCase extends UseCase<
  GetNetworkDeviceByIpDTO,
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'GetNetworkDeviceByIpUseCase');
  }

  protected async executeImpl(
    request: GetNetworkDeviceByIpDTO
  ): Promise<Result<NetworkDeviceResponseDTO>> {
    // Validate IP address format
    const ipAddress = IPAddress.create(request.ipAddress);
    if (ipAddress.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Invalid IP address: ${ipAddress.error}`
      );
    }

    // Find device
    const deviceResult = await this.deviceRepository.findByIpAddress(
      ipAddress.value
    );
    if (deviceResult.isFailure) {
      return this.fail<NetworkDeviceResponseDTO>(deviceResult.error!);
    }

    if (!deviceResult.value) {
      return this.fail<NetworkDeviceResponseDTO>(
        `Network device with IP ${request.ipAddress} not found`
      );
    }

    // Convert to DTO
    const responseDTO = NetworkDeviceMapper.toDTO(deviceResult.value);
    return this.ok<NetworkDeviceResponseDTO>(responseDTO);
  }
}
