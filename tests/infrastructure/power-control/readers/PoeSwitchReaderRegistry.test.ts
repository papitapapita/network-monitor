// Source: src/infrastructure/power-control/readers/PoeSwitchReaderRegistry.ts

import { Result } from '../../../../src/domain/shared/core';
import { PoeSwitchReaderRegistry } from '../../../../src/infrastructure/power-control/readers';
import {
  IPoeSwitchReader,
  PoeSwitchConnection
} from '../../../../src/application/power-control/interfaces';

const LOGIN = {
  username: 'admin',
  password: 'secret',
  apiPort: 8728,
  httpPort: 80
};

function makeReader(version: string): jest.Mocked<IPoeSwitchReader> {
  return {
    read: jest
      .fn()
      .mockResolvedValue(
        Result.ok({ firmwareVersion: version, ports: [] })
      )
  };
}

describe('PoeSwitchReaderRegistry', () => {
  it.each([
    ['ROUTEROS', '7.15.3'],
    ['SWOS', '2.13']
  ] as const)(
    '[PWR-001] should read a %s switch with its own reader',
    async (firmware, version) => {
      const readers = {
        ROUTEROS: makeReader('7.15.3'),
        SWOS: makeReader('2.13')
      };
      const connection: PoeSwitchConnection = {
        host: '10.0.5.2',
        firmware,
        login: LOGIN
      };

      const result = await new PoeSwitchReaderRegistry(readers).read(
        connection
      );

      expect(result.value.firmwareVersion).toBe(version);
      expect(readers[firmware].read).toHaveBeenCalledWith(connection);
    }
  );
});
