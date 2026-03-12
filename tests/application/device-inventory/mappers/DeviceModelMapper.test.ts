// Source: src/application/device-inventory/mappers/DeviceModelMapper.ts

import { DeviceModelMapper } from '../../../../src/application/device-inventory/mappers/DeviceModelMapper';
import { DeviceModelRecord } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');
const UPDATED_DATE = new Date('2024-06-15T12:00:00.000Z');

function makeRecord(
  overrides: Partial<DeviceModelRecord> = {}
): DeviceModelRecord {
  return {
    id: VALID_UUID,
    manufacturer: 'Mikrotik',
    model: 'RB760iGS',
    deviceType: 'ROUTER',
    createdAt: BASE_DATE,
    updatedAt: UPDATED_DATE,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('DeviceModelMapper', () => {
  // =========================================================================
  describe('toDTO()', () => {
    // -----------------------------------------------------------------------
    describe('happy path — fully populated record', () => {
      it('should map id to string', () => {
        const dto = DeviceModelMapper.toDTO(makeRecord());

        expect(dto.id).toBe(VALID_UUID);
      });

      it('should map manufacturer as a string', () => {
        const dto = DeviceModelMapper.toDTO(makeRecord({ manufacturer: 'Ubiquiti' }));

        expect(dto.manufacturer).toBe('Ubiquiti');
      });

      it('should map model as a string', () => {
        const dto = DeviceModelMapper.toDTO(makeRecord({ model: 'UniFi AP AC Pro' }));

        expect(dto.model).toBe('UniFi AP AC Pro');
      });

      it('should map deviceType as a string', () => {
        const dto = DeviceModelMapper.toDTO(makeRecord({ deviceType: 'ACCESS_POINT' }));

        expect(dto.deviceType).toBe('ACCESS_POINT');
      });

      it('should map createdAt to an ISO 8601 string', () => {
        const dto = DeviceModelMapper.toDTO(makeRecord());

        expect(dto.createdAt).toBe(BASE_DATE.toISOString());
      });

      it('should map updatedAt to an ISO 8601 string', () => {
        const dto = DeviceModelMapper.toDTO(makeRecord());

        expect(dto.updatedAt).toBe(UPDATED_DATE.toISOString());
      });

      it('should return a DTO with exactly the expected keys', () => {
        const dto = DeviceModelMapper.toDTO(makeRecord());

        expect(Object.keys(dto).sort()).toEqual(
          ['id', 'manufacturer', 'model', 'deviceType', 'createdAt', 'updatedAt'].sort()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('date serialisation', () => {
      it('should produce different ISO strings when createdAt and updatedAt differ', () => {
        const dto = DeviceModelMapper.toDTO(makeRecord());

        expect(dto.createdAt).not.toBe(dto.updatedAt);
      });

      it('should produce the same ISO string when createdAt equals updatedAt', () => {
        const dto = DeviceModelMapper.toDTO(
          makeRecord({ createdAt: BASE_DATE, updatedAt: BASE_DATE })
        );

        expect(dto.createdAt).toBe(dto.updatedAt);
      });
    });
  });

  // =========================================================================
  describe('toListDTO()', () => {
    function makeRecordPage(count: number): DeviceModelRecord[] {
      return Array.from({ length: count }, (_, i) =>
        makeRecord({ id: `550e8400-e29b-41d4-a716-44665544000${i}` })
      );
    }

    // -----------------------------------------------------------------------
    describe('pagination metadata', () => {
      it('should include total count in the response', () => {
        const dto = DeviceModelMapper.toListDTO(makeRecordPage(5), 42, 20, 0);

        expect(dto.total).toBe(42);
      });

      it('should include limit in the response', () => {
        const dto = DeviceModelMapper.toListDTO(makeRecordPage(5), 42, 20, 0);

        expect(dto.limit).toBe(20);
      });

      it('should include offset in the response', () => {
        const dto = DeviceModelMapper.toListDTO(makeRecordPage(5), 42, 20, 20);

        expect(dto.offset).toBe(20);
      });

      it('should default limit to 20 when omitted', () => {
        const dto = DeviceModelMapper.toListDTO(makeRecordPage(3), 3);

        expect(dto.limit).toBe(20);
      });

      it('should default offset to 0 when omitted', () => {
        const dto = DeviceModelMapper.toListDTO(makeRecordPage(3), 3);

        expect(dto.offset).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('hasMore flag', () => {
      it('should be true when there are more items beyond the current page', () => {
        const dto = DeviceModelMapper.toListDTO(makeRecordPage(20), 50, 20, 0);

        expect(dto.hasMore).toBe(true);
      });

      it('should be false when the current page covers all remaining items', () => {
        const dto = DeviceModelMapper.toListDTO(makeRecordPage(10), 30, 20, 20);

        expect(dto.hasMore).toBe(false);
      });

      it('should be false when total equals page size', () => {
        const dto = DeviceModelMapper.toListDTO(makeRecordPage(20), 20, 20, 0);

        expect(dto.hasMore).toBe(false);
      });

      it('should be false for an empty result set', () => {
        const dto = DeviceModelMapper.toListDTO([], 0, 20, 0);

        expect(dto.hasMore).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('deviceModels array', () => {
      it('should map each record to a DeviceModelResponseDTO', () => {
        const records = makeRecordPage(3);

        const dto = DeviceModelMapper.toListDTO(records, 3, 20, 0);

        expect(dto.deviceModels).toHaveLength(3);
        dto.deviceModels.forEach((d) => {
          expect(d.id).toBeDefined();
          expect(d.manufacturer).toBeDefined();
          expect(d.model).toBeDefined();
          expect(d.deviceType).toBeDefined();
        });
      });

      it('should return an empty deviceModels array when the page is empty', () => {
        const dto = DeviceModelMapper.toListDTO([], 0, 20, 0);

        expect(dto.deviceModels).toEqual([]);
      });

      it('should use toDTO for each record — manufacturer flows through', () => {
        const records = [
          makeRecord({ manufacturer: 'Cisco' }),
          makeRecord({ manufacturer: 'Huawei' })
        ];

        const dto = DeviceModelMapper.toListDTO(records, 2, 20, 0);

        expect(dto.deviceModels[0].manufacturer).toBe('Cisco');
        expect(dto.deviceModels[1].manufacturer).toBe('Huawei');
      });
    });
  });
});
