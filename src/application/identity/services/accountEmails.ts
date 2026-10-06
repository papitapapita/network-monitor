import { EmailMessage } from 'application/shared/interfaces';

const TIME_ZONE = 'America/Bogota';

function localTime(date: Date): string {
  return date.toLocaleString('es-CO', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// IDN-181.
export function newSignInEmail(
  to: string,
  at: Date,
  sourceIp: string | null
): EmailMessage {
  const from = sourceIp
    ? `desde la dirección ${sourceIp}`
    : 'desde una dirección desconocida';
  return {
    to,
    subject: 'Nuevo inicio de sesión en su cuenta',
    text: [
      'Hola,',
      '',
      `Se inició sesión en su cuenta ${to} el ${localTime(at)} (hora de Colombia) ${from}, en un navegador que no estaba recordado.`,
      '',
      'Si fue usted, no tiene que hacer nada.',
      '',
      'Si no fue usted, cambie su contraseña ahora y pida a un administrador que reinicie su verificación en dos pasos: quien entró conoce su contraseña y un código de su app o de recuperación.'
    ].join('\n')
  };
}

// IDN-182.
export function passwordResetEmail(
  to: string,
  link: string
): EmailMessage {
  return {
    to,
    subject: 'Restablecer su contraseña',
    text: [
      'Hola,',
      '',
      `Alguien pidió restablecer la contraseña de su cuenta ${to}. Para elegir una nueva, abra este enlace:`,
      '',
      link,
      '',
      'El enlace vence en una hora y sirve una sola vez. Al cambiar la contraseña se cierran todas sus sesiones; la verificación en dos pasos sigue igual.',
      '',
      'Si no lo pidió usted, ignore este correo: su contraseña no cambia.'
    ].join('\n')
  };
}

// IDN-184.
export function invitationEmail(
  to: string,
  link: string
): EmailMessage {
  return {
    to,
    subject: 'Su cuenta está lista',
    text: [
      'Hola,',
      '',
      `Un administrador creó una cuenta para usted con el correo ${to}. Para elegir su contraseña, abra este enlace:`,
      '',
      link,
      '',
      'El enlace vence en siete días y sirve una sola vez. Si vence, use "Olvidé mi contraseña" en la página de inicio de sesión.',
      '',
      'En su primer inicio de sesión configurará la verificación en dos pasos con una app de códigos, como Google Authenticator o Microsoft Authenticator.'
    ].join('\n')
  };
}
