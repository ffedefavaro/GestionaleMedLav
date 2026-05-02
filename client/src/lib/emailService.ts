/**
 * Service to send emails using Gmail API
 */

export const sendGmailEmail = async (accessToken: string, to: string, subject: string, body: string) => {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    body,
  ];
  const message = messageParts.join('\n');

  // The base64url encoding
  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedMessage,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Errore nell\'invio dell\'email');
  }

  return await response.json();
};

export const sendProposalEmail = async (
  accessToken: string,
  workerEmail: string,
  workerNome: string,
  azienda: string,
  dataProposta: string,
  sede: string,
  medico: string
) => {
  const subject = `Proposta visita medica — ${azienda}`;
  const body = `Gentile ${workerNome},
Le proponiamo la seguente data per la visita di sorveglianza sanitaria:
📅 Data: ${dataProposta}
🏢 Sede: ${sede}

Se non è disponibile risponda a questa email indicando la sua disponibilità e provvederemo a trovare una data alternativa.

Cordiali saluti,
${medico}`;

  return await sendGmailEmail(accessToken, workerEmail, subject, body);
};

export const sendRescheduleEmail = async (
  accessToken: string,
  workerEmail: string,
  workerNome: string,
  azienda: string,
  nuovaData: string,
  sede: string,
  medico: string
) => {
  const subject = `Aggiornamento data visita medica — ${azienda}`;
  const body = `Gentile ${workerNome},
La data della Sua visita di sorveglianza sanitaria è stata modificata:
📅 Nuova Data: ${nuovaData}
🏢 Sede: ${sede}

Se non è disponibile risponda a questa email indicando la sua disponibilità.

Cordiali saluti,
${medico}`;

  return await sendGmailEmail(accessToken, workerEmail, subject, body);
};
