// Single-use codes that stand in for the app when the phone is lost
// (IDN-163). Only hashes are stored.
export interface IRecoveryCodes {
  generate(): { codes: string[]; hashes: string[] };
  hash(code: string): string;
}
