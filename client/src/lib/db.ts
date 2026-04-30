import initSqlJs, { type Database } from 'sql.js';
import { get, del } from 'idb-keyval';
import { loadEncryptedDB, saveEncryptedDB } from './auth';

let db: Database | null = null;

export const initDB = async () => {
  if (db) return db;

  try {
    console.log("Inizializzazione SQL.js...");
    const SQL = await initSqlJs({
      locateFile: file => {
        if (file.endsWith('.wasm')) {
          const wasmPath = import.meta.env.PROD ? `./sql-wasm.wasm` : `/sql-wasm.wasm`;
          console.log(`Caricamento WASM da: ${wasmPath}`);
          return wasmPath;
        }
        return `/${file}`;
      }
    });

    console.log("Recupero dati cifrati da IndexedDB...");
    let savedData = await loadEncryptedDB();

    // Legacy recovery: check if unencrypted data exists from previous version
    if (!savedData) {
      console.log("Nessun dato cifrato. Ricerca dati legacy...");
      const legacyData = await get('cartsan_db_v2');
      if (legacyData) {
        console.log("DATI LEGACY TROVATI. Migrazione in corso...");
        savedData = legacyData;
        await saveEncryptedDB(new Uint8Array(legacyData));
        await del('cartsan_db_v2');
      }
    }

    if (savedData) {
      console.log("Database caricato.");
      try {
        db = new SQL.Database(savedData);
      } catch (e) {
        console.error("Errore nel caricamento. Creazione nuovo...", e);
        db = new SQL.Database();
        createTables(db);
      }
    } else {
      console.log("Nessun database trovato. Creazione nuovo...");
      db = new SQL.Database();
      createTables(db);
    }

    if (db) {
      console.log("Configurazione tabelle e migrazioni...");
      createTables(db);
      runMigrations(db);
      console.log("Salvataggio database...");
      await saveDB();
      console.log("Inizializzazione completata.");
    } else {
      throw new Error("Impossibile creare l'istanza del database.");
    }

    return db;
  } catch (error) {
    console.error("ERRORE CRITICO INIT DB:", error);
    throw error;
  }
};

const createTables = (database: Database) => {
  database.run(`
    CREATE TABLE IF NOT EXISTS db_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ragione_sociale TEXT NOT NULL,
      p_iva TEXT,
      codice_fiscale TEXT,
      ateco TEXT,
      sede_legale TEXT,
      sede_operativa TEXT,
      referente TEXT,
      rspp TEXT,
      rls TEXT
    );

    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      nome TEXT NOT NULL,
      cognome TEXT NOT NULL,
      codice_fiscale TEXT UNIQUE,
      email TEXT,
      data_nascita DATE,
      luogo_nascita TEXT,
      sesso TEXT,
      mansione TEXT,
      data_assunzione DATE,
      rischi TEXT, -- JSON string
      protocol_id INTEGER,
      is_protocol_customized INTEGER DEFAULT 0,
      custom_protocol TEXT,
      protocol_override_reason TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS protocols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      mansione TEXT,
      homogeneous_group TEXT,
      risks TEXT, -- JSON string
      esami TEXT, -- JSON string [{nome, periodicita, obbligatorio}]
      periodicita_mesi INTEGER,
      is_customizable INTEGER DEFAULT 1,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS worker_protocol_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER,
      change_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      old_protocol TEXT,
      new_protocol TEXT,
      reason TEXT,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS exams_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE,
      descrizione TEXT
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER,
      data_visita DATE,
      tipo_visita TEXT, -- preventiva, periodica, etc.
      anamnesi_lavorativa TEXT,
      anamnesi_familiare TEXT,
      anamnesi_patologica TEXT,
      esame_obiettivo TEXT,
      giudizio TEXT,
      prescrizioni TEXT,
      scadenza_prossima DATE,
      medico_id INTEGER,
      finalized INTEGER DEFAULT 0,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS biometrics (
      visit_id INTEGER PRIMARY KEY,
      peso REAL,
      altezza INTEGER,
      pressione_sistolica INTEGER,
      pressione_diastolica INTEGER,
      frequenza_cardiaca INTEGER,
      bmi REAL,
      FOREIGN KEY (visit_id) REFERENCES visits(id)
    );

    CREATE TABLE IF NOT EXISTS doctor_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nome TEXT,
      specializzazione TEXT,
      n_iscrizione TEXT,
      timbro_immagine TEXT -- Base64
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      action TEXT,
      table_name TEXT,
      resource_id INTEGER,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS risks_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE,
      categoria TEXT -- fisico, chimico, biologico, etc.
    );

    CREATE TABLE IF NOT EXISTS training_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER,
      corso TEXT NOT NULL,
      data_completamento DATE,
      scadenza DATE,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS ppe_assigned (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER,
      dispositivo TEXT NOT NULL,
      data_consegna DATE,
      scadenza_sostituzione DATE,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );
  `);

  // Initialize masters
  const risksCount = database.exec("SELECT count(*) FROM risks_master")[0].values[0][0];
  if (risksCount === 0) {
    const standardRisks = [
      ['Rumore', 'fisico'], ['Vibrazioni', 'fisico'], ['Radiazioni', 'fisico'],
      ['Movimentazione Carichi', 'ergonomico'], ['Video-terminalisti', 'ergonomico'],
      ['Agenti Chimici', 'chimico'], ['Agenti Biologici', 'biologico'],
      ['Lavoro Notturno', 'organizzativo'], ['Stress Lavoro Correlato', 'psicosociale'],
      ['Movimentazione manuale dei pazienti', 'ergonomico'],
      ['Rischio biologico (contatto con pazienti)', 'biologico'],
      ['Rischio da punture accidentali', 'biologico'],
      ['Stress lavoro-correlato in ambito sanitario', 'psicosociale'],
      ['Posture incongrue prolungate', 'ergonomico'],
      ['Lavoro su turni/notturno in ambito sanitario', 'organizzativo']
    ];
    standardRisks.forEach(r => {
      database.run("INSERT INTO risks_master (nome, categoria) VALUES (?, ?)", r);
    });
  }

  const examsCount = database.exec("SELECT count(*) FROM exams_master")[0].values[0][0];
  if (examsCount === 0) {
    const standardExams = [
      ['Visita Medica', 'Valutazione clinica generale'],
      ['Audiometria', 'Screening uditivo'],
      ['Spirometria', 'Funzionalità respiratoria'],
      ['Elettrocardiogramma (ECG)', 'Attività elettrica del cuore'],
      ['Visita Oculistica / Ergoftalmologia', 'Screening visivo VDT'],
      ['Esami Ematochimici', 'Analisi del sangue standard'],
      ['Drug Test', 'Screening sostanze stupefacenti'],
      ['Alcool Test', 'Screening abuso alcolico']
    ];
    standardExams.forEach(e => {
      database.run("INSERT INTO exams_master (nome, descrizione) VALUES (?, ?)", e);
    });
  }
};

