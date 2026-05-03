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
  anamnesi_patologica?: string;
  esame_obiettivo?: string;
  giudizio?: string;
  prescrizioni?: string;
  scadenza_prossima?: string;
  medico_id?: number;
  finalized: number;
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
