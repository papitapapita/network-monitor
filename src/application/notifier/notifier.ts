import { PingResponse } from 'ping';
import nodemailer from 'nodemailer';
import { config } from '../../config/config.js';

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: false,
  auth: {
    user: config.emailUser,
    pass: config.emailPass
  }
});

async function notifyFailure(result: PingResponse) {
  try {
    const info = await transporter.sendMail({
      from: config.emailUser,
      to: config.emailTarget,
      subject: `AP CAÍDA ${result.host}`,
      text: `🚨 AP ${result.host} es inalcanzable. Por favor revisar`,
      html: `<p>🚨 <b>ALERTA: </b><br>AP: ${result.host}<br>Caida paquetes: ${result.packetLoss}%<br>Promedio: ${result.avg}<br>Hora: ${new Date()}</p>`
    });

    console.log(`📧 Email sent: ${info.messageId}`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
  }
}

export async function analyzeResults(result: PingResponse) {
  console.log(
    `${result.host}: ${result.alive ? '✅ Alive' : '❌ Down'}`
  );

  if (!result.alive || Number(result.packetLoss) >= 60) {
    notifyFailure(result);
  }
}
