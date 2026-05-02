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
}

export interface Visit {
  id: number;
  worker_id: number;
  data_visita: string;
  tipo_visita: string;
  anamnesi_lavorativa: string;
  anamnesi_familiare: string;
  anamnesi_patologica: string;

  // Dati Antropometrici
  condizioni_generali: 'Buone' | 'Discrete' | 'Scadenti';
  altezza: number;
  peso: number;
  bmi: number;

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
