export class NetworkDeviceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'NetworkDeviceError';
  }
}
