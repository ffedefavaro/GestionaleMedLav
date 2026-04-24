# Configurazione Integrazione Google (Gmail & Calendar)

Per abilitare l'acquisizione automatica dei documenti e la sincronizzazione del calendario, segui questi passaggi:

## 1. Crea un progetto su Google Cloud Console
1. Vai su [Google Cloud Console](https://console.cloud.google.com/).
2. Clicca su "Seleziona un progetto" > "Nuovo progetto".
3. Dai un nome al progetto (es. `CartSan-Lean`) e clicca su "Crea".

## 2. Abilita le API necessarie
1. Nel menu laterale, vai su **"API e servizi" > "Libreria"**.
2. Cerca e abilita:
   - **Gmail API**
   - **Google Calendar API**

## 3. Configura la schermata di consenso OAuth
1. Vai su **"API e servizi" > "Schermata consenso OAuth"**.
2. Scegli **"External"** e clicca su "Crea".
3. Inserisci i dati obbligatori (Nome app, email supporto, email sviluppatore).
4. Nella sezione **"Scope"**, aggiungi:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
5. Aggiungi il tuo indirizzo email come **"Test User"** (fondamentale finché l'app non è verificata da Google).

## 4. Crea le credenziali (Client ID)
1. Vai su **"API e servizi" > "Credenziali"**.
2. Clicca su **"Crea credenziali" > "ID client OAuth"**.
3. Tipo di applicazione: **Applicazione Web**.
4. Aggiungi le Origini JavaScript autorizzate:
   - `http://localhost:3000` (per il test locale)
   - L'indirizzo URL finale se pubblichi l'app.
5. Clicca su "Crea". Ti verranno mostrati il tuo **Client ID** e il **Client Secret**.

## 5. Inserisci i dati nel Gestionale
1. Apri CartSan Lean.
2. Vai in **Impostazioni**.
3. Incolla il Client ID e il Client Secret nelle sezioni corrispondenti.
4. Clicca su **Salva**.

Ora, nella sezione "Nuova Visita", potrai cliccare su "Sincronizza Mail Paziente" per acquisire automaticamente i documenti inviati dai lavoratori.
