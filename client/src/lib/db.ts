import initSqlJs, { type Database } from 'sql.js';
import { get, set } from 'idb-keyval';

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

    console.log("Recupero dati da IndexedDB...");
    let savedData;
    try {
      savedData = await get('cartsan_db_v2');
    } catch (e) {
      console.error("Errore nel recupero da IndexedDB:", e);
    }

    if (savedData) {
      console.log("Database esistente trovato.");
      try {
        db = new SQL.Database(savedData);
      } catch (e) {
        console.error("Errore nel caricamento del database salvato. Creazione nuovo database...", e);
        db = new SQL.Database();
        createTables(db);
      }
    } else {
      console.log("Nessun database trovato. Creazione nuovo...");
      db = new SQL.Database();
      createTables(db);
    }

    if (db) {
      console.log("Esecuzione migrazioni...");
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
      ['Lavoro Notturno', 'organizzativo'], ['Stress Lavoro Correlato', 'psicosociale']
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
    "ALTER TABLE workers ADD COLUMN email TEXT;",
    "ALTER TABLE visits ADD COLUMN finalized INTEGER DEFAULT 0;",
    "ALTER TABLE protocols ADD COLUMN homogeneous_group TEXT;",
    "ALTER TABLE protocols ADD COLUMN risks TEXT;",
    "ALTER TABLE protocols ADD COLUMN is_customizable INTEGER DEFAULT 1;",
    "ALTER TABLE workers ADD COLUMN protocol_id INTEGER;",
    "ALTER TABLE workers ADD COLUMN is_protocol_customized INTEGER DEFAULT 0;",
    "ALTER TABLE workers ADD COLUMN custom_protocol TEXT;",
    "ALTER TABLE workers ADD COLUMN protocol_override_reason TEXT;",
    "ALTER TABLE visits ADD COLUMN accertamenti_effettuati TEXT;",
    "CREATE TABLE IF NOT EXISTS training_records (id INTEGER PRIMARY KEY AUTOINCREMENT, worker_id INTEGER, corso TEXT NOT NULL, data_completamento DATE, scadenza DATE, FOREIGN KEY (worker_id) REFERENCES workers(id));",
    "CREATE TABLE IF NOT EXISTS ppe_assigned (id INTEGER PRIMARY KEY AUTOINCREMENT, worker_id INTEGER, dispositivo TEXT NOT NULL, data_consegna DATE, scadenza_sostituzione DATE, FOREIGN KEY (worker_id) REFERENCES workers(id));"
  ];

  migrations.forEach(m => {
    try {
      database.run(m);
    } catch (e) {
      // Expected if column already exists
    }
  });
};

export const saveDB = async () => {
  if (!db) return;
  const data = db.export();
  await set('cartsan_db_v2', data);
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
