import { GlobalSettings, APEntry } from "./";

export interface DatabaseData {
  globalSettings: GlobalSettings;
  apList: APEntry[];
  lastModified: Date;
  //version: string;
}
