export interface IPasswordService {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
  // The hash of a random password nobody is told, for an account that waits
  // for its owner to choose one (IDN-184).
  unusableHash(): Promise<string>;
}
