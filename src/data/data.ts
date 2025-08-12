// Auto-generated data file - 2025-08-12T02:06:05.156Z
import { DatabaseData } from '../types/';

export const databaseData: DatabaseData = {
  "globalSettings": {
    "defaultTimeout": 3000,
    "defaultFrequency": 10000,
    "maxRetries": 3,
    "enableLogging": true,
    "logLevel": "info",
    "alertThreshold": 1000,
    "batchSize": 10
  },
  "apList": [
    {
      "IPaddress": "8.8.8.8",
      "frequencyToPoll": 10000,
      "timeout": 3000,
      "enabled": true,
      "name": "Updated Google DNS",
      "description": "Primary Google DNS server",
      "lastUpdated": "2025-08-12T02:06:05.155Z"
    },
    {
      "IPaddress": "8.8.4.4",
      "frequencyToPoll": 10000,
      "timeout": 3000,
      "enabled": true,
      "name": "Google DNS Secondary",
      "description": "Secondary Google DNS server",
      "lastUpdated": "2025-08-12T02:06:05.155Z"
    },
    {
      "IPaddress": "1.1.1.1",
      "frequencyToPoll": 2000,
      "name": "Cloudflare DNS",
      "description": "Cloudflare public DNS",
      "timeout": 3000,
      "enabled": true,
      "lastUpdated": "2025-08-12T02:06:05.155Z"
    }
  ],
  "lastModified": "2025-08-12T02:06:05.156Z"
};
