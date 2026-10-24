# Admin dashboard endpoint

`GET /api/admin/dashboard`

Requires a signed `ppic_session` identity, a ClickUp access-token cookie, and a current local `SUPER_ADMIN` role in `ppic_permissions`. Authorization runs on every request, including cache hits. The browser does not send credentials in a query parameter or request body.

The admin page reads the last saved presentation payload after checking the current local admin role. If one exists, it renders immediately and React Query makes no automatic dashboard request. Only a first visit without a saved result or an explicit refresh loads/calculates data. The endpoint returns the calculated presentation payload, not full project dashboards.

The `/admin` page and its route-loading skeleton live in `src/app/admin/(dashboard)/`. The route group keeps the public URL unchanged and prevents other admin pages from inheriting the dashboard skeleton. Those pages retain their own feature loading states; project detail retains its route-specific loading file.

## Cache and refresh

- The last complete aggregate is persisted in Turso `ppic_admin_dashboard_snapshot`; opening or reloading the page does not recalculate it. There is no TTL, automatic revalidation, timer, cron, or polling. The header displays the calculation timestamp.
- Scope hashes the signed admin user ID, Panel list, database URL, and chat workspace/channel configuration. Different admins/configurations do not share summaries; the same admin can reuse the result after login-token rotation or a new day. Tokens are not stored in the snapshot.
- `GET /api/admin/dashboard` returns the saved result if one exists; otherwise it builds one. `?refresh=1` waits for a new calculation. **Perbarui dashboard** and **Coba lagi** use this explicit refresh. Failed HTTP refreshes preserve displayed data. Partial results are returned with the existing incomplete-data warnings, but never overwrite the last complete saved result.
- A forced aggregate refresh still respects the existing 60-second project-list/roster caches and persistent project snapshots. It does not force ClickUp project Resync. Cold project snapshots may still require slow ClickUp hierarchy fetching.
- Successful responses use `Cache-Control: private, no-store`; HTTP/browser caches do not hold the response. The database snapshot and in-memory React Query cache are separate. Client `staleTime` is infinite; focus, reconnect, and remount do not automatically refresh existing data.

## 200 JSON

| Field | Meaning |
| --- | --- |
| `now` | Server calculation timestamp, epoch milliseconds; shared history cutoff and heading date |
| `projectCount` | Number of listed ongoing parent projects, or null on list failure |
| `projectsReady` | True only when the project list and every project dashboard loaded |
| `totals` | `summarizeAdminOverview` result: `total`, `recorded`, `percentage`, `statuses`, `returns`, `today`, `change`, `week`, `active`, `enabled`, `idle`, `noAccess` |
| `members` | Non-admin channel members with `id`, `name`, `hasAccess`, and `summary: { today, total, days }`; summary is null if the grouped history query fails. Entire array is null on roster/access failure. Lifetime/status detail fields are intentionally absent. |
| `dailyScans` | 30 ascending WIB dates with `{ date, count, statuses }`, or null on history/roster/access failure. Status map includes all four PPIC keys plus `OTHER`. |

Example: an empty roster/project list is a successful response with `projectCount: 0`, `projectsReady: true`, `members: []`, zero totals, and 30 zero-filled daily buckets. A project failure can still return team data with `projectsReady: false`; the UI hides incomplete inventory totals. A history failure retains the member roster but sets each summary and `dailyScans` to null. Partial results are not persisted; explicit refresh retries immediately.

Inventory counts current component states in ongoing projects, excluding supporting/deleted components. Team counts stored scan events across all projects for the current non-admin roster, including repeated scans and members without current scan access. Seven-day team metrics and the 30-day chart are derived from **one** query grouped by member, WIB date, and status. No per-member lifetime queries run on home loads. Member drawer details use their separate existing endpoint.

## Errors

- 401 `UNAUTHORIZED`: missing/invalid signed session or missing ClickUp token.
- 403 `FORBIDDEN`: caller no longer has the local admin role, regardless of session role or cached aggregate.
- 502 `DASHBOARD_UNAVAILABLE`: unexpected route/cache/authorization database failure.

The route does not accept a target user or expose another admin's saved result. It makes no ClickUp mutations; a cold project build can write existing local component-status seeds/snapshots. There is no cross-service transaction. A new `ppic_admin_dashboard_snapshot` table is created lazily using the same database/schema pattern as existing project snapshots.

## Local checks

```sh
node --experimental-strip-types tests/team-daily-scans.cjs
npm run build
postman simulation run postman/simulations/admin-dashboard.sim.yaml --port 4900 --output ndjson
node tests/admin-home.cjs
```

The grouped-history test checks a single database statement and exact agreement with existing per-member seven-day summaries. Browser/API checks cover saved-result reuse without automatic requests, token rotation, old calculation dates, concurrent refresh ordering, explicit refresh after database changes, fresh page/API authorization, isolated admin accounts, incomplete-result retention, empty/error states, and the shared skeleton on a cold visit. Timings are local simulation evidence, not production measurements.

See [the complete data-flow documentation](ADMIN_DASHBOARD_DATA_FLOW.md) for formulas and edge cases.
