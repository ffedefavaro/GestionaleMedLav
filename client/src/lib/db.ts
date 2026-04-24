import initSqlJs, { type Database } from 'sql.js';
import { get, set } from 'idb-keyval';

let db: Database | null = null;

export const initDB = async () => {
  if (db) return db;
  const SQL = await initSqlJs({
    locateFile: file => {
      if (file.endsWith('.wasm')) {
        // Handle both local dev and production paths
        return import.meta.env.PROD ? `./sql-wasm.wasm` : `/sql-wasm.wasm`;
      }
      return `/${file}`;
    }
  });

  const savedData = await get('cartsan_db_v2');
  if (savedData) {
    db = new SQL.Database(savedData);
  } else {
    db = new SQL.Database();
    createTables(db);
    await saveDB();
  }
  return db;
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
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS protocols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      mansione TEXT,
      esami TEXT, -- JSON string
      periodicita_mesi INTEGER,
      FOREIGN KEY (company_id) REFERENCES companies(id)
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

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER,
      visit_id INTEGER,
      filename TEXT,
      file_type TEXT,
      content BLOB,
      extracted_text TEXT,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (worker_id) REFERENCES workers(id),
      FOREIGN KEY (visit_id) REFERENCES visits(id)
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
      corso TEXT,
      data_completamento DATE,
      scadenza DATE,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS ppe_assigned (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER,
      dispositivo TEXT,
      data_consegna DATE,
      scadenza_sostituzione DATE,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    -- Try to update visits for legal finalization
    try {
      database.run("ALTER TABLE visits ADD COLUMN finalized INTEGER DEFAULT 0;");
    } catch (e) {}

    -- Initialize risks_master if empty
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

    -- Try to add email column if it doesn't exist (migration)
    try {
      database.run("ALTER TABLE workers ADD COLUMN email TEXT;");
    } catch (e) {}
  `);
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
