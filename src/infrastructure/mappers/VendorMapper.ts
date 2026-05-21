import { Vendor } from '../../domain/device-inventory/aggregates';
import { VendorId } from '../../domain/shared/ids';
import { Result } from '../../domain/shared/core';

type PrismaVendorRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VendorPersistenceData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class VendorMapper {
  public static toDomain(raw: PrismaVendorRecord): Result<Vendor> {
    const idResult = VendorId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<Vendor>(
        `Invalid vendor ID: ${idResult.error}`
      );
    }

    const vendor = Vendor.reconstitute(idResult.value, {
      name: raw.name,
      slug: raw.slug,
      description: raw.description,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    });

    return Result.ok<Vendor>(vendor);
  }

  public static toPersistence(vendor: Vendor): VendorPersistenceData {
    return {
      id: vendor.id.toString(),
      name: vendor.name,
      slug: vendor.slug,
      description: vendor.description,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    };
  }
}
