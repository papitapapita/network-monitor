import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { IPasswordService } from 'application/identity/interfaces/IPasswordService';

const COST = 10;

export class BcryptPasswordService implements IPasswordService {
  public async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, COST);
  }

  public async compare(
    plain: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  public async unusableHash(): Promise<string> {
    return bcrypt.hash(randomBytes(32).toString('base64'), COST);
  }
}
