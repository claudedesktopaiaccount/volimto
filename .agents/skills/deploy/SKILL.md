---
name: deploy
description: Build and deploy the app.
disable-model-invocation: true
---

# Deploy to Cloudflare Workers

Deploy the Progressive Tracker to Cloudflare Workers.

## Steps

1. Run `npm run lint` to check for errors before deploying
2. Run `npm run build:cf` to build the Cloudflare Workers bundle via OpenNextJS
3. If the build succeeds, run `npx wrangler deploy` to deploy to Cloudflare
4. Report the deployment URL and status
5. If any step fails, report the error and do NOT proceed to the next step
