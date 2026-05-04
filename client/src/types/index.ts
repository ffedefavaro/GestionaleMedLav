export interface Company {
  id: number;
  ragione_sociale: string;
  p_iva?: string;
  codice_fiscale?: string;
  ateco?: string;
  sede_legale?: string;
  sede_operativa?: string;
  referente?: string;
  rspp?: string;
  rls?: string;
  email?: string;
}

export interface Worker {
  id: number;
  company_id: number;
  nome: string;
  cognome: string;
  codice_fiscale?: string;
  email?: string;
  data_nascita?: string;
  luogo_nascita?: string;
  sesso?: string;
  mansione?: string;
  data_assunzione?: string;
  rischi?: string; // JSON string
  protocol_id?: number;
  is_protocol_customized?: number;
  custom_protocol?: string;
  protocol_override_reason?: string;
  azienda?: string; // Joined field
  protocol_name?: string; // Joined field
}

export interface Protocol {
  id: number;
  company_id: number;
  mansione: string;
  homogeneous_group?: string;
  risks?: string; // JSON string
  esami: string; // JSON string
  periodicita_mesi: number;
  is_customizable: number;
}

export interface Visit {
  id: number;
  worker_id: number;
  data_visita: string;
  tipo_visita: string;
  anamnesi_lavorativa?: string;
  anamnesi_familiare?: string;
  anamnesi_patologica?: string; // Legacy
  anamnesi_patologica_remota?: string;
  anamnesi_patologica_prossima?: string;
  anamnesi_fisiologica?: string;
  allergie?: string;
  vaccinazioni?: string;
  esame_obiettivo?: string; // Legacy
  giudizio?: string;
  prescrizioni?: string;
  scadenza_prossima?: string;
  medico_id?: number;
  finalized: number;
  accertamenti_effettuati?: string;
  eo_cardiaca?: string;
  eo_respiratoria?: string;
  eo_cervicale?: string;
  eo_dorsolombare?: string;
  eo_spalle?: string;
  eo_arti_superiori?: string;
  eo_arti_inferiori?: string;
  eo_altro?: string;
  incidenti_invalidita?: string;
  conclusioni?: string;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  action: string;
  table_name: string;
  resource_id?: number;
  details: string;
}

export interface DoctorProfile {
  id: number;
  nome: string;
  specializzazione: string;
  n_iscrizione: string;
  timbro_immagine: string;
}

export interface EmailConfig {
  sender_email: string;
}

export interface EmailLog {
  visit_id: number;
  recipient: string;
  type: 'reminder_30d' | 'reminder_7d' | 'giudizio';
  sent_at: string;
  status: 'success' | 'error';
  details?: string;
}

export interface EmailAnalysis {
  tipoEsame: string[];
  diagnosi: string;
  valoriAnomali: string[];
  notePerMedico: string;
  dataEsame?: string;
}
