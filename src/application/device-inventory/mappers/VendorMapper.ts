import { Vendor } from '../../../domain/device-inventory/aggregates';
import { VendorResponseDTO, VendorListResponseDTO } from '../dtos';

export class VendorMapper {
  public static toDTO(vendor: Vendor): VendorResponseDTO {
    return {
      id: vendor.id.toString(),
      name: vendor.name,
      slug: vendor.slug,
      description: vendor.description,
      createdAt: vendor.createdAt.toISOString(),
      updatedAt: vendor.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    vendors: Vendor[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): VendorListResponseDTO {
    return {
      vendors: vendors.map((v) => this.toDTO(v)),
      total,
      hasMore: offset + vendors.length < total,
      limit,
      offset
    };
  }
}
