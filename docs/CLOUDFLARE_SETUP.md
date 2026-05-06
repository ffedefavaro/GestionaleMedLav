# Configurazione Cloudflare Pages

Questa guida spiega come configurare Cloudflare Pages per il deploy automatico tramite GitHub Actions.

## 1. Creare il progetto su Cloudflare Pages

1. Accedi alla dashboard di [Cloudflare](https://dash.cloudflare.com/).
2. Vai su **Workers & Pages**.
3. Clicca su **Create application** e poi sulla scheda **Pages**.
4. Seleziona **Connect to Git** o scegli **Upload assets** (nel nostro caso usiamo le GitHub Actions, quindi la configurazione iniziale serve principalmente a definire il `projectName`).
   - Se scegli "Connect to Git", seleziona il repository e configura i build settings (anche se GitHub Actions sovrascriverà il deploy, è utile per inizializzare il progetto).
   - Assicurati che il nome del progetto sia `gestionalemedlav`.

## 2. Ottenere API Token e Account ID

### Account ID
1. Dalla dashboard di Cloudflare, seleziona il tuo account.
2. L'**Account ID** è visibile nella barra laterale destra (sezione "Overview") o nell'URL della dashboard: `dash.cloudflare.com/<ACCOUNT_ID>/...`.

### API Token
1. Vai su **My Profile** > **API Tokens**.
2. Clicca su **Create Token**.
3. Usa il template **Edit Cloudflare Pages**.
4. Configura i permessi aggiungendo anche quelli per i Workers (necessari per il proxy Anthropic). Il token deve avere i seguenti permessi:
   - `Account > Cloudflare Pages > Edit`
   - `Account > Workers Scripts > Edit`
   - `Zone > Zone > Read` (necessario per configurare le rotte del worker)
   - `User > User Details > Read` (necessario per l'autenticazione di Wrangler)
5. Copia il token generato.

## 3. Aggiungere i Secrets su GitHub

1. Vai sul tuo repository GitHub.
2. Vai su **Settings** > **Secrets and variables** > **Actions**.
3. Clicca su **New repository secret** e aggiungi:
   - `CLOUDFLARE_API_TOKEN`: Il token creato al punto 2.
   - `CLOUDFLARE_ACCOUNT_ID`: L'ID del tuo account Cloudflare.

## Note sul Deploy
Il workflow GitHub Actions è configurato per:
- Installare le dipendenze in `client/`.
- Buildare il progetto (`npm run build`).
- Caricare il contenuto di `client/dist` su Cloudflare Pages.
- Gestire il routing SPA tramite il file `client/public/_redirects`.

## 4. Configurazione Anthropic Proxy (Worker)

Il sistema utilizza un Cloudflare Worker come proxy per le API di Anthropic per gestire il CORS.

### Impostare la API Key
Per configurare la chiave API nel worker `anthropic-proxy`, esegui il seguente comando dalla cartella root del progetto:

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Quando richiesto, inserisci la tua API Key di Anthropic.
