# CartSan Lean - Guida al Deploy su Netlify

Questa guida spiega come configurare il deploy automatico per l'applicazione CartSan Lean utilizzando GitHub Actions e Netlify.

## 1. Preparazione su Netlify

### Ottenere il Site ID
1. Accedi al tuo pannello [Netlify](https://app.netlify.com/).
2. Vai su **Site Settings** > **General** > **Site Details**.
3. Copia il valore di **Site ID** (es. `12345678-abcd-1234-efgh-1234567890ab`).

### Ottenere l'Auth Token
1. Clicca sulla tua icona profilo in alto a destra e vai su **User Settings**.
2. Nel menu a sinistra, seleziona **Applications**.
3. Sotto **Personal access tokens**, clicca su **New access token**.
4. Dai un nome al token (es. `GitHub Actions Deploy`) e clicca su **Generate token**.
5. Copia il token generato immediatamente (non sarà più visibile).

## 2. Configurazione su GitHub

Per permettere a GitHub di caricare i file su Netlify, devi aggiungere le credenziali come "Secrets":

1. Vai sul tuo repository GitHub.
2. Clicca su **Settings** (la scheda in alto).
3. Nel menu a sinistra, clicca su **Secrets and variables** > **Actions**.
4. Clicca su **New repository secret** e aggiungi:
   - **Name**: `NETLIFY_AUTH_TOKEN`
   - **Value**: (Incolla il token creato al punto precedente)
5. Clicca di nuovo su **New repository secret** e aggiungi:
   - **Name**: `NETLIFY_SITE_ID`
   - **Value**: (Incolla il Site ID del tuo sito Netlify)

## 3. Come funziona il Deploy

Il sistema è configurato per essere completamente automatico:

- **Deploy ad ogni Push**: Ogni volta che fai un `push` sul branch `main`, GitHub Actions avvierà automaticamente il build del progetto `client` e caricherà i file su Netlify.
- **Preview delle Pull Request**: Se apri una Pull Request, GitHub Actions creerà una versione di anteprima (Deploy Preview) e pubblicherà il link come commento nella PR stessa, permettendoti di testare le modifiche prima di unirle al main.

## 4. Note Tecniche

- **Configurazione**: Il file `netlify.toml` nella root gestisce il routing della SPA (Single Page Application), assicurando che React Router funzioni correttamente reindirizzando tutte le richieste verso `index.html`.
- **Database**: Essendo un'app serverless con SQLite locale (IndexedDB), non è necessaria alcuna configurazione di database sul server.

---

*L'applicazione è ora pronta per essere distribuita all'indirizzo:*
[https://gestionalemedlav.netlify.app](https://gestionalemedlav.netlify.app)
