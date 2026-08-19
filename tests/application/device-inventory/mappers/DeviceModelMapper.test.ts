// Source: src/application/device-inventory/mappers/DeviceModelMapper.ts

import { DeviceModelMapper } from '../../../../src/application/device-inventory/mappers/DeviceModelMapper';
import { DeviceModel } from '../../../../src/domain/device-inventory/aggregates/DeviceModel';
import { DeviceType } from '../../../../src/domain/device-inventory/value-objects';
import {
  DeviceModelId,
  VendorId
} from '../../../../src/domain/shared/ids';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440001';
const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');
const UPDATED_DATE = new Date('2024-06-15T12:00:00.000Z');

function makeDeviceModel(
  overrides: Partial<{
    id: string;
    vendorId: string;
    vendorName: string;
    vendorSlug: string;
    model: string;
    deviceType: string;
    isWireless: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
): DeviceModel {
  const idStr = overrides.id ?? VALID_UUID;
  const vendorIdStr = overrides.vendorId ?? VENDOR_UUID;

  return DeviceModel.reconstitute(DeviceModelId.parse(idStr).value!, {
    vendorId: VendorId.parse(vendorIdStr).value!,
    vendorName: overrides.vendorName ?? 'Mikrotik',
    vendorSlug: overrides.vendorSlug ?? 'mikrotik',
    model: overrides.model ?? 'RB760iGS',
    deviceType: DeviceType.reconstitute(
      overrides.deviceType ?? 'ROUTER'
    ),
    isWireless: overrides.isWireless ?? false,
    createdAt: overrides.createdAt ?? BASE_DATE,
    updatedAt: overrides.updatedAt ?? UPDATED_DATE
  });
}

// ---------------------------------------------------------------------------

describe('DeviceModelMapper', () => {
  // =========================================================================
  describe('toDTO()', () => {
    // -----------------------------------------------------------------------
    describe('happy path — fully populated aggregate', () => {
      it('should map id to string', () => {
        const dto = DeviceModelMapper.toDTO(makeDeviceModel());

        expect(dto.id).toBe(VALID_UUID);
      });

      it('should map vendorId as a string', () => {
        const dto = DeviceModelMapper.toDTO(makeDeviceModel());

        expect(dto.vendorId).toBe(VENDOR_UUID);
      });

      it('should map vendorName as a string', () => {
        const dto = DeviceModelMapper.toDTO(
          makeDeviceModel({ vendorName: 'Ubiquiti' })
        );

        expect(dto.vendorName).toBe('Ubiquiti');
      });

      it('should map vendorSlug as a string', () => {
        const dto = DeviceModelMapper.toDTO(
          makeDeviceModel({ vendorSlug: 'ubiquiti' })
        );

        expect(dto.vendorSlug).toBe('ubiquiti');
      });

      it('should map model as a string', () => {
        const dto = DeviceModelMapper.toDTO(
          makeDeviceModel({ model: 'UniFi AP AC Pro' })
        );

        expect(dto.model).toBe('UniFi AP AC Pro');
      });

      it('should map deviceType as a string', () => {
        const dto = DeviceModelMapper.toDTO(
          makeDeviceModel({ deviceType: 'SWITCH' })
        );

        expect(dto.deviceType).toBe('SWITCH');
      });

      it('should map createdAt to an ISO 8601 string', () => {
        const dto = DeviceModelMapper.toDTO(makeDeviceModel());

        expect(dto.createdAt).toBe(BASE_DATE.toISOString());
      });

      it('should map updatedAt to an ISO 8601 string', () => {
        const dto = DeviceModelMapper.toDTO(makeDeviceModel());

        expect(dto.updatedAt).toBe(UPDATED_DATE.toISOString());
      });

      it('should return a DTO with exactly the expected keys', () => {
        const dto = DeviceModelMapper.toDTO(makeDeviceModel());

        expect(Object.keys(dto).sort()).toEqual(
          [
            'id',
            'vendorId',
            'vendorName',
            'vendorSlug',
            'model',
            'deviceType',
            'isWireless',
            'createdAt',
            'updatedAt'
          ].sort()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('date serialisation', () => {
      it('should produce different ISO strings when createdAt and updatedAt differ', () => {
        const dto = DeviceModelMapper.toDTO(makeDeviceModel());

        expect(dto.createdAt).not.toBe(dto.updatedAt);
      });

      it('should produce the same ISO string when createdAt equals updatedAt', () => {
        const dto = DeviceModelMapper.toDTO(
          makeDeviceModel({
            createdAt: BASE_DATE,
            updatedAt: BASE_DATE
          })
        );

        expect(dto.createdAt).toBe(dto.updatedAt);
      });
    });
  });

  // =========================================================================
  describe('toListDTO()', () => {
    function makeModelPage(count: number): DeviceModel[] {
      return Array.from({ length: count }, (_, i) =>
        makeDeviceModel({
          id: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`
        })
      );
    }

    // -----------------------------------------------------------------------
    describe('pagination metadata', () => {
      it('should include total count in the response', () => {
        const dto = DeviceModelMapper.toListDTO(
          makeModelPage(5),
          42,
          20,
          0
        );

        expect(dto.total).toBe(42);
      });

      it('should include limit in the response', () => {
        const dto = DeviceModelMapper.toListDTO(
          makeModelPage(5),
          42,
          20,
          0
        );

        expect(dto.limit).toBe(20);
      });

      it('should include offset in the response', () => {
        const dto = DeviceModelMapper.toListDTO(
          makeModelPage(5),
          42,
          20,
          20
        );

        expect(dto.offset).toBe(20);
      });

      it('should default limit to 20 when omitted', () => {
        const dto = DeviceModelMapper.toListDTO(makeModelPage(3), 3);

        expect(dto.limit).toBe(20);
      });

      it('should default offset to 0 when omitted', () => {
        const dto = DeviceModelMapper.toListDTO(makeModelPage(3), 3);

        expect(dto.offset).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('hasMore flag', () => {
      it('should be true when there are more items beyond the current page', () => {
        const dto = DeviceModelMapper.toListDTO(
          makeModelPage(20),
          50,
          20,
          0
        );

        expect(dto.hasMore).toBe(true);
      });

      it('should be false when the current page covers all remaining items', () => {
        const dto = DeviceModelMapper.toListDTO(
          makeModelPage(10),
          30,
          20,
          20
        );

        expect(dto.hasMore).toBe(false);
      });

      it('should be false when total equals page size', () => {
        const dto = DeviceModelMapper.toListDTO(
          makeModelPage(20),
          20,
          20,
          0
        );

        expect(dto.hasMore).toBe(false);
      });

      it('should be false for an empty result set', () => {
        const dto = DeviceModelMapper.toListDTO([], 0, 20, 0);

        expect(dto.hasMore).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('deviceModels array', () => {
      it('should map each aggregate to a DeviceModelResponseDTO', () => {
        const models = makeModelPage(3);

        const dto = DeviceModelMapper.toListDTO(models, 3, 20, 0);

        expect(dto.deviceModels).toHaveLength(3);
        dto.deviceModels.forEach((d) => {
          expect(d.id).toBeDefined();
          expect(d.vendorName).toBeDefined();
          expect(d.model).toBeDefined();
          expect(d.deviceType).toBeDefined();
        });
      });

      it('should return an empty deviceModels array when the page is empty', () => {
        const dto = DeviceModelMapper.toListDTO([], 0, 20, 0);

        expect(dto.deviceModels).toEqual([]);
      });

      it('should use toDTO for each aggregate — vendorName flows through', () => {
        const models = [
          makeDeviceModel({ vendorName: 'Cisco' }),
          makeDeviceModel({ vendorName: 'Huawei' })
        ];

        const dto = DeviceModelMapper.toListDTO(models, 2, 20, 0);

        expect(dto.deviceModels[0].vendorName).toBe('Cisco');
        expect(dto.deviceModels[1].vendorName).toBe('Huawei');
      });
    });
  });
});
