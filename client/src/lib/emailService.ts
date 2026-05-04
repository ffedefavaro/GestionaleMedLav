import { get } from 'idb-keyval';
import { initGapiClient } from './gmail';
import { executeQuery, runCommand } from './db';
import { generateCompletePDF, type Visit, type Worker, type Company, type DoctorProfile, type WorkHistory, type FamilyHistory, type PhysiologicalHistory } from './pdfGenerator';

// Extend existing GAPI types from gmail.ts for sending support
interface GapiSendMessageArgs {
  userId: string;
  resource: {
    raw: string;
  };
}

// Accessing window.gapi.client.gmail with extended type via casting to avoid global redeclaration conflicts
interface ExtendedGmail {
  users: {
    messages: {
      send: (args: GapiSendMessageArgs) => Promise<unknown>;
    };
  };
}

/**
 * Recupera l'email del mittente configurata in IndexedDB.
 */
export const getSenderEmail = async (): Promise<string | null> => {
  const email = await get('sender_email');
  if (!email) {
    console.warn("Email mittente non configurata in IndexedDB (chiave: 'sender_email')");
    return null;
  }
  return email as string;
};

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  attachment?: {
    filename: string;
    data: Uint8Array;
    mimeType: string;
  };
}

/**
 * Helper per inviare email tramite Gmail API.
 */
export const sendEmailViaGmail = async (params: SendEmailParams): Promise<boolean> => {
  const sender = await getSenderEmail();
  if (!sender) {
    return false;
  }

  if (!window.gapi?.client?.gmail) {
    try {
      await initGapiClient();
    } catch (e) {
      console.error("Errore inizializzazione GAPI:", e);
      return false;
    }
  }

  const { to, subject, body, attachment } = params;

  let mime = `To: ${to}\r\n`;
  mime += `Subject: ${subject}\r\n`;
  mime += `MIME-Version: 1.0\r\n`;

  if (attachment) {
    const boundary = "boundary_---_---_";
    mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    mime += `${body}\r\n\r\n`;
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
    mime += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
    mime += `Content-Transfer-Encoding: base64\r\n\r\n`;

    let binary = "";
    const bytes = attachment.data;
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    mime += btoa(binary) + "\r\n";
    mime += `--${boundary}--`;
  } else {
    mime += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    mime += `${body}`;
  }

  // Base64URL encoding for Gmail API
  const encodedMime = btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const gmail = (window.gapi.client as unknown as { gmail: ExtendedGmail }).gmail;
    await gmail.users.messages.send({
      userId: 'me',
      resource: {
        raw: encodedMime
      }
    });
    return true;
  } catch (error) {
    console.error("Errore invio email via Gmail API:", error);
    return false;
  }
};

/**
 * Controlla le visite in scadenza e invia reminder a 30 e 7 giorni.
 */
export const checkAndSendReminders = async (): Promise<void> => {
  const sender = await getSenderEmail();
  if (!sender) return;

  const today = new Date();

  const checkDate = async (days: number, label: string) => {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + days);
    const dateStr = targetDate.toISOString().split('T')[0];

    const visits = executeQuery<{
      id: number;
      email: string;
      nome: string;
      cognome: string;
      scadenza_prossima: string;
    }>(`
      SELECT v.id, w.email, w.nome, w.cognome, v.scadenza_prossima
      FROM visits v
      JOIN workers w ON v.worker_id = w.id
      WHERE v.scadenza_prossima = ? AND w.email IS NOT NULL AND w.email != ''
    `, [dateStr]);

    for (const visit of visits) {
      // Verifica se già inviato
      const alreadySent = executeQuery(`
        SELECT id FROM audit_logs
        WHERE action = 'EMAIL_REMINDER'
        AND resource_id = ?
        AND details LIKE ?
      `, [visit.id, `%${label}%`]);

      if (alreadySent.length > 0) continue;

      const subject = `Promemoria Visita Medica - ${label}`;
      const body = `Gentile ${visit.nome} ${visit.cognome},\n\nTi ricordiamo che la tua prossima visita medica è prevista per il giorno ${visit.scadenza_prossima} (${label}).\n\nCordiali saluti,\nServizio Medicina del Lavoro`;

      const success = await sendEmailViaGmail({
        to: visit.email,
        subject,
        body
      });

      if (success) {
        await runCommand(
          "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
          ["EMAIL_REMINDER", "visits", visit.id, `Reminder ${label} inviato a ${visit.email}`]
        );
      } else {
        await runCommand(
          "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
          ["EMAIL_ERROR", "visits", visit.id, `Errore invio reminder ${label} a ${visit.email}`]
        );
      }
    }
  };

  await checkDate(30, "30gg");
  await checkDate(7, "7gg");
};

