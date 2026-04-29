# CartSan Lean - Gestionale Medicina del Lavoro

Software professionale per la gestione della medicina del lavoro, conforme al **D.Lgs. 81/08 Allegato 3A**.

## Caratteristiche principali

- **Architettura Serverless**: Il database SQLite gira interamente nel browser grazie a `sql.js`. Nessun dato lascia il tuo computer.
- **Conformità Allegato 3A**: Gestione completa di anagrafica, anamnesi, esame obiettivo e giudizi di idoneità.
- **Export PDF**: Generazione automatica di giudizi di idoneità firmabili.
- **Persistenza Sicura**: I dati vengono salvati localmente tramite IndexedDB.
- **Backup & Ripristino**: Possibilità di esportare e importare l'intero database in formato `.sqlite`.

## Stack Tecnologico

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: SQLite (sql.js) + IndexedDB (idb-keyval)
- **PDF**: jsPDF

## Guida all'avvio rapido

1. Entra nella cartella del client:
   ```bash
   cd client
   ```
2. Installa le dipendenze:
   ```bash
   npm install
   ```
3. Avvia in modalità sviluppo:
   ```bash
   npm run dev
   ```
4. Per la produzione:
   ```bash
   npm run build
   npm run preview
   ```

## Deploy Automatico (Netlify)

L'applicazione è configurata per il deploy automatico su Netlify tramite GitHub Actions.
Per istruzioni dettagliate su come collegare il tuo repository, consulta la [Guida al Deploy](./README_NETLIFY.md).

## Note Legali e Scelte Architetturali

### Analisi Multi-Ruolo effettuata (Revisione Senior Engineer)

#### 1. Medico del Lavoro (Operatività)
- **Operatività**: Aggiunta sezione "Accertamenti e Risultanze" nel modulo Nuova Visita e nei PDF.
- **Protocolli**: Implementata tabella `risks_master` e associazione rischi-lavoratore per una sorveglianza mirata.

#### 2. Medico Legale (Solidità Giuridica)
- **Documentazione**: Allineamento completo all'Art. 41 e Allegato 3A (inclusi CF, tipo visita, dati professionali del medico).
- **Tracciabilità**: Implementato `audit_logs` e flag `finalized` per le visite chiuse.

#### 3. RSPP (Gestione Sicurezza)
- **Sicurezza**: Gestione scadenze corsi e consegna dispositivi di protezione.

#### 4. Ispettore SPISAL/ASL (Conformità)
- **Compliance**: Export Allegato 3B (INAIL) e visualizzazione Registro Audit.

### Privacy e Sicurezza (GDPR)
Essendo un'applicazione "client-side only", il Medico Competente ha il pieno controllo fisico dei dati, che risiedono solo sulla sua macchina locale. L'uso di IndexedDB garantisce prestazioni elevate e storage fino a centinaia di MB.
