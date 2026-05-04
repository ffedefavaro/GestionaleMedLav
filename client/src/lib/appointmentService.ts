import { executeQuery, runCommand } from './db';
import type { Appointment, AppointmentStatus } from '../types';

/**
 * Crea un nuovo appuntamento programmato.
 */
export const createAppointment = async (data: Omit<Appointment, 'id' | 'timestamp_modifica'>): Promise<void> => {
  const sql = `
    INSERT INTO planned_appointments (worker_id, company_id, data_proposta, stato, note, data_originale)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  await runCommand(sql, [
    data.worker_id,
    data.company_id,
    data.data_proposta,
    data.stato,
    data.note ?? null,
    data.data_originale ?? null
  ]);
};

/**
 * Aggiorna lo stato di un appuntamento esistente.
 */
export const updateAppointmentStatus = async (id: number, stato: AppointmentStatus): Promise<void> => {
  const sql = `
    UPDATE planned_appointments
    SET stato = ?, timestamp_modifica = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  await runCommand(sql, [stato, id]);
};

/**
 * Riprogramma un appuntamento con una nuova data.
 * Imposta lo stato a 'rescheduled' e conserva la data originale se non già presente.
 */
export const rescheduleAppointment = async (id: number, nuova_data: string, nota?: string): Promise<void> => {
  // Recupera l'appuntamento corrente per gestire la data originale
  const appointments = executeQuery<Appointment>("SELECT * FROM planned_appointments WHERE id = ?", [id]);
  if (appointments.length === 0) {
    throw new Error("Appuntamento non trovato");
  }

  const current = appointments[0];
  // Se data_originale è già presente (già riprogrammato in passato), la manteniamo.
  // Altrimenti, usiamo la data_proposta corrente come data originale.
  const dataOriginale = current.data_originale || current.data_proposta;

  const sql = `
    UPDATE planned_appointments
    SET data_proposta = ?,
        stato = 'rescheduled',
        data_originale = ?,
        note = ?,
        timestamp_modifica = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  await runCommand(sql, [nuova_data, dataOriginale, nota ?? current.note ?? null, id]);
};

/**
 * Recupera tutti gli appuntamenti per un determinato lavoratore.
 */
export const getAppointmentsByWorker = (workerId: number): Appointment[] => {
  return executeQuery<Appointment>(
    "SELECT * FROM planned_appointments WHERE worker_id = ? ORDER BY data_proposta DESC",
    [workerId]
  );
};
