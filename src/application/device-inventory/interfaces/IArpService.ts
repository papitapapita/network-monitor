export interface IArpService {
  toMAC(ipAddress: string): Promise<string | null>;
}
