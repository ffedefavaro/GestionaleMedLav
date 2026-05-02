import { get } from 'idb-keyval';
import { executeQuery, runCommand } from './db';
import type { EmailLog, EmailTemplate, Worker } from '../types';

export const checkEmailConfiguration = async (): Promise<{ configured: boolean; email: string | null }> => {
  const accessToken = await get('google_access_token');
  const senderEmail = await get('sender_email');
  return {
    configured: !!(accessToken && senderEmail),
    email: senderEmail || null
  };
};

export const sendEmailViaGmail = async (
  destinatario: string,
  soggetto: string,
  corpo: string,
  visitId?: number,
  attachment?: { filename: string; content: string; type: string }
): Promise<boolean> => {
  const { configured } = await checkEmailConfiguration();
  if (!configured) {
    await logEmailAttempt(destinatario, soggetto, 'non inviato - email non configurata', visitId);
    return false;
  }

  const accessToken = await get('google_access_token');

  try {
    let rawMessage = "";
    const boundary = "boundary_string";

    if (attachment) {
      rawMessage = [
        `To: ${destinatario}`,
        `Subject: ${soggetto}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 7bit",
        "",
        corpo,
        "",
        `--${boundary}`,
        `Content-Type: ${attachment.type}; name="${attachment.filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        "",
        attachment.content,
        `--${boundary}--`,
      ].join("\r\n");
    } else {
      rawMessage = [
        `To: ${destinatario}`,
        `Subject: ${soggetto}`,
        "",
        corpo
      ].join("\r\n");
    }

    const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedMessage })
    });

    if (response.ok) {
      await logEmailAttempt(destinatario, soggetto, 'successo', visitId);
      return true;
    } else {
      const errorData = await response.json();
      await logEmailAttempt(destinatario, soggetto, 'errore', visitId, JSON.stringify(errorData));
      return false;
    }
  } catch (error) {
    await logEmailAttempt(destinatario, soggetto, 'errore', visitId, error instanceof Error ? error.message : String(error));
    return false;
  }
};

const logEmailAttempt = async (
  destinatario: string,
  oggetto: string,
  esito: EmailLog['esito'],
  visitId?: number,
  errore?: string
) => {
  await runCommand(
    "INSERT INTO email_logs (destinatario, oggetto, visit_id, esito, errore_dettaglio) VALUES (?, ?, ?, ?, ?)",
    [destinatario, oggetto, visitId || null, esito, errore || null]
  );

  await runCommand(
    "INSERT INTO audit_logs (action, table_name, details) VALUES (?, ?, ?)",
    ["EMAIL_SEND", "email_logs", `Invio a ${destinatario}: ${esito}`]
  );
};

export const processAutomaticReminders = async () => {
  const { configured } = await checkEmailConfiguration();
  const automaticEnabled = await get('automatic_reminders');

  if (!configured || !automaticEnabled) {
    if (!configured) console.warn("Reminder non inviato: email mittente non configurata");
    return;
  }

  const senderName = await get('sender_name') || "Medico Competente";
  const template = executeQuery("SELECT * FROM email_templates WHERE tipo = 'reminder'")[0] as EmailTemplate;

  if (!template) return;

  const today = new Date();
  const next30Days = new Date();
  next30Days.setDate(today.getDate() + 30);
  const next7Days = new Date();
  next7Days.setDate(today.getDate() + 7);

  const formatted30 = next30Days.toISOString().split('T')[0];
  const formatted7 = next7Days.toISOString().split('T')[0];

  const workersToRemind = executeQuery(`
    SELECT w.*, c.ragione_sociale as azienda, MAX(v.scadenza_prossima) as ultima_scadenza
    FROM workers w
    JOIN companies c ON w.company_id = c.id
    JOIN visits v ON w.id = v.worker_id
    WHERE (v.scadenza_prossima = ? OR v.scadenza_prossima = ?)
    AND w.email IS NOT NULL
    GROUP BY w.id
  `, [formatted30, formatted7]) as (Worker & { azienda: string, ultima_scadenza: string })[];

  for (const worker of workersToRemind) {
    const alreadySent = executeQuery(
      "SELECT id FROM email_logs WHERE destinatario = ? AND oggetto LIKE ? AND data_ora > datetime('now', '-1 day')",
      [worker.email, `%${worker.azienda}%`]
    );

    if (alreadySent.length === 0) {
      const corpo = template.corpo
        .replace(/{nome_lavoratore}/g, `${worker.nome} ${worker.cognome}`)
        .replace(/{data_visita}/g, worker.ultima_scadenza)
        .replace(/{azienda}/g, worker.azienda)
        .replace(/{medico}/g, senderName);

      const soggetto = template.soggetto.replace(/{azienda}/g, worker.azienda);

      await sendEmailViaGmail(worker.email, soggetto, corpo);
    }
  }
};