const runMigrations = (database: Database) => {
  const migrations = [
    { id: 1, sql: "ALTER TABLE workers ADD COLUMN email TEXT;" },
    { id: 2, sql: "ALTER TABLE visits ADD COLUMN finalized INTEGER DEFAULT 0;" },
    { id: 3, sql: "ALTER TABLE protocols ADD COLUMN homogeneous_group TEXT;" },
    { id: 4, sql: "ALTER TABLE protocols ADD COLUMN risks TEXT;" },
    { id: 5, sql: "ALTER TABLE protocols ADD COLUMN is_customizable INTEGER DEFAULT 1;" },
    { id: 6, sql: "ALTER TABLE workers ADD COLUMN protocol_id INTEGER;" },
    { id: 7, sql: "ALTER TABLE workers ADD COLUMN is_protocol_customized INTEGER DEFAULT 0;" },
    { id: 8, sql: "ALTER TABLE workers ADD COLUMN custom_protocol TEXT;" },
    { id: 9, sql: "ALTER TABLE workers ADD COLUMN protocol_override_reason TEXT;" },
    { id: 10, sql: "ALTER TABLE visits ADD COLUMN accertamenti_effettuati TEXT;" },
    { id: 11, sql: "CREATE TABLE IF NOT EXISTS training_records (id INTEGER PRIMARY KEY AUTOINCREMENT, worker_id INTEGER, corso TEXT NOT NULL, data_completamento DATE, scadenza DATE, FOREIGN KEY (worker_id) REFERENCES workers(id));" },
    { id: 12, sql: "CREATE TABLE IF NOT EXISTS ppe_assigned (id INTEGER PRIMARY KEY AUTOINCREMENT, worker_id INTEGER, dispositivo TEXT NOT NULL, data_consegna DATE, scadenza_sostituzione DATE, FOREIGN KEY (worker_id) REFERENCES workers(id));" },
    { id: 13, sql: "ALTER TABLE biometrics ADD COLUMN spo2 INTEGER;" },
    { id: 14, sql: "ALTER TABLE visits ADD COLUMN eo_cardiaca TEXT;" },
    { id: 15, sql: "ALTER TABLE visits ADD COLUMN eo_respiratoria TEXT;" },
    { id: 16, sql: "ALTER TABLE visits ADD COLUMN eo_cervicale TEXT;" },
    { id: 17, sql: "ALTER TABLE visits ADD COLUMN eo_dorsolombare TEXT;" },
    { id: 18, sql: "ALTER TABLE visits ADD COLUMN eo_spalle TEXT;" },
    { id: 19, sql: "ALTER TABLE visits ADD COLUMN eo_arti_superiori TEXT;" },
    { id: 20, sql: "ALTER TABLE visits ADD COLUMN eo_arti_inferiori TEXT;" },
    { id: 21, sql: "ALTER TABLE visits ADD COLUMN eo_altro TEXT;" },
    { id: 22, sql: "ALTER TABLE visits ADD COLUMN structured_anamnesis TEXT;" },
    { id: 23, sql: "ALTER TABLE workers ADD COLUMN permanent_anamnesis TEXT;" },
    { id: 24, sql: "ALTER TABLE visits ADD COLUMN periodicita TEXT;" },
    { id: 25, sql: "ALTER TABLE visits ADD COLUMN sorveglianza_dati TEXT;" },
    { id: 26, sql: "ALTER TABLE visits ADD COLUMN anamnesi_fisiologica TEXT;" },
    { id: 27, sql: "ALTER TABLE visits ADD COLUMN eventi_sanitari TEXT;" },
    { id: 28, sql: "ALTER TABLE visits ADD COLUMN esame_obiettivo_strutturato TEXT;" },
    { id: 29, sql: "ALTER TABLE visits ADD COLUMN valutazione_accertamenti TEXT;" },
    { id: 30, sql: "ALTER TABLE visits ADD COLUMN trasmissione_dati TEXT;" },
    { id: 31, sql: "ALTER TABLE visits ADD COLUMN allegato_a TEXT;" },
    { id: 32, sql: "ALTER TABLE visits ADD COLUMN allegato_b TEXT;" },
    { id: 33, sql: "ALTER TABLE workers ADD COLUMN nazionalita TEXT;" },
    { id: 34, sql: "ALTER TABLE workers ADD COLUMN gruppo_sanguigno TEXT;" },
    { id: 35, sql: "ALTER TABLE workers ADD COLUMN reparto TEXT;" },
    { id: 36, sql: "ALTER TABLE workers ADD COLUMN qualifica TEXT;" },
    { id: 37, sql: "ALTER TABLE workers ADD COLUMN data_inizio_mansione DATE;" },
    { id: 38, sql: "CREATE TABLE IF NOT EXISTS visit_drafts (worker_id INTEGER PRIMARY KEY, data TEXT, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP);" },
    { id: 39, sql: "ALTER TABLE workers ADD COLUMN domicilio TEXT;" },
    { id: 40, sql: "ALTER TABLE workers ADD COLUMN telefono TEXT;" }
  ];

  let currentVersion = 0;
  try {
    const result = database.exec("SELECT value FROM db_meta WHERE key = 'schema_version'");
    if (result.length > 0) {
      currentVersion = parseInt(result[0].values[0][0] as string);
    }
  } catch (e) {
    // meta table might not exist yet
  }

  migrations.forEach(m => {
    if (m.id > currentVersion) {
      try {
        console.log(`Esecuzione migrazione #${m.id}...`);
        database.run(m.sql);
        database.run("INSERT OR REPLACE INTO db_meta (key, value) VALUES ('schema_version', ?)", [m.id.toString()]);
      } catch (e) {
        console.warn(`Errore migrazione #${m.id} (potrebbe già esistere):`, e);
      }
    }
  });
};

export const saveDB = async () => {
  if (!db) return;
  const data = db.export();
  await saveEncryptedDB(data);

  // Emergency Mirroring: Save critical worker data to localStorage as JSON
  // Limited to 5MB, but should fit thousands of basic worker records
  try {
    const criticalData = db.exec("SELECT id, nome, cognome, codice_fiscale, mansione FROM workers");
    if (criticalData.length > 0) {
      localStorage.setItem('emergency_worker_mirror', JSON.stringify(criticalData[0].values));
    }
  } catch (e) {
    console.warn("Emergency mirroring failed (likely storage limit):", e);
  }
};

export const getDB = () => db;

export const executeQuery = (sql: string, params?: any[]) => {
  if (!db) throw new Error("Database non inizializzato");
  const result = db.exec(sql, params);
  if (result.length === 0) return [];

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
};

export const runCommand = async (sql: string, params?: any[]) => {
  if (!db) throw new Error("Database non inizializzato");
  db.run(sql, params);
  await saveDB();
};
