import { executeQuery, runCommand } from './db';
import type { Appointment, AppointmentStatus } from '../types';
import { fetchGmailMessages } from './gmail';

export const appointmentService = {
  async getAll(): Promise<Appointment[]> {
    return executeQuery(`
      SELECT pa.*, w.nome as worker_nome, w.cognome as worker_cognome, c.ragione_sociale as azienda_ragione_sociale
      FROM planned_appointments pa
      JOIN workers w ON pa.worker_id = w.id
      JOIN companies c ON pa.company_id = c.id
      ORDER BY pa.data_proposta ASC
    `) as Appointment[];
  },

  async create(appointment: Omit<Appointment, 'id'>): Promise<number> {
    await runCommand(
      `INSERT INTO planned_appointments (worker_id, company_id, data_proposta, sede, stato, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [appointment.worker_id, appointment.company_id, appointment.data_proposta, appointment.sede, appointment.stato, appointment.notes]
    );
    const result = executeQuery("SELECT last_insert_rowid() as id")[0];
    return result.id;
  },

  async updateStatus(id: number, stato: AppointmentStatus, notes?: string): Promise<void> {
    await runCommand(
      "UPDATE planned_appointments SET stato = ?, notes = COALESCE(?, notes) WHERE id = ?",
      [stato, notes || null, id]
    );
  },

  async reschedule(id: number, nuovaData: string, motivo?: string): Promise<void> {
    const current = executeQuery("SELECT data_proposta FROM planned_appointments WHERE id = ?", [id])[0];
    if (!current) throw new Error("Appuntamento non trovato");

    await runCommand(
      "UPDATE planned_appointments SET data_proposta = ?, stato = 'rescheduled' WHERE id = ?",
      [nuovaData, id]
    );

    await runCommand(
      "INSERT INTO appointment_logs (appointment_id, data_precedente, data_nuova, motivo) VALUES (?, ?, ?, ?)",
      [id, current.data_proposta, nuovaData, motivo || 'Modifica manuale']
    );
  },

  async cancel(id: number): Promise<void> {
    await runCommand("DELETE FROM planned_appointments WHERE id = ?", [id]);
    await runCommand("DELETE FROM appointment_logs WHERE appointment_id = ?", [id]);
  },

  async syncFromGmail(accessToken: string): Promise<{ appointmentId: number, workerName: string, body: string }[]> {
    const appointments = await this.getAll();
    const notifications: { appointmentId: number, workerName: string, body: string }[] = [];

    for (const app of appointments) {
      if (app.stato !== 'pending') continue;

      const worker = executeQuery("SELECT email, nome, cognome FROM workers WHERE id = ?", [app.worker_id])[0];
      if (!worker || !worker.email) continue;

      const messages = await fetchGmailMessages(accessToken, worker.email);
      // Look for replies with subject containing "RE: Proposta visita"
      // Note: fetchGmailMessages query is just "from:email", we filter here
      const replies = messages.filter(m => m.snippet.toLowerCase().includes('re: proposta visita') || m.body.toLowerCase().includes('re: proposta visita'));

      if (replies.length > 0) {
        notifications.push({
          appointmentId: app.id,
          workerName: `${worker.cognome} ${worker.nome}`,
          body: replies[0].body
        });
      }
    }

    return notifications;
  }
};
