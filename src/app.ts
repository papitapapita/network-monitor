import { checkHost } from './application/monitor/monitor.js';
import 'dotenv/config.js';
import { analyzeResults } from './application/notifier/notifier.js';

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  hosts: process.env.HOSTS?.split(','),
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT),
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  emailTarget: process.env.EMAIL_TARGET
};

checkHost({
  hosts: config.hosts!,
  callback: analyzeResults,
  options: {
    timeout: 2,
    min_reply: 5
  }
});
