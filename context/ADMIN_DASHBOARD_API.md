# Admin dashboard endpoint

`GET /api/admin/dashboard`

Requires a signed `ppic_session` identity, a ClickUp access-token cookie, and a current local `SUPER_ADMIN` or `ADMIN` role in `ppic_permissions`. `ADMIN` inherits all existing `SUPER_ADMIN` access. Authorization runs on every request, including cache hits. The browser does not send credentials in a query parameter or request body.

The admin page reads one shared saved presentation payload after checking the current local admin role. If one exists, it renders immediately. A result older than five minutes triggers a background freshness check. Rebuilds use the server's `CLICKUP_TOKEN`, whose owner must currently have the local `SUPER_ADMIN` or `ADMIN` role. Browser tokens never select the shared data source. The endpoint returns the presentation payload, not full project dashboards.

The `/admin` page and its route-loading skeleton live in `src/app/admin/(dashboard)/`. The route group keeps the public URL unchanged and prevents other admin pages from inheriting the dashboard skeleton. Those pages retain their own feature loading states; project detail retains its route-specific loading file.

## Cache and refresh

- The last complete aggregate is persisted in Turso `ppic_admin_dashboard_snapshot` and displayed immediately, including during background requests. Visible dashboards check every five minutes. Hidden tabs pause polling; returning to a stale tab or reconnecting checks freshness. A daily cron still prewarms independently of login. The header displays the calculation timestamp.
- The `shared:` scope hashes the server token, Panel list, database URL, and chat workspace/channel configuration. All authorized admins share it across login-token rotation and days. Raw credentials are not persisted. Older per-admin rows are retained but not read. Ongoing project-detail snapshots now also use the server account's shared scope; completed archives retain their frozen access scopes.
- `GET /api/admin/dashboard` returns a saved result younger than five minutes; otherwise it attempts a shared rebuild. `ppic_admin_dashboard_refresh` uses an atomic 60-second database lease across server instances and a five-minute cooldown between automatic attempts, including failures. Contenders reuse the latest complete saved result; without one they receive 502. Expired/superseded owners cannot publish or release another owner's lease. **Perbarui dashboard** and **Coba lagi** use `?refresh=1`, bypassing the age/cooldown while respecting an active lease. Cron respects that same lease. No detached server task is required: the winning request awaits the calculation while the browser keeps its existing data visible.
- Incomplete or failed rebuilds return 502 and preserve both the saved and displayed complete result. With no saved result, failure shows the initial error/retry screen. Successful complete calculations replace the saved payload and the requesting browser's data; other admins receive it on their next freshness check.
- Aggregate rebuilds fetch a fresh project list and respect the existing roster cache. Manual summary refresh reuses project snapshots with newer local component statuses. Scheduled prewarm additionally forces each shared ongoing project snapshot to rebuild from ClickUp, so the new day's summary can include changed structure/status. Open project-detail pages pick up that same saved result on their next background read; see [the project detail contract](PROJECT_DETAIL_API.md).
- Successful responses use `Cache-Control: private, no-store`. The database snapshot and React Query cache are separate. Client `staleTime` and the visible-tab interval are five minutes. Initial freshness uses the snapshot calculation timestamp. The query key includes the initial snapshot timestamp, so returning to Home can display a newer server snapshot without keeping an older in-memory result. These checks refresh scan summaries/local status overlays; they do not force project structure Resync.

## Scheduled prewarm

`GET /api/cron/admin-dashboard` requires the exact `Authorization: Bearer <CRON_SECRET>` header; it does not require user cookies. Missing configuration returns `503 CRON_NOT_CONFIGURED`, missing/wrong authorization returns `401 UNAUTHORIZED`, complete success returns `{ ok: true, calculatedAt: <epoch milliseconds> }`, and failed/incomplete calculations or an already-active lease return `502 DASHBOARD_UNAVAILABLE` while retaining the last complete saved result. A busy cron does not report an old snapshot as a successful project rebuild. No full dashboard payload or credentials are returned.

`vercel.json` schedules one daily invocation at `45 22 * * *` UTC (05:45 WIB), ahead of the target readiness time of 07:00 WIB. Vercel Hobby may invoke within the following hour; this is a buffer, not a guarantee against outages. Configure `CRON_SECRET` and `CLICKUP_TOKEN` in Vercel Production and deploy before the schedule takes effect. Invoke once after deployment to prepopulate the new shared scope; otherwise its first visitor still needs a cold calculation. Both cron and browser rebuilds have `maxDuration = 60`. Older/slower calculations cannot overwrite newer stored results.

References: [Vercel scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 200 JSON

| Field | Meaning |
| --- | --- |
| `now` | Server calculation timestamp, epoch milliseconds; shared history cutoff and heading date |
| `projectCount` | Number of listed ongoing parent projects, or null on list failure |
| `projectsReady` | True only when the project list and every project dashboard loaded |
| `totals` | `summarizeAdminOverview` result: `total`, `recorded`, `percentage`, `statuses`, `returns`, `today`, `change`, `week`, `active`, `enabled`, `idle`, `noAccess` |
| `members` | Non-admin channel members with `id`, `name`, `hasAccess`, and `summary: { today, total, days }`; summary is null if the grouped history query fails. Entire array is null on roster/access failure. Lifetime/status detail fields are intentionally absent. |
| `dailyScans` | 30 ascending WIB dates with `{ date, count, statuses }`, or null on history/roster/access failure. Status map includes all four PPIC keys plus `OTHER`. |

Example: an empty roster/project list is a successful response with `projectCount: 0`, `projectsReady: true`, `members: []`, zero totals, and 30 zero-filled daily buckets. A failed project, roster or history branch makes the calculation incomplete; it returns 502 rather than replacing complete data with partial values. Explicit refresh can retry immediately once the active lease is released.

Inventory counts current component states in ongoing projects, excluding supporting/deleted components. Team counts stored scan events across all projects for the current non-admin roster, including repeated scans and members without current scan access. Seven-day team metrics and the 30-day chart are derived from **one** query grouped by member, WIB date, and status. No per-member lifetime queries run on home loads. Member drawer details use their separate existing endpoint.

## Errors

- 401 `UNAUTHORIZED`: missing/invalid signed session or missing ClickUp token.
- 403 `FORBIDDEN`: caller no longer has the local admin role, regardless of session role or cached aggregate.
- 502 `DASHBOARD_UNAVAILABLE`: failed/incomplete rebuild, lost lease, no saved result during another rebuild/cooldown, or unexpected route/cache/authorization database failure.

The browser route does not accept a target user; every authorized admin receives the shared service-account summary. Fresh local role checks still protect each read. It makes no ClickUp mutations; a cold project build can write existing local component-status seeds/snapshots. There is no cross-service transaction. The existing snapshot table is created lazily if absent.

## Local checks

```sh
node --experimental-strip-types tests/team-daily-scans.cjs
npm run build
postman simulation run postman/simulations/admin-dashboard.sim.yaml --port 4900 --output ndjson
node tests/admin-home.cjs
```

The grouped-history test checks a single database statement and agreement with existing per-member summaries. Browser/API checks cover cron authentication/prewarm, shared results across admin accounts, token rotation, fresh authorization, five-minute stale checks, concurrent automatic/manual refresh leases, lost-owner fencing, failure cooldown, visible polling, hidden-tab pause, stale focus, data retained until ready/on failure, manual refresh, empty states and the cold skeleton. Timings are local simulation evidence, not production measurements.

See [the complete data-flow documentation](ADMIN_DASHBOARD_DATA_FLOW.md) for formulas and edge cases.
