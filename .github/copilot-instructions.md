# Project Guidelines

## Architecture
- The shared React Native UI lives in `App.tsx`. Native entry points use React Native CLI; Web uses `index.web.js`, React Native Web, and `webpack.config.js`.
- Keep native and web storage behavior aligned: native uses `Helpers/storage.js` (MMKV), while Web resolves `Helpers/storage.web.js` (browser `localStorage`).
- The Express API is in `BudgetBuddy.Api/server.js`; PostgreSQL runs through the root `docker-compose.yml`.
- Keep `initializeDatabase()` ahead of `app.listen()` so the API only accepts requests after all required tables and indexes exist.

## Authentication and Data
- Client requests use `apiUrl` and `apiHeaders()` from `Helpers/api.ts`. Keep the ngrok bypass header on API calls and let `apiHeaders()` attach the stored JWT.
- API authorization derives identity from the verified JWT (`req.user.email`). Never trust a client-supplied owner email or email query parameter for protected data.
- Local budget, title, item, transaction, and history keys must be scoped by normalized account email. Legacy global budget data may only be migrated when its stored owner email matches the signed-in user.
- Budget sharing and archiving are owner-only; invitation reads and updates are scoped to the authenticated recipient.
- Do not restore an `app.js` filename: Windows module resolution can confuse it with `App.tsx`.
- Never commit `.env` files or credentials. Use `BudgetBuddy.Api/.env.example` for configuration names.

## Validation
- Client: `npx tsc --noEmit`, `npm test`, and `npm run web`.
- API: from `BudgetBuddy.Api`, run `npm test` and `npm run check`.
- For API or schema changes, keep database-independent contract tests in `BudgetBuddy.Api/server.test.js`; use PostgreSQL-backed checks when Docker is available.
