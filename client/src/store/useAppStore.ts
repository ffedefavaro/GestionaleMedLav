import { create } from 'zustand';
import { executeQuery, runCommand } from '../lib/db';
import type { Company, Worker, Protocol, Visit, TrainingRecord, PPEAssigned, RiskMaster, ExamMaster, DoctorProfile, AuditLog } from '../types';

interface AppState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  currentTitle: string;
  setTitle: (title: string) => void;

  // Data State
  companies: Company[];
  workers: Worker[];
  protocols: Protocol[];
  visits: (Visit & { nome: string, cognome: string, codice_fiscale: string, azienda: string, mansione: string })[];
  trainingRecords: (TrainingRecord & { nome: string, cognome: string })[];
  ppeRecords: (PPEAssigned & { nome: string, cognome: string })[];
  risksMaster: RiskMaster[];
  examsMaster: ExamMaster[];

  // Settings/Profile
  doctorProfile: DoctorProfile | null;
  auditLogs: AuditLog[];

  // Specific Worker History
  selectedWorker: Worker | null;
  workerVisits: Visit[];

  // Exposed Workers
  exposedWorkers: (Pick<Worker, 'cognome' | 'nome' | 'codice_fiscale' | 'mansione' | 'rischi'> & { azienda: string })[];

  // Loading & Error States
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCompanies: () => void;
  fetchWorkers: () => void;
  fetchProtocols: () => void;
  fetchVisits: () => void;
  fetchTraining: () => void;
  fetchPPE: () => void;
  fetchMasters: () => void;
  fetchSettings: () => void;
  fetchWorkerHistory: (workerId: number) => void;
  fetchExposedWorkers: () => void;
  fetchAllData: () => void;

  saveDoctorProfile: (profile: Omit<DoctorProfile, 'id'>) => Promise<void>;

  clearError: () => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  currentTitle: 'Dashboard',
  setTitle: (title) => set({ currentTitle: title }),

  companies: [],
  workers: [],
  protocols: [],
  visits: [],
  trainingRecords: [],
  ppeRecords: [],
  risksMaster: [],
  examsMaster: [],
  doctorProfile: null,
  auditLogs: [],
  selectedWorker: null,
  workerVisits: [],
  exposedWorkers: [],

  isLoading: false,
  error: null,

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  fetchCompanies: () => {
    try {
      const data = executeQuery<Company>("SELECT * FROM companies ORDER BY ragione_sociale ASC");
      set({ companies: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore durante il caricamento delle aziende" });
    }
  },

  fetchWorkers: () => {
    try {
      const data = executeQuery<Worker>("SELECT * FROM workers ORDER BY cognome ASC, nome ASC");
      set({ workers: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore durante il caricamento dei lavoratori" });
    }
  },

  fetchProtocols: () => {
    try {
      const data = executeQuery<Protocol>("SELECT * FROM protocols ORDER BY mansione ASC");
      set({ protocols: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore durante il caricamento dei protocolli" });
    }
  },

  fetchVisits: () => {
    try {
      const data = executeQuery<Visit & { nome: string, cognome: string, codice_fiscale: string, azienda: string, mansione: string }>(`
        SELECT visits.*, workers.nome, workers.cognome, workers.codice_fiscale, companies.ragione_sociale as azienda, workers.mansione
        FROM visits
        JOIN workers ON visits.worker_id = workers.id
        JOIN companies ON workers.company_id = companies.id
        ORDER BY visits.scadenza_prossima ASC
      `);
      set({ visits: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore durante il caricamento delle visite" });
    }
  },

  fetchTraining: () => {
    try {
      const data = executeQuery<TrainingRecord & { nome: string, cognome: string }>(`
        SELECT training_records.*, workers.nome, workers.cognome
        FROM training_records
        JOIN workers ON training_records.worker_id = workers.id
        ORDER BY training_records.scadenza ASC
      `);
      set({ trainingRecords: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore durante il caricamento della formazione" });
    }
  },

  fetchPPE: () => {
    try {
      const data = executeQuery<PPEAssigned & { nome: string, cognome: string }>(`
        SELECT ppe_assigned.*, workers.nome, workers.cognome
        FROM ppe_assigned
        JOIN workers ON ppe_assigned.worker_id = workers.id
        ORDER BY ppe_assigned.scadenza_sostituzione ASC
      `);
      set({ ppeRecords: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore durante il caricamento dei DPI" });
    }
  },

  fetchMasters: () => {
    try {
      const risks = executeQuery<RiskMaster>("SELECT * FROM risks_master ORDER BY categoria, nome");
      const exams = executeQuery<ExamMaster>("SELECT * FROM exams_master ORDER BY nome");
      set({ risksMaster: risks, examsMaster: exams });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore durante il caricamento dei master dati" });
    }
  },

  fetchSettings: () => {
    try {
      const doctor = executeQuery<DoctorProfile>("SELECT * FROM doctor_profile WHERE id = 1");
      const logs = executeQuery<AuditLog>("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50");
      set({ doctorProfile: doctor[0] || null, auditLogs: logs });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore caricamento impostazioni" });
    }
  },

  saveDoctorProfile: async (profile) => {
    try {
      const exists = executeQuery("SELECT id FROM doctor_profile WHERE id = 1");
      if (exists.length > 0) {
        await runCommand(
          "UPDATE doctor_profile SET nome = ?, specializzazione = ?, n_iscrizione = ?, timbro_immagine = ? WHERE id = 1",
          [profile.nome, profile.specializzazione, profile.n_iscrizione, profile.timbro_immagine || null]
        );
      } else {
        await runCommand(
          "INSERT INTO doctor_profile (id, nome, specializzazione, n_iscrizione, timbro_immagine) VALUES (1, ?, ?, ?, ?)",
          [profile.nome, profile.specializzazione, profile.n_iscrizione, profile.timbro_immagine || null]
        );
      }
      get().fetchSettings();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore salvataggio profilo" });
    }
  },

  fetchWorkerHistory: (workerId) => {
    try {
      const w = executeQuery<Worker>("SELECT * FROM workers WHERE id = ?", [workerId])[0];
      const v = executeQuery<Visit & { nome: string, cognome: string, codice_fiscale: string, azienda: string, mansione: string }>(`
        SELECT visits.*, workers.nome, workers.cognome, workers.codice_fiscale, companies.ragione_sociale as azienda, workers.mansione
        FROM visits
        JOIN workers ON visits.worker_id = workers.id
        JOIN companies ON workers.company_id = companies.id
        WHERE visits.worker_id = ?
        ORDER BY visits.data_visita DESC
      `, [workerId]);
      set({ selectedWorker: w || null, workerVisits: v as any });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore caricamento storico lavoratore" });
    }
  },

  fetchExposedWorkers: () => {
    try {
      const data = executeQuery<Pick<Worker, 'cognome' | 'nome' | 'codice_fiscale' | 'mansione' | 'rischi'> & { azienda: string }>(`
        SELECT workers.cognome, workers.nome, workers.codice_fiscale, workers.mansione, workers.rischi, companies.ragione_sociale as azienda
        FROM workers
        JOIN companies ON workers.company_id = companies.id
        WHERE workers.rischi IS NOT NULL AND workers.rischi != '[]'
        ORDER BY azienda ASC, cognome ASC
      `);
      set({ exposedWorkers: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore caricamento registro esposti" });
    }
  },

  fetchAllData: () => {
    set({ isLoading: true });
    try {
      const companies = executeQuery<Company>("SELECT * FROM companies ORDER BY ragione_sociale ASC");
      const workers = executeQuery<Worker>("SELECT * FROM workers ORDER BY cognome ASC, nome ASC");
      const protocols = executeQuery<Protocol>("SELECT * FROM protocols ORDER BY mansione ASC");
      const risks = executeQuery<RiskMaster>("SELECT * FROM risks_master ORDER BY categoria, nome");
      const exams = executeQuery<ExamMaster>("SELECT * FROM exams_master ORDER BY nome");

      set({
        companies,
        workers,
        protocols,
        risksMaster: risks,
        examsMaster: exams,
        isLoading: false
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Errore durante il caricamento globale", isLoading: false });
    }
  }
}));
