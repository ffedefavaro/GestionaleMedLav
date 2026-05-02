export type AppointmentStatus = 'pending' | 'confirmed' | 'rescheduled' | 'cancelled';

export interface Appointment {
  id: number;
  worker_id: number;
  company_id: number;
  data_proposta: string;
  sede: string;
  stato: AppointmentStatus;
  notes?: string;
  worker_nome?: string;
  worker_cognome?: string;
  azienda_ragione_sociale?: string;
}

export interface AppointmentLog {
  id: number;
  appointment_id: number;
  data_precedente: string;
  data_nuova: string;
  motivo?: string;
  timestamp: string;
}

export interface Worker {
  id: number;
  company_id: number;
  nome: string;
  cognome: string;
  codice_fiscale: string;
  email?: string;
  mansione?: string;
}

export interface Company {
  id: number;
  ragione_sociale: string;
  sede_operativa?: string;
}
