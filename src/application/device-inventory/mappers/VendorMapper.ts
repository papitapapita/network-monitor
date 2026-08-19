import { Vendor } from 'domain/device-inventory';
import {
  VendorResponseDTO,
  VendorListResponseDTO,
  CreateVendorRequestDTO,
  UpdateVendorRequestDTO
} from '../dtos';

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

  public static extractCreateData(dto: CreateVendorRequestDTO) {
    return {
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null
    };
  }

  public static extractUpdateData(dto: UpdateVendorRequestDTO) {
    const updates: {
      name?: string;
      slug?: string;
      description?: string | null;
    } = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.slug !== undefined) updates.slug = dto.slug;
    if (dto.description !== undefined)
      updates.description = dto.description;
    return updates;
  }
}