/**
 * Invia il PDF del giudizio di idoneità.
 */
export const sendGiudizio = async (visitId: number, recipients: { worker?: boolean; employer?: boolean }): Promise<void> => {
  const sender = await getSenderEmail();
  if (!sender) return;

  // 1. Fetch data for PDF generation
  const visits = executeQuery<Visit>("SELECT * FROM visits WHERE id = ?", [visitId]);
  if (visits.length === 0) return;
  const visit = visits[0];

  const workers = executeQuery<Worker>("SELECT * FROM workers WHERE id = ?", [visit.worker_id]);
  if (workers.length === 0) return;
  const worker = workers[0];

  const companies = executeQuery<Company>("SELECT * FROM companies WHERE id = ?", [worker.company_id]);
  if (companies.length === 0) return;
  const company = companies[0];

  const doctors = executeQuery<DoctorProfile>("SELECT * FROM doctor_profile WHERE id = 1");
  const doctor = doctors[0] || {} as DoctorProfile;

  // For simplicity and since they might not be fully used in "judgment only" mode but are required by PDFParams
  const workHistory: WorkHistory = { esperienze: [], infortuni: 'Nessuno', malattie_professionali: 'No' };
  const familyHistory: FamilyHistory = {
    padre: { deceduto: false, patologie: [] },
    madre: { deceduto: false, patologie: [] },
    fratelli_sorelle: { deceduto: false, patologie: [] },
    nonno_paterno: { deceduto: false, patologie: [] },
    nonna_paterna: { deceduto: false, patologie: [] },
    nonno_materno: { deceduto: false, patologie: [] },
    nonna_materna: { deceduto: false, patologie: [] }
  };
  const physioHistory: PhysiologicalHistory = {
    sviluppo: { gravidanza_parto: 'Regolari', psicomotorio: 'Regolare' },
    puberta: { sviluppo_puberale: 'Regolare', menopausa: false },
    abitudini: { fumo: 'Non fumatore', alcol: 'No', attivita_fisica: 'Sedentario', dieta: 'Onnivora', nessuna_allergia: true },
    sonno: { qualita: 'Buona' }
  };
  const risks: string[] = worker.rischi ? (JSON.parse(worker.rischi) as string[]) : [];

  // 2. Generate PDF (Judgment Mode)
  const doc = generateCompletePDF({
    mode: 'judgment',
    visit,
    worker,
    company,
    doctor,
    workHistory,
    familyHistory,
    physioHistory,
    risks
  });

  const pdfOutput = doc.output('arraybuffer');
  const pdfBytes = new Uint8Array(pdfOutput);

  // 3. Send to recipients
  const emailTargets: string[] = [];
  if (recipients.worker && worker.email) emailTargets.push(worker.email);
  if (recipients.employer && company.email) emailTargets.push(company.email);

  for (const target of emailTargets) {
    const success = await sendEmailViaGmail({
      to: target,
      subject: `Giudizio di Idoneità - ${worker.nome} ${worker.cognome}`,
      body: `Si allega il giudizio di idoneità relativo alla visita del ${visit.data_visita}.`,
      attachment: {
        filename: `Giudizio_${worker.cognome}_${visit.data_visita}.pdf`,
        data: pdfBytes,
        mimeType: 'application/pdf'
      }
    });

    if (success) {
      await runCommand(
        "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
        ["EMAIL_GIUDIZIO", "visits", visitId, `Giudizio inviato a ${target}`]
      );
    } else {
      await runCommand(
        "INSERT INTO audit_logs (action, table_name, resource_id, details) VALUES (?, ?, ?, ?)",
        ["EMAIL_ERROR", "visits", visitId, `Errore invio giudizio a ${target}`]
      );
    }
  }
};
