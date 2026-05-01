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
  codice_fiscale: string;
  email?: string;
  data_nascita?: string;
  luogo_nascita?: string;
  sesso?: 'M' | 'F';
  mansione?: string;
  data_assunzione?: string;
  rischi?: string; // JSON string
  protocol_id?: number;
  is_protocol_customized?: number; // 0 or 1
  custom_protocol?: string; // JSON string
  protocol_override_reason?: string;
}

export interface ProtocolExam {
  nome: string;
  periodicita: number;
  obbligatorio: boolean;
}

export interface Protocol {
  id: number;
  company_id: number;
  mansione: string;
  homogeneous_group?: string;
  risks?: string; // JSON string
  esami?: string; // JSON string [ProtocolExam]
  periodicita_mesi: number;
  is_customizable?: number;
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
  giudizio: string;
  prescrizioni?: string;
  scadenza_prossima?: string;
  medico_id?: number;
  finalized: number;
  accertamenti_effettuati?: string; // JSON string
  eo_cardiaca?: string;
  eo_respiratoria?: string;
  eo_cervicale?: string;
  eo_dorsolombare?: string;
  eo_spalle?: string;
  eo_arti_superiori?: string;
  eo_arti_inferiori?: string;
  eo_altro?: string;
}

export interface Biometrics {
  visit_id: number;
  peso?: number;
  altezza?: number;
  pressione_sistolica?: number;
  pressione_diastolica?: number;
  frequenza_cardiaca?: number;
  bmi?: number;
  spo2?: number;
}

export interface DoctorProfile {
  id: number;
  nome: string;
  specializzazione: string;
  n_iscrizione: string;
  timbro_immagine?: string; // Base64
}

export interface AuditLog {
  id: number;
  timestamp: string;
  action: string;
  table_name: string;
  resource_id?: number;
  details?: string;
}

export interface RiskMaster {
  id: number;
  nome: string;
  categoria: string;
}

export interface ExamMaster {
  id: number;
  nome: string;
  descrizione?: string;
}

export interface TrainingRecord {
  id: number;
  worker_id: number;
  corso: string;
  data_completamento?: string;
  scadenza?: string;
}

export interface PPEAssigned {
  id: number;
  worker_id: number;
  dispositivo: string;
  data_consegna?: string;
  scadenza_sostituzione?: string;
}
