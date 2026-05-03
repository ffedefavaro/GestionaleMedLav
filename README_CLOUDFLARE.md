# Migrazione a Cloudflare Pages

Il progetto è stato migrato da Netlify a Cloudflare Pages. Ecco le istruzioni per configurare il deploy:

### 1. Creare il progetto su Cloudflare Pages
1. Accedi alla dashboard di Cloudflare.
2. Vai su **Workers & Pages** > **Pages** > **Connect to Git**.
3. Seleziona il repository GitHub `GestionaleMedLav`.
4. Configura i parametri di build:
   - **Framework preset**: `None`
   - **Build command**: `cd client && npm install && npm run build`
   - **Build output directory**: `client/dist`
   - **Root directory**: `/`
5. Clicca su **Save and Deploy**.

### 2. Ottenere API Token e Account ID
- **Account ID**: Si trova nella dashboard principale di Cloudflare nella colonna di destra o nell'URL (es: `dash.cloudflare.com/ACCOUNT_ID`).
- **API Token**:
  1. Vai su **My Profile** > **API Tokens**.
  2. Clicca su **Create Token**.
  3. Usa il template **Edit Cloudflare Pages**.
  4. Copia il token generato.

### 3. Aggiungere i Secrets su GitHub
Nel tuo repository su GitHub, vai su **Settings** > **Secrets and variables** > **Actions** e aggiungi:
- `CLOUDFLARE_API_TOKEN`: Il token ottenuto al punto precedente.
- `CLOUDFLARE_ACCOUNT_ID`: L'ID del tuo account Cloudflare.

Il deploy avverrà automaticamente ad ogni push sul branch `main`.
