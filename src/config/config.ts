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

console.log(config);
