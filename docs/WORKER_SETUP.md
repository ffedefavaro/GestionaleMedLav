Dopo il primo deploy, impostare il secret:
cd workers/anthropic-proxy && wrangler secret put ANTHROPIC_API_KEY

**Nota:** Assicurarsi che il `CLOUDFLARE_API_TOKEN` utilizzato in GitHub Actions abbia i permessi `Workers Scripts: Edit` oltre a quelli per `Cloudflare Pages`.
