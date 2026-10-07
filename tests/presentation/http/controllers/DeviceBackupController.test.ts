// Source: src/presentation/http/controllers/DeviceBackupController.ts

import { Request, Response } from 'express';
import { DeviceBackupController } from '../../../../src/presentation/http/controllers/DeviceBackupController';
import {
  BackUpDeviceNowUseCase,
  DiffDeviceBackupsUseCase,
  DownloadDeviceBackupUseCase,
  ListDeviceBackupsUseCase
} from '../../../../src/application/device-backups/use-cases';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const DEVICE_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const createMockLogger = (): jest.Mocked<ILogger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis() as jest.Mocked<ILogger>['child'],
  setLevel: jest.fn()
});

const createMockResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    set: jest.fn(),
    send: jest.fn()
  };
  res.status.mockReturnValue(res);
  res.set.mockReturnValue(res);
  return res;
};

describe('DeviceBackupController', () => {
  let list: { execute: jest.Mock };
  let backUpNow: { execute: jest.Mock };
  let download: { execute: jest.Mock };
  let diff: { execute: jest.Mock };
  let controller: DeviceBackupController;
  const req = {
    params: { id: DEVICE_UUID, backupId: DEVICE_UUID }
  } as unknown as Request;

  beforeEach(() => {
    list = { execute: jest.fn() };
    backUpNow = { execute: jest.fn() };
    download = { execute: jest.fn() };
    diff = { execute: jest.fn() };
    controller = new DeviceBackupController(
      list as unknown as ListDeviceBackupsUseCase,
      backUpNow as unknown as BackUpDeviceNowUseCase,
      download as unknown as DownloadDeviceBackupUseCase,
      diff as unknown as DiffDeviceBackupsUseCase,
      createMockLogger()
    );
  });

  describe('backUpNow', () => {
    it.each([
      ['Cannot back up this device: no login', 409],
      ['Backup failed: HTTPS_TIMEOUT', 502],
      ['Device not found', 404],
      ['Invalid device ID: bad', 400],
      ['Database error saving device backup state: boom', 500]
    ])('should map "%s" to %i', async (error, status) => {
      backUpNow.execute.mockResolvedValue(Result.fail(error));
      const res = createMockResponse();

      await controller.backUpNow(req, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({ error });
    });

    it('should answer 500 when the use case throws', async () => {
      backUpNow.execute.mockRejectedValue(new Error('boom'));
      const res = createMockResponse();

      await controller.backUpNow(req, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('download', () => {
    it('should send the file with download headers', async () => {
      download.execute.mockResolvedValue(
        Result.ok({
          fileName: 'AP-1-20261007-0800Z.cfg',
          contentType: 'text/plain; charset=utf-8',
          content: 'a=1\n'
        })
      );
      const res = createMockResponse();

      await controller.download(req, res as unknown as Response);

      expect(download.execute).toHaveBeenCalledWith({
        deviceId: DEVICE_UUID,
        backupId: DEVICE_UUID
      });
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition':
          'attachment; filename="AP-1-20261007-0800Z.cfg"',
        'Cache-Control': 'no-store'
      });
      expect(res.send).toHaveBeenCalledWith('a=1\n');
    });
  });

  describe('diff', () => {
    const diffReq = {
      params: { id: DEVICE_UUID },
      query: { from: DEVICE_UUID, to: DEVICE_UUID }
    } as unknown as Request;

    it('should answer 200 with the comparison, never cached', async () => {
      const body = { identical: true, hunks: [] };
      diff.execute.mockResolvedValue(Result.ok(body));
      const res = createMockResponse();

      await controller.diff(diffReq, res as unknown as Response);

      expect(diff.execute).toHaveBeenCalledWith({
        deviceId: DEVICE_UUID,
        fromBackupId: DEVICE_UUID,
        toBackupId: DEVICE_UUID
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.set).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store'
      );
      expect(res.json).toHaveBeenCalledWith(body);
    });

    it.each([
      [
        'Invalid comparison: the two backups have different formats',
        400
      ],
      ['Backup not found', 404],
      ['Device not found', 404]
    ])('should map "%s" to %i', async (error, status) => {
      diff.execute.mockResolvedValue(Result.fail(error));
      const res = createMockResponse();

      await controller.diff(diffReq, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(status);
    });
  });
});
