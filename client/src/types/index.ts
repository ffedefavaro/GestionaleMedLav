export interface Company {
  id: number;
  ragione_sociale: string;
  p_iva: string;
  codice_fiscale: string;
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
  codice_fiscale: string;
  email: string;
  data_nascita: string;
  luogo_nascita: string;
  sesso: string;
  mansione: string;
  data_assunzione: string;
  rischi: string; // JSON string
  protocol_id?: number;
  is_protocol_customized: boolean;
  custom_protocol?: string;
  protocol_override_reason?: string;
  azienda?: string;
  company_email?: string;
}

export interface FamilyMemberHistory {
  deceduto: boolean;
  eta_decesso?: number;
  causa?: string;
  patologie: string[]; // Ipertensione, Cardiopatie, Diabete, Neoplasie, Malattie polmonari, Malattie renali, Malattie neurologiche, Malattie psichiatriche, Malattie professionali, Altro
  altro_note?: string;
}

export interface FamilyHistory {
  padre: FamilyMemberHistory;
  madre: FamilyMemberHistory;
  fratelli_sorelle: FamilyMemberHistory;
  nonno_paterno: FamilyMemberHistory;
  nonna_paterna: FamilyMemberHistory;
  nonno_materno: FamilyMemberHistory;
  nonna_materna: FamilyMemberHistory;
}

export interface PhysiologicalHistory {
  sviluppo: {
    gravidanza_parto: 'Regolari' | 'Complicazioni';
    gravidanza_note?: string;
    psicomotorio: 'Regolare' | 'Rallentato';
    psicomotorio_note?: string;
  };
  puberta: {
    sviluppo_puberale: 'Regolare' | 'Anticipato' | 'Ritardato';
    menarca_eta?: number;
    ciclo?: 'Regolare' | 'Irregolare' | 'Amenorrea';
    gravidanze_n?: number;
    parti_n?: number;
    aborti_n?: number;
    menopausa: boolean;
    menopausa_eta?: number;
  };
  abitudini: {
    fumo: 'Non fumatore' | 'Ex fumatore' | 'Fumatore';
    fumo_sigarette_die?: number;
    fumo_anni?: number;
    fumo_anno_cessazione?: number;
    alcol: 'No' | 'Occasionale' | 'Quotidiano';
    alcol_unita_die?: number;
    attivita_fisica: 'Sedentario' | 'Leggera' | 'Moderata' | 'Intensa';
    dieta: 'Onnivora' | 'Vegetariana' | 'Vegana' | 'Altro';
    dieta_altro?: string;
    farmaci_abituali?: string;
    nessuna_allergia: boolean;
    allergie_note?: string;
  };
  sonno: {
    qualita: 'Buona' | 'Disturbi occasionali' | 'Insonnia';
  };
}

export interface WorkExperience {
  azienda: string;
  ateco: string;
  mansione: string;
  dal: string; // anno
  al: string; // anno o "attuale"
  esposizioni: string[]; // Rumore, Vibrazioni, VDT, Agenti chimici, Polveri, MMC, Posture incongrue, Biologico, Radiazioni, Turni/notturno, Stress, Altro
  note?: string;
}

export interface WorkHistory {
  esperienze: WorkExperience[];
  infortuni: 'Nessuno' | 'Sì';
  infortuni_n?: number;
  infortuni_ultimo_anno?: number;
  infortuni_tipo?: string;
  malattie_professionali: 'No' | 'Sì';
  malattie_professionali_quale?: string;
  malattie_professionali_anno?: number;
}

export interface Visit {
  id: number;
  worker_id: number;
  data_visita: string;
  tipo_visita: string;
  anamnesi_lavorativa: string; // Ora conterrà JSON di WorkHistory
  anamnesi_familiare: string; // Ora conterrà JSON di FamilyHistory
  anamnesi_patologica: string;
  anamnesi_fisiologica?: string; // Nuova colonna per JSON di PhysiologicalHistory

  // Dati Antropometrici
  condizioni_generali: 'Buone' | 'Discrete' | 'Scadenti';
  altezza: number;
  peso: number;
  bmi: number;
  spo2?: number;

  // Esame Obiettivo - Structured Fields
  // Cardiovascolare
  p_sistolica: number;
  p_diastolica: number;
  frequenza: number;
  eo_toni_puri: boolean;
  eo_toni_ritmici: boolean;
  eo_varici: boolean;

  // Digerente
  eo_addome_piano: boolean;
  eo_trattabile: boolean;
  eo_dolente: boolean;
  eo_fegato_regolare: boolean;
  eo_milza_regolare: boolean;

  // Urogenitale
  eo_giordano_dx: 'Negativa' | 'Positiva';
  eo_giordano_sx: 'Negativa' | 'Positiva';

  // Respiratorio
  eo_pless_norma: boolean;
  eo_ispettivi_norma: boolean;

  // Sistema Nervoso
  eo_tinel: 'Non eseguita' | 'Negativa' | 'Positiva';
  eo_phalen: 'Non eseguita' | 'Negativa' | 'Positiva';

  // Osteoarticolare
  eo_lasegue_dx: 'Negativa' | 'Positiva';
  eo_lasegue_sx: 'Negativa' | 'Positiva';
  eo_palpazione_paravertebrali: 'Nessun dolore' | 'Dolorabile' | 'Dolente';
  eo_digitopressione_apofisi: 'Nessun dolore' | 'Dolorabile' | 'Dolente';
  eo_rachide_rotazione: 'Nella norma' | 'Lievemente ridotta' | 'Ridotta';
  eo_rachide_inclinazione: 'Nella norma' | 'Lievemente ridotta' | 'Ridotta';
  eo_rachide_flessoestensione: 'Nella norma' | 'Lievemente ridotta' | 'Ridotta';

  // Visus e Udito
  eo_visus_nat_os: number;
  eo_visus_nat_od: number;
  eo_visus_corr_os: number;
  eo_visus_corr_od: number;
  eo_udito_ridotto: boolean;

  // Note e Altro
  accertamenti_effettuati: string;
  eo_note: string;

  // Footer / Giudizio
  giudizio: string;
  prescrizioni: string;
  scadenza_prossima: string;

  // New Footer fields
  visita_completata: boolean;
  allegati_count: number;
  trasmissione_lavoratore_data?: string;
  trasmissione_lavoratore_metodo?: string;
  trasmissione_datore_data?: string;
  trasmissione_datore_metodo?: string;

  finalized: boolean;
}

export interface Biometrics {
  visit_id: number;
  peso: number;
  altezza: number;
  bmi: number;
  pressione_sistolica: number;
  pressione_diastolica: number;
  frequenza_cardiaca: number;
  spo2: number;
}

export interface DoctorProfile {
  id: number;
  nome: string;
  specializzazione: string;
  n_iscrizione: string;
  timbro_immagine?: string;
}

export interface EmailLog {
  id: number;
  destinatario: string;
  oggetto: string;
  data_ora: string;
  visit_id?: number;
  esito: 'successo' | 'errore' | 'non inviato - email non configurata';
  errore_dettaglio?: string;
}

export interface EmailTemplate {
  tipo: 'reminder' | 'giudizio';
  soggetto: string;
  corpo: string;
}

export interface EmailConfig {
  sender_email: string | null;
  sender_name: string;
  automatic_reminders: boolean;
  reminder_template_id?: number;
  judgment_template_id?: number;
}
