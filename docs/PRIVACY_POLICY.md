# Informativa Privacy e Sicurezza Dati (GDPR) - CartSan Lean

Conforme al **Regolamento UE 2016/679 (GDPR)** e al **D.Lgs. 196/2003 (Codice Privacy)**.

---

## 1. VERSIONE PER L'UTENTE FINALE (Sintetica)

### Chi tratta i dati?
Il **Titolare del Trattamento** è il Medico Competente (o l'organizzazione sanitaria) che utilizza questa applicazione. Il software "CartSan Lean" è uno strumento puramente locale: il produttore del software non ha accesso ai tuoi dati.

### Dove sono salvati i dati?
I dati sanitari risiedono **esclusivamente nella memoria locale (IndexedDB)** del tuo browser sul dispositivo che stai utilizzando. Non vengono trasmessi a server cloud o database esterni, a meno di una tua esplicita azione (es. invio email tramite integrazione Gmail).

### Come sono protetti?
- **Cifratura AES-256**: Tutti i dati sensibili sono cifrati sul tuo dispositivo. La chiave di sblocco è la tua Master Password.
- **Accesso Protetto**: L'app richiede l'autenticazione ad ogni sessione.
- **Controllo Totale**: Puoi esportare o eliminare definitivamente l'intero database in qualsiasi momento.

### Quali sono i tuoi diritti?
Puoi accedere, rettificare o cancellare i dati dei lavoratori gestiti in conformità ai tuoi obblighi di legge come Medico del Lavoro.

---

## 2. VERSIONE ESTESA PER IL REGISTRO DEI TRATTAMENTI

### 2.1 Titolare del Trattamento
L'utilizzatore finale dell'applicazione (Professionista Sanitario / Azienda) riveste il ruolo di Titolare del Trattamento. Lean Medical Systems agisce esclusivamente come fornitore della tecnologia "offline-first".

### 2.2 Finalità del Trattamento
- Esecuzione della sorveglianza sanitaria obbligatoria (D.Lgs. 81/08).
- Gestione delle cartelle sanitarie e di rischio (Allegato 3A).
- Emissione dei giudizi di idoneità alla mansione specifica.

### 2.3 Base Giuridica
Il trattamento è necessario per motivi di interesse pubblico nel settore della sanità pubblica e per l'adempimento di obblighi legali in materia di salute e sicurezza sul lavoro, ai sensi dell'**Art. 9, par. 2, lett. (h) e (i) del GDPR**.

### 2.4 Categorie di Dati Trattati
- **Dati comuni**: Dati anagrafici, fiscali e di contatto dei lavoratori e delle aziende.
- **Dati particolari (sanitari)**: Anamnesi, esiti di esami clinici, parametri biometrici, giudizi di idoneità.

### 2.5 Misure Tecniche e Organizzative (Art. 32 GDPR)
- **Local-Only Storage**: Utilizzo di SQLite (sql.js) persistito in IndexedDB senza sincronizzazione cloud automatica.
- **Zero-Knowledge Encryption**: Cifratura simmetrica AES-256 eseguita lato client (CryptoJS). La Master Password non viene mai salvata in chiaro (hash bcrypt).
- **Session Management**: Timeout automatico di inattività impostato a 15 minuti.
- **Audit Logging**: Registrazione cronologica degli accessi e delle modifiche strutturali ai dati sanitari.

### 2.6 Periodo di Conservazione (Policy Retention)
I dati devono essere conservati per i termini previsti dal D.Lgs. 81/08 (almeno 10 anni dalla cessazione del rapporto di lavoro o dalla chiusura della pratica). Essendo lo storage locale, la responsabilità della conservazione e del backup fisico ricade sul Titolare (utente).

### 2.7 Diritti degli Interessati
I lavoratori (interessati) possono esercitare i diritti previsti dagli Artt. 15-22 del GDPR rivolgendosi direttamente al Medico Competente.

### 2.8 Responsabile della Protezione dei Dati (DPO)
Data la natura locale dell'app, il Titolare deve indicare i propri contatti DPO se previsti dalla propria struttura organizzativa. Per supporto tecnico relativo al software, contattare: `support@cartsan-lean.it`.
