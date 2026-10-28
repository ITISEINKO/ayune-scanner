# PPIC Panel Scanner

TrackerProd tracks production-panel progress in ClickUp through serial-number scanning, member permissions, and an admin dashboard. Users sign in with ClickUp OAuth.

## Main flows

- **Members:** choose an ongoing (`in progress`) parent project, select an allowed status, then scan using a camera or keyboard scanner. Scans are restricted to the selected project.
- **Scan statuses:** Barang Diterima, Sedang Dipacking, Terpasang / Digunakan, and Dalam Proses Retur.
- **Admins:** filter projects by In progress, Todo, or Completed, confirm starting a Todo project, inspect component progress and scan history, and update statuses manually. Each status loads on selection and refreshes with Sync.
- **Completed review:** open a frozen review with timing, unique-item scan milestones, final serial-item statuses, and scan-event contributions. **Unduh laporan** opens an A4 print layout for Save as PDF; no PDF package is required.
- **Settings:** manage member roles and allowed statuses. Ably delivers permission updates; returning to Settings refreshes the cached data after subscribing.
- **Sync:** refresh project lists or the selected admin dashboard from ClickUp. The dashboard uses a saved snapshot with local status updates between syncs.

Scans update ClickUp first, then the local status, scan history, and serial cache. Turso stores permissions, history, and cached project data.

Admin Home uses one shared summary for all authorized admins, calculated with the
server's `CLICKUP_TOKEN` (whose owner must have the local `SUPER_ADMIN` or `ADMIN` role).
`vercel.json` prewarms it daily at `45 22 * * *` UTC = 05:45 WIB, leaving time
before the 07:00 target even with Hobby's delayed scheduling. Set `CRON_SECRET`
and `CLICKUP_TOKEN` in **Vercel Production**, then redeploy to activate the job.
`GET /api/cron/admin-dashboard` requires `Authorization: Bearer <CRON_SECRET>`;
run it once after deployment to populate the shared summary before the next
scheduled run. Login shows the saved result immediately. Visible dashboards check
every five minutes and on stale focus/reconnect; a shared database lease/cooldown
allows one automatic rebuild per five minutes across admins, including after failures.
Existing data stays visible until a complete result is ready. Manual refresh bypasses
the cooldown while respecting an active rebuild. The scheduled job also rebuilds project structure/status
from ClickUp; manual summary refresh keeps the existing project Resync behavior.
Failed or incomplete jobs preserve the last complete
result, whose timestamp remains visible. Existing per-admin summary rows are
retained but no longer read. Ongoing project detail uses the server account's
shared project snapshot and refresh lease for every currently authorized admin.
Existing adaptive status polling stays database-only; roughly five-minute background
reads pick up shared Resync/prewarm results without a hard reload and keep displayed
data on failure. Full ClickUp Resync remains manual. See
[the project detail contract](context/PROJECT_DETAIL_API.md). Completed archives
retain their existing frozen handling and access scope.

`GET /api/projects` defaults to `status=in progress`; `status=to do` and `status=complete` require fresh `SUPER_ADMIN` or `ADMIN` authorization. Responses contain `{ tasks: [{ id, custom_id, name }] }`. Unsupported statuses return `400 INVALID_STATUS`; `refresh=1` bypasses the per-token/status cache. Completed listing fetches every page with `include_closed=true`, following [ClickUp Get Tasks](https://developer.clickup.com/reference/gettasks), and keeps only parent projects.

### Roles and database compatibility

`ADMIN` is the highest role and inherits all `SUPER_ADMIN` access. Existing `SUPER_ADMIN` and `MEMBER` accounts retain their behavior. Only a current `ADMIN` can grant `ADMIN` or change an existing `ADMIN` account in settings.

Run `node scripts/add-admin-role.cjs` to expand the database role constraint using `.env`. It saves a private, ignored backup under `.local-backups/`, preserves every existing row, verifies the copy inside a transaction, and safely skips an already expanded constraint. It does not promote or rename any account. Deploy the updated app before assigning `ADMIN`; older app versions do not recognize that role. After a direct database role edit, log out/in or visit `/api/auth/refresh` to replace the signed session.

`POST /api/project/complete` returns `{ task, dashboard }`, including the saved review and completing admin. It stages the snapshot before the ClickUp update, then finalizes it; a failed final save can be recovered by retrying. Completed snapshots reuse `ppic_admin_project_snapshot` under `completed:<scope hash>` and retain the existing token/list/project isolation. They survive ordinary snapshot invalidation and are never overlaid with newer item statuses. Reading an archive still checks current ClickUp parent access. A different access token creates its own first-view snapshot; that snapshot is labeled accordingly, and unrecorded completion dates/admins remain unknown.

`dashboard.completion.insights` adds backend-calculated return counts/percentages,
material groups ranked by returned-item count, and return outcomes: snapshot
Terpasang is resolved; Diterima/Dipacking/Retur remain in progress; other statuses
are unknown. Only unique, non-deleted serial items outside supporting groups count.
Durations use the first ordered scan pair per item for Diterima → Dipacking and
Dipacking → Terpasang, with elapsed-hour averages, sample counts, snapshot waiting
counts and the slower stage. Repeat scans do not reset the clock; returns and
backwards steps break a pair. Missing durations are `null`, and empty projects
have a `null` return percentage. History is limited to the earlier completion or
capture time. New snapshots persist the metrics; old snapshots derive them from
saved data on the server without refetching item/history data. The review adds no
polling. Missing scan history can undercount returns or leave durations unknown.

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
| `pnpm test:smoke`                    | Check unauthenticated login routing in Chromium       |
| `pnpm test:api`                      | Run API checks against the local ClickUp simulation   |
| `pnpm test:browser`                  | Run isolated admin, profile, and Settings UI checks    |
| `node tests/panel-members-cache.cjs` | Check Settings cache refresh and subscription cleanup |

## Code layout

- `src/features/` — member, admin, login, profile, and Settings screens.
- `src/app/api/` — authentication, scanning, project, permission, and webhook routes.
- `src/hooks/` — client queries, mutations, and scanner/realtime behavior.
- `src/lib/` — ClickUp integration, sessions, database access, and project data.
- `src/types/` — shared TypeScript types.
- `tests/` — focused checks and Playwright suites; some suites require explicit opt-in and mutate live data.

## Continuous integration

[Tests](.github/workflows/playwright.yml) runs on every push, pull request, or manual dispatch. It uses Node 22 and the pnpm version pinned in `package.json`, validates the frozen lockfile, runs unit/authorization checks, builds once, and runs Chromium smoke and regression checks. API checks use the committed Postman ClickUp simulation and temporary local databases. No GitHub secrets or production services are required. Screenshots, the Playwright report, and simulation logs are uploaded as `test-results`.

CI installs dependencies with `--ignore-scripts` so `postinstall` does not trigger a build during installation. The explicit build step uses local test environment values. Live permission/ClickUp fixtures remain opt-in and are not included in the push checks.

To run the same isolated checks locally, build the app and start the simulation in another terminal:

```sh
pnpm test
pnpm build
postman simulation run postman/simulations/admin-dashboard.sim.yaml --port 4900 --output ndjson
```

Then run `pnpm test:api` and `pnpm test:browser`. Install Chromium first with `pnpm exec playwright install chromium` if needed. `CI=1 pnpm test:smoke` uses the production build; keep the optional `CLICKUP_NON_ADMIN_TOKEN` and `CLICKUP_MEMBER_TOKEN` empty for the same login-only smoke coverage as CI.
