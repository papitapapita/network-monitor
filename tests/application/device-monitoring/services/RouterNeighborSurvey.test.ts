// Source: src/application/device-monitoring/services/RouterNeighborSurvey.ts

import { RouterNeighborSurvey } from '../../../../src/application/device-monitoring/services';
import {
  IPortSpeedTargetsQuery,
  IRouterNeighborReader,
  PortSpeedRouterCandidate,
  RouterNeighborsReading
} from '../../../../src/application/device-monitoring/interfaces';
import { Result } from '../../../../src/domain/shared/core';

function candidate(
  deviceId: string,
  overrides: Partial<PortSpeedRouterCandidate> = {}
): PortSpeedRouterCandidate {
  return {
    deviceId,
    deviceName: `Router ${deviceId}`,
    ipAddress: `10.0.0.${deviceId.length}`,
    reach: { by: 'server' },
    login: { username: 'admin', password: 'secret', apiPort: 8728 },
    ...overrides
  };
}

const READING: RouterNeighborsReading = {
  ports: [{ name: 'ether1', comment: null }],
  neighbors: [
    {
      port: 'ether1',
      macAddress: '24:A4:3C:00:00:01',
      ipAddress: '10.0.0.21',
      identity: 'AP 32',
      platform: 'LiteBeam M5',
      board: null,
      version: null,
      remoteInterface: 'br0'
    }
  ]
};

describe('RouterNeighborSurvey', () => {
  let targets: jest.Mocked<IPortSpeedTargetsQuery>;
  let reader: jest.Mocked<IRouterNeighborReader>;
  let survey: RouterNeighborSurvey;

  beforeEach(() => {
    targets = {
      listRouters: jest
        .fn()
        .mockResolvedValue(
          Result.ok([
            candidate('a'),
            candidate('bb', { login: null }),
            candidate('ccc')
          ])
        ),
      findRouter: jest
        .fn()
        .mockResolvedValue(Result.ok(candidate('a')))
    };
    reader = {
      read: jest.fn(
        async (
          connection
        ): Promise<Result<RouterNeighborsReading>> =>
          connection.host === '10.0.0.3'
            ? Result.fail('RouterOS API error: timeout')
            : Result.ok(READING)
      )
    };
    survey = new RouterNeighborSurvey(targets, reader);
  });

  it('[MON-201] reads every router and reports the ones it could not', async () => {
    const result = await survey.survey();

    expect(result.value.routers).toEqual([
      { deviceId: 'a', deviceName: 'Router a', ...READING }
    ]);
    expect(result.value.unreadRouters).toEqual([
      {
        deviceId: 'bb',
        name: 'Router bb',
        reason: 'The router has no username and password saved'
      },
      {
        deviceId: 'ccc',
        name: 'Router ccc',
        reason: 'RouterOS API error: timeout'
      }
    ]);
    expect(reader.read).toHaveBeenCalledTimes(2);
  });

  it('[MON-201] fails only when the routers cannot be listed', async () => {
    targets.listRouters.mockResolvedValue(Result.fail('db down'));

    const result = await survey.survey();

    expect(result.error).toBe('db down');
  });

  it('[MON-201] reads one router on its own', async () => {
    const result = await survey.surveyOne('a');

    expect(targets.findRouter).toHaveBeenCalledWith('a');
    expect(result.value!.routers).toHaveLength(1);
  });

  it('[MON-201] answers null for a device that is not one of the routers', async () => {
    targets.findRouter.mockResolvedValue(Result.ok(null));

    const result = await survey.surveyOne('x');

    expect(result.value).toBeNull();
    expect(reader.read).not.toHaveBeenCalled();
  });
});
