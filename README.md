# PPIC Panel Scanner

TrackerProd tracks production-panel progress in ClickUp through serial-number scanning, member permissions, and an admin dashboard. Users sign in with ClickUp OAuth.

## Main flows

- **Members:** choose an ongoing (`in progress`) parent project, select an allowed status, then scan using a camera or keyboard scanner. Scans are restricted to the selected project.
- **Scan statuses:** Barang Diterima, Sedang Dipacking, Terpasang / Digunakan, and Dalam Proses Retur.
- **Admins:** view ongoing and Todo projects, confirm starting a Todo project, inspect component progress and scan history, and update statuses manually.
- **Settings:** manage member roles and allowed statuses. Ably delivers permission updates; returning to Settings refreshes the cached data after subscribing.
- **Sync:** refresh project lists or the selected admin dashboard from ClickUp. The dashboard uses a saved snapshot with local status updates between syncs.

Scans update ClickUp first, then the local status, scan history, and serial cache. Turso stores permissions, history, and cached project data.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, ClickUp API, Turso/libSQL, Ably, and html5-qrcode.

## Local development

Configure `.env` using [`.env.example`](.env.example), including ClickUp OAuth, the PPIC list/channel, Turso, and Ably. Set the OAuth callback to match `CLICKUP_REDIRECT_URI`. Use an initialized PPIC database; this repository does not provide complete database provisioning.

```sh
pnpm install
pnpm dev
```

Installation runs `next build` through `postinstall`, so configure the environment before installing. Open `http://localhost:3000` after starting the dev server.

| Command                              | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `pnpm build`                         | Create a production build                             |
| `pnpm start`                         | Run the production build                              |
| `pnpm test`                          | Run status and dashboard unit checks                  |
| `node tests/panel-members-cache.cjs` | Check Settings cache refresh and subscription cleanup |

## Code layout

- `src/features/` — member, admin, login, profile, and Settings screens.
- `src/app/api/` — authentication, scanning, project, permission, and webhook routes.
- `src/hooks/` — client queries, mutations, and scanner/realtime behavior.
- `src/lib/` — ClickUp integration, sessions, database access, and project data.
- `src/types/` — shared TypeScript types.
- `tests/` — focused checks and Playwright suites; some suites require explicit opt-in and mutate live data.

testing pr
