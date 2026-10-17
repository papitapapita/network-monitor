import { Result } from 'domain/shared/core';
import type {
  IPoeSwitchReader,
  PoeSwitchConnection,
  PoeSwitchFirmware,
  PoeSwitchReading
} from 'application/power-control/interfaces';

// PWR-001: the firmware the switch's model runs picks how it is read.
export class PoeSwitchReaderRegistry implements IPoeSwitchReader {
  constructor(
    private readonly readers: Record<
      PoeSwitchFirmware,
      IPoeSwitchReader
    >
  ) {}

  read(
    connection: PoeSwitchConnection
  ): Promise<Result<PoeSwitchReading>> {
    return this.readers[connection.firmware].read(connection);
  }
}
