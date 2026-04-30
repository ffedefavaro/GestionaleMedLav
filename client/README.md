# CartSan Lean - Gestionale Medicina del Lavoro

Software professionale per la gestione della medicina del lavoro, conforme al **D.Lgs. 81/08 Allegato 3A**.

## Caratteristiche principali

- **Architettura Serverless**: Il database SQLite gira interamente nel browser grazie a `sql.js`. Nessun dato lascia il tuo computer.
- **Conformità Allegato 3A**: Gestione completa di anagrafica, anamnesi, esame obiettivo e giudizi di idoneità.
- **Export PDF**: Generazione automatica di giudizi di idoneità firmabili.
- **Persistenza Sicura**: I dati vengono salvati localmente tramite IndexedDB.
- **Backup & Ripristino**: Possibilità di esportare e importare l'intero database in formato `.sqlite`.

## Stack Tecnologico

- **Frontend**: React 18 + TypeScript
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

## Note Legali e Scelte Architetturali

### Analisi Multi-Ruolo effettuata (Revisione Senior Engineer)

#### 1. Medico del Lavoro (Operatività)
- **Problema**: Mancava un campo per gli accertamenti strumentali dettagliati.
- **Correzione**: Aggiunta sezione "Accertamenti e Risultanze" nel modulo Nuova Visita e nei PDF.
- **Problema**: Protocollo non chiaramente legato ai rischi.
- **Correzione**: Implementata tabella `risks_master` e associazione rischi-lavoratore per una sorveglianza mirata.

#### 2. Medico Legale (Solidità Giuridica)
- **Problema**: Documenti PDF troppo sintetici.
- **Correzione**: Allineamento completo all'Art. 41 e Allegato 3A (inclusi CF, tipo visita, dati professionali del medico).
- **Problema**: Mancanza di immutabilità e tracciabilità.
- **Correzione**: Implementato `audit_logs` per registrare ogni operazione di inserimento e finalizzazione. Aggiunto flag `finalized` per le visite chiuse.

#### 3. RSPP (Gestione Sicurezza)
- **Problema**: Impossibilità di tracciare formazione e DPI.
- **Correzione**: Creato nuovo modulo "Sicurezza/RSPP" per gestire scadenze corsi e consegna dispositivi di protezione.

#### 4. Ispettore SPISAL/ASL (Conformità)
- **Problema**: Difficoltà nell'estrazione dati aggregati.
- **Correzione**: Implementata funzione di export Allegato 3B (INAIL) e visualizzazione Registro Audit.

#### 5. Paziente/Lavoratore (Trasparenza)
- **Problema**: Giudizio di idoneità poco formale.
- **Correzione**: Layout PDF migliorato per massima leggibilità e inclusione di tutte le prescrizioni.

### Altre Note
- **Privacy (GDPR)**: Essendo un'applicazione "client-side only", il Medico Competente ha il pieno controllo fisico dei dati, che risiedono solo sulla sua macchina.
- **Email e Calendario**: Le funzioni di invio email e sincronizzazione calendario sono predisposte come integrazioni link-based per mantenere l'applicazione indipendente da server esterni e servizi a pagamento.
- **Storage**: L'uso di IndexedDB garantisce che il database possa crescere oltre i limiti del localStorage (fino a centinaia di MB), permettendo la gestione di migliaia di lavoratori.
