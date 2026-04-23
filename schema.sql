CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ragione_sociale TEXT NOT NULL,
    p_iva TEXT,
    sede_operativa TEXT
);
CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    nome TEXT,
    cognome TEXT,
    codice_fiscale TEXT UNIQUE,
    mansione TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER,
    data_visita DATE,
    data_scadenza DATE,
    giudizio TEXT,
    FOREIGN KEY (worker_id) REFERENCES workers(id)
);
CREATE TABLE IF NOT EXISTS biometrics (
    visit_id INTEGER PRIMARY KEY,
    peso REAL,
    altezza INTEGER,
    bmi REAL,
    pressione_sistolica INTEGER,
    pressione_diastolica INTEGER,
    frequenza_cardiaca INTEGER,
    FOREIGN KEY (visit_id) REFERENCES visits(id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    action TEXT,
    table_name TEXT,
    resource_id INTEGER,
    details TEXT
);
