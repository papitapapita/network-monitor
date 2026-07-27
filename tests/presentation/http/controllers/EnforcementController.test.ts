// Source: src/presentation/http/controllers/EnforcementController.ts

import { Request, Response } from 'express';
import { EnforcementController } from '../../../../src/presentation/http/controllers/EnforcementController';
import { ListSuspensionEnforcementsUseCase } from '../../../../src/application/service-enforcement/use-cases/ListSuspensionEnforcementsUseCase';
import { GetServiceEnforcementStatusUseCase } from '../../../../src/application/service-enforcement/use-cases/GetServiceEnforcementStatusUseCase';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const CS_UUID = '550e8400-e29b-41d4-a716-4466554400d1';
const CHECKED_AT = '2024-06-01T10:00:00.000Z';

const createMockListUseCase = () =>
  ({
    execute: jest.fn()
  }) as unknown as ListSuspensionEnforcementsUseCase;

const createMockGetUseCase = () =>
  ({
    execute: jest.fn()
  }) as unknown as GetServiceEnforcementStatusUseCase;

const createMockLogger = (): jest.Mocked<ILogger> =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  }) as unknown as jest.Mocked<ILogger>;

const createMockResponse = (): {
  res: Partial<Response>;
  statusMock: jest.Mock;
  jsonMock: jest.Mock;
} => {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return {
    res: { status: statusMock, json: jsonMock },
    statusMock,
    jsonMock
  };
};

describe('EnforcementController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when enforcement is not configured (null use cases)', () => {
    it('listSuspensions should return 503', async () => {
      const controller = new EnforcementController(
        null,
        null,
        createMockLogger()
      );
      const { res, statusMock, jsonMock } = createMockResponse();

      await controller.listSuspensions(
        {} as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Suspension enforcement is not configured'
      });
    });

    it('getServiceEnforcement should return 503', async () => {
      const controller = new EnforcementController(
        null,
        null,
        createMockLogger()
      );
      const { res, statusMock } = createMockResponse();

      await controller.getServiceEnforcement(
        { params: { id: CS_UUID } } as unknown as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(503);
    });
  });

  describe('listSuspensions (GET /api/enforcement/suspensions)', () => {
    it('should return 200 with the wrapped enforcement list', async () => {
      const listUseCase = createMockListUseCase();
      const dto = {
        checkedAt: CHECKED_AT,
        enforcements: [
          { contractedServiceId: CS_UUID, targetIp: '10.20.30.40' }
        ]
      };
      (listUseCase.execute as jest.Mock).mockResolvedValue(
        Result.ok(dto)
      );
      const controller = new EnforcementController(
        listUseCase,
        createMockGetUseCase(),
        createMockLogger()
      );
      const { res, statusMock, jsonMock } = createMockResponse();

      await controller.listSuspensions(
        {} as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: dto
      });
    });

    it('should return 503 when the router is unreachable', async () => {
      const listUseCase = createMockListUseCase();
      (listUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('RouterOS API error: connection timed out')
      );
      const controller = new EnforcementController(
        listUseCase,
        createMockGetUseCase(),
        createMockLogger()
      );
      const { res, statusMock, jsonMock } = createMockResponse();

      await controller.listSuspensions(
        {} as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'RouterOS API error: connection timed out'
      });
    });
  });

  describe('getServiceEnforcement (GET /api/contracted-services/:id/enforcement)', () => {
    it('should return 200 with the wrapped enforcement status', async () => {
      const getUseCase = createMockGetUseCase();
      const dto = {
        contractedServiceId: CS_UUID,
        enforced: true,
        targetIp: '10.20.30.40',
        checkedAt: CHECKED_AT
      };
      (getUseCase.execute as jest.Mock).mockResolvedValue(
        Result.ok(dto)
      );
      const controller = new EnforcementController(
        createMockListUseCase(),
        getUseCase,
        createMockLogger()
      );
      const { res, statusMock, jsonMock } = createMockResponse();

      await controller.getServiceEnforcement(
        { params: { id: CS_UUID } } as unknown as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: dto
      });
      expect(getUseCase.execute).toHaveBeenCalledWith({
        contractedServiceId: CS_UUID
      });
    });

    it('should return 400 on an invalid id', async () => {
      const getUseCase = createMockGetUseCase();
      (getUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Invalid contracted service ID: bad uuid')
      );
      const controller = new EnforcementController(
        createMockListUseCase(),
        getUseCase,
        createMockLogger()
      );
      const { res, statusMock } = createMockResponse();

      await controller.getServiceEnforcement(
        { params: { id: 'bad' } } as unknown as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 500 and log on unexpected errors', async () => {
      const getUseCase = createMockGetUseCase();
      const thrown = new Error('boom');
      (getUseCase.execute as jest.Mock).mockRejectedValue(thrown);
      const logger = createMockLogger();
      const controller = new EnforcementController(
        createMockListUseCase(),
        getUseCase,
        logger
      );
      const { res, statusMock, jsonMock } = createMockResponse();

      await controller.getServiceEnforcement(
        { params: { id: CS_UUID } } as unknown as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
